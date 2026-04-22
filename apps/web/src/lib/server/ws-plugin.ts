import type { Plugin } from "vite";

export function webSocketPlugin(): Plugin {
	return {
		name: "bytesail-websocket",
		configureServer(server) {
			server.httpServer?.once("listening", async () => {
				const { createWebSocketServer } = await import("./ws.js");
				createWebSocketServer(server.httpServer!);
				console.log("[ByteSail] WebSocket server attached at /ws");

				const { startPgNotifyBridge } = await import("./pg-notify.js");
				startPgNotifyBridge().catch((e) => {
					console.warn("[ByteSail] PG NOTIFY bridge failed to start:", e);
				});
			});
		},
	};
}
