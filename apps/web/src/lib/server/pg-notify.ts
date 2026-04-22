import postgres from "postgres";
import { broadcast } from "./ws.js";

const PG_CHANNEL = "bytesail_events";

let listener: ReturnType<typeof postgres> | null = null;

export async function startPgNotifyBridge() {
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		console.warn("[ByteSail] DATABASE_URL not set, skipping PG NOTIFY bridge");
		return;
	}

	listener = postgres(connectionString, { max: 1 });

	await listener.listen(PG_CHANNEL, (payload) => {
		try {
			const event = JSON.parse(payload);
			if (event.channel && event.data) {
				broadcast(event.channel, event.data);
			}
		} catch {
			// Ignore malformed payloads
		}
	});

	console.log("[ByteSail] PostgreSQL NOTIFY bridge started");
}

export async function stopPgNotifyBridge() {
	if (listener) {
		await listener.end();
		listener = null;
	}
}

export async function pgNotify(channel: string, data: unknown, sql?: ReturnType<typeof postgres>) {
	const db = sql ?? postgres(process.env.DATABASE_URL ?? "", { max: 1 });
	const payload = JSON.stringify({ channel, data });

	await db.notify(PG_CHANNEL, payload);

	if (!sql) await db.end();
}
