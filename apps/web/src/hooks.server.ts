import { auth } from "@bytesail/auth";
import { db } from "@bytesail/db";
import { user } from "@bytesail/db/schema";
import type { Handle, HandleServerError } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { sql } from "drizzle-orm";

export const handleError: HandleServerError = async ({ error, event }) => {
	console.error(`[ByteSail Error] ${event.request.method} ${event.url.pathname}:`, error);
	return {
		message: "Internal Server Error",
	};
};

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Better Auth handles /api/auth/* routes
	if (pathname.startsWith("/api/auth")) {
		return svelteKitHandler({ event, resolve, auth });
	}

	// Check if any users exist for setup redirect
	if (pathname !== "/setup" && !pathname.startsWith("/api/")) {
		try {
			const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(user);

			if (count === 0) {
				return new Response(null, {
					status: 303,
					headers: { location: "/setup" },
				});
			}
		} catch {
			// Table may not exist yet, skip check
		}
	}

	// Skip auth check for public routes
	if (pathname === "/setup" || pathname.startsWith("/login") || pathname.startsWith("/register")) {
		return resolve(event);
	}

	return resolve(event);
};
