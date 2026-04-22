import type { db } from "@bytesail/db";

export type Context = {
	headers: Headers;
	db: typeof db;
};

export function createContext(headers: Headers, database: typeof db): Context {
	return { headers, db: database };
}
