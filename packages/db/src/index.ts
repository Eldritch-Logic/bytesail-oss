import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

let _db: ReturnType<typeof drizzle> | null = null;

function createDb() {
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		throw new Error("DATABASE_URL environment variable is required");
	}
	const client = postgres(connectionString);
	return drizzle(client, { schema });
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
	get(_target, prop, receiver) {
		if (!_db) _db = createDb();
		return Reflect.get(_db, prop, receiver);
	},
});

export type Database = ReturnType<typeof drizzle>;
