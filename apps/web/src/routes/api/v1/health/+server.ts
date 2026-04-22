import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types.js";

export const GET: RequestHandler = async () => {
	const status = {
		status: "ok",
		version: process.env.BYTESAIL_VERSION ?? "dev",
		timestamp: new Date().toISOString(),
	};

	return json(status);
};
