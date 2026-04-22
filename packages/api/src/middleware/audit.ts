import { auditLogs } from "@bytesail/db/schema";
import { middleware } from "../trpc.js";

export const auditMiddleware = middleware(async ({ ctx, path, type, next }) => {
	const result = await next();

	if (type === "mutation" && result.ok) {
		const userId = "user" in ctx ? (ctx.user as { id: string }).id : undefined;
		const orgId = "organizationId" in ctx ? (ctx.organizationId as string) : undefined;

		try {
			await ctx.db.insert(auditLogs).values({
				userId: userId ?? null,
				organizationId: orgId ?? null,
				action: path,
				resourceType: path.split(".")[0],
				ipAddress: ctx.headers.get("x-forwarded-for") ?? ctx.headers.get("x-real-ip"),
				userAgent: ctx.headers.get("user-agent"),
			});
		} catch (_) {
			// Audit log failure should not break the request
		}
	}

	return result;
});
