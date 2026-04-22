import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";

type Client = {
	ws: WebSocket;
	channels: Set<string>;
};

const clients = new Map<WebSocket, Client>();
const activeLogStreams = new Map<string, () => void>();

let wss: WebSocketServer | null = null;

export function createWebSocketServer(server: Server) {
	if (wss) return wss;

	wss = new WebSocketServer({ noServer: true });

	server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
		const url = new URL(req.url ?? "", `http://${req.headers.host}`);

		if (url.pathname === "/ws") {
			wss!.handleUpgrade(req, socket, head, (ws) => {
				wss!.emit("connection", ws, req);
			});
		}
	});

	wss.on("connection", (ws: WebSocket) => {
		const client: Client = { ws, channels: new Set() };
		clients.set(ws, client);

		ws.on("message", (data) => {
			try {
				const msg = JSON.parse(data.toString());
				if (msg.type === "subscribe" && msg.channel) {
					client.channels.add(msg.channel);
					handleChannelSubscribe(msg.channel);
				} else if (msg.type === "unsubscribe" && msg.channel) {
					client.channels.delete(msg.channel);
					handleChannelUnsubscribe(msg.channel);
				}
			} catch {
				// Ignore invalid messages
			}
		});

		ws.on("close", () => {
			for (const channel of client.channels) {
				handleChannelUnsubscribe(channel);
			}
			clients.delete(ws);
		});

		ws.send(JSON.stringify({ type: "connected" }));
	});

	return wss;
}

function getChannelSubscriberCount(channel: string): number {
	let count = 0;
	for (const client of clients.values()) {
		if (client.channels.has(channel) && client.ws.readyState === WebSocket.OPEN) {
			count++;
		}
	}
	return count;
}

function handleChannelSubscribe(channel: string) {
	const match = channel.match(/^service:logs:(.+):(.+)$/);
	if (!match) return;

	const [, serviceSlug, projectSlug] = match;
	if (activeLogStreams.has(channel)) return;

	startLogStream(channel, serviceSlug, projectSlug);
}

function handleChannelUnsubscribe(channel: string) {
	if (!channel.startsWith("service:logs:")) return;
	if (getChannelSubscriberCount(channel) > 0) return;

	const stop = activeLogStreams.get(channel);
	if (stop) {
		stop();
		activeLogStreams.delete(channel);
	}
}

async function startLogStream(channel: string, serviceSlug: string, projectSlug: string) {
	try {
		// Dynamic imports - may fail in dev mode with Vite
		const k3sModule = await import("@bytesail/core/k3s/client").catch(() => null);
		const logsModule = await import("@bytesail/core/monitoring/logs").catch(() => null);

		if (!k3sModule || !logsModule) {
			console.warn(
				"[ByteSail] Live log streaming unavailable (package resolution failed in dev mode)",
			);
			return;
		}

		const { createK3sClient } = k3sModule;
		const { streamLogs } = logsModule;

		const k3s = createK3sClient();
		const buffer: unknown[] = [];
		let flushTimer: ReturnType<typeof setTimeout> | null = null;

		function flush() {
			if (buffer.length === 0) return;
			const batch = buffer.splice(0, buffer.length);
			broadcast(channel, { type: "log:batch", entries: batch });
			flushTimer = null;
		}

		const stop = await streamLogs(k3s, serviceSlug, projectSlug, (entry) => {
			buffer.push(entry);
			if (!flushTimer) {
				flushTimer = setTimeout(flush, 100);
			}
			if (buffer.length >= 50) {
				if (flushTimer) clearTimeout(flushTimer);
				flush();
			}
		});

		activeLogStreams.set(channel, () => {
			if (flushTimer) clearTimeout(flushTimer);
			stop();
		});
	} catch (e) {
		console.error(`[ByteSail] Failed to start log stream for ${channel}:`, e);
	}
}

export function broadcast(channel: string, data: unknown) {
	const message = JSON.stringify({ channel, data });

	for (const client of clients.values()) {
		if (client.channels.has(channel) && client.ws.readyState === WebSocket.OPEN) {
			client.ws.send(message);
		}
	}
}

export function broadcastAll(data: unknown) {
	const message = JSON.stringify(data);

	for (const client of clients.values()) {
		if (client.ws.readyState === WebSocket.OPEN) {
			client.ws.send(message);
		}
	}
}

export function getClientCount(): number {
	return clients.size;
}
