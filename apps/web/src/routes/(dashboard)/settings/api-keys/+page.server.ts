import { auth } from "@bytesail/auth";
import { db } from "@bytesail/db";
import { apikey } from "@bytesail/db/schema";
import { eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) return { keys: [] };

	const keys = await db
		.select({
			id: apikey.id,
			name: apikey.name,
			prefix: apikey.prefix,
			start: apikey.start,
			enabled: apikey.enabled,
			rateLimitEnabled: apikey.rateLimitEnabled,
			rateLimitMax: apikey.rateLimitMax,
			rateLimitTimeWindow: apikey.rateLimitTimeWindow,
			lastRequest: apikey.lastRequest,
			expiresAt: apikey.expiresAt,
			createdAt: apikey.createdAt,
			permissions: apikey.permissions,
		})
		.from(apikey)
		.where(eq(apikey.userId, session.user.id));

	return { keys };
};
