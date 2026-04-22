import { appRouter } from "@bytesail/api";
import { createContext } from "@bytesail/api/context";
import { db } from "@bytesail/db";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { RequestHandler } from "./$types.js";

const handler: RequestHandler = async ({ request }) => {
	return fetchRequestHandler({
		endpoint: "/api/trpc",
		req: request,
		router: appRouter,
		createContext: () => createContext(request.headers, db),
	});
};

export const GET = handler;
export const POST = handler;
