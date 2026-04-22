import { writable } from "svelte/store";
import { browser } from "$app/environment";

type WsMessage = {
	channel?: string;
	type?: string;
	data?: unknown;
	[key: string]: unknown;
};

type WsState = {
	connected: boolean;
};

type MessageHandler = (data: unknown) => void;

const RECONNECT_INTERVAL = 3_000;
const MAX_RECONNECT_INTERVAL = 30_000;

function createWebSocketStore() {
	const { subscribe, set } = writable<WsState>({ connected: false });
	const handlers = new Map<string, Set<MessageHandler>>();

	let ws: WebSocket | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let reconnectDelay = RECONNECT_INTERVAL;
	let subscribedChannels = new Set<string>();

	function getWsUrl(): string {
		const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
		return `${proto}//${window.location.host}/ws`;
	}

	function connect() {
		if (!browser) return;
		if (ws?.readyState === WebSocket.OPEN) return;

		try {
			ws = new WebSocket(getWsUrl());
		} catch {
			scheduleReconnect();
			return;
		}

		ws.onopen = () => {
			set({ connected: true });
			reconnectDelay = RECONNECT_INTERVAL;

			for (const channel of subscribedChannels) {
				ws?.send(JSON.stringify({ type: "subscribe", channel }));
			}
		};

		ws.onmessage = (event) => {
			try {
				const msg: WsMessage = JSON.parse(event.data);
				const channel = msg.channel;

				if (channel && handlers.has(channel)) {
					for (const handler of handlers.get(channel)!) {
						handler(msg.data ?? msg);
					}
				}

				if (msg.type && handlers.has(msg.type)) {
					for (const handler of handlers.get(msg.type)!) {
						handler(msg);
					}
				}
			} catch {
				// Ignore parse errors
			}
		};

		ws.onclose = () => {
			set({ connected: false });
			ws = null;
			scheduleReconnect();
		};

		ws.onerror = () => {
			ws?.close();
		};
	}

	function scheduleReconnect() {
		if (reconnectTimer) return;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_INTERVAL);
			connect();
		}, reconnectDelay);
	}

	function subscribeChannel(channel: string, handler: MessageHandler): () => void {
		subscribedChannels.add(channel);

		if (!handlers.has(channel)) {
			handlers.set(channel, new Set());
		}
		handlers.get(channel)!.add(handler);

		if (ws?.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ type: "subscribe", channel }));
		}

		connect();

		return () => {
			const channelHandlers = handlers.get(channel);
			if (channelHandlers) {
				channelHandlers.delete(handler);
				if (channelHandlers.size === 0) {
					handlers.delete(channel);
					subscribedChannels.delete(channel);
					if (ws?.readyState === WebSocket.OPEN) {
						ws.send(JSON.stringify({ type: "unsubscribe", channel }));
					}
				}
			}
		};
	}

	function disconnect() {
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		ws?.close();
		ws = null;
		subscribedChannels = new Set();
		handlers.clear();
		set({ connected: false });
	}

	return {
		subscribe,
		connect,
		disconnect,
		subscribeChannel,
	};
}

export const wsStore = createWebSocketStore();
