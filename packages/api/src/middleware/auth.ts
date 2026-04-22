import { auth } from "@bytesail/auth";
import { auditLogs } from "@bytesail/db/schema";
import { TRPCError } from "@trpc/server";
import { middleware, publicProcedure } from "../trpc.js";

const authMiddleware = middleware(async ({ ctx, next }) => {
	const session = await auth.api.getSession({ headers: ctx.headers });
	if (!session) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return next({ ctx: { ...ctx, user: session.user, session: session.session } });
});

const orgMiddleware = middleware(async ({ ctx, next }) => {
	const session = await auth.api.getSession({ headers: ctx.headers });
	if (!session) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}

	const orgId = session.session.activeOrganizationId;
	if (!orgId) {
		throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization" });
	}

	return next({
		ctx: { ...ctx, user: session.user, session: session.session, organizationId: orgId },
	});
});

const adminMiddleware = middleware(async ({ ctx, next }) => {
	const session = await auth.api.getSession({ headers: ctx.headers });
	if (!session) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}

	const orgId = session.session.activeOrganizationId;
	if (!orgId) {
		throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization" });
	}

	const member = await auth.api.getActiveMember({ headers: ctx.headers });
	if (!member || !["owner", "admin"].includes(member.role)) {
		throw new TRPCError({ code: "FORBIDDEN" });
	}

	return next({
		ctx: {
			...ctx,
			user: session.user,
			session: session.session,
			organizationId: orgId,
			member,
		},
	});
});

const bearerMiddleware = middleware(async ({ ctx, next }) => {
	const authHeader = ctx.headers.get("authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}

	const session = await auth.api.getSession({
		headers: ctx.headers,
	});

	if (!session) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid bearer token" });
	}

	return next({
		ctx: { ...ctx, user: session.user, session: session.session },
	});
});

const auditMiddleware = middleware(async ({ ctx, next, type, path }) => {
	const result = await next();

	// Only audit mutations
	if (type === "mutation") {
		try {
			const user = "user" in ctx ? (ctx.user as { id?: string }) : null;
			const pathParts = path.split(".");
			const resourceType = pathParts[0] ?? "unknown";
			const action = pathParts.slice(1).join(".") || "unknown";

			await ctx.db.insert(auditLogs).values({
				userId: user?.id ?? null,
				action: `${resourceType}.${action}`,
				resourceType,
				resourceId: null,
				ipAddress: ctx.headers.get("x-forwarded-for") ?? ctx.headers.get("x-real-ip") ?? null,
				userAgent: ctx.headers.get("user-agent") ?? null,
			});
		} catch {
			// Audit logging should never block the request
		}
	}

	return result;
});

export const protectedProcedure = publicProcedure.use(authMiddleware).use(auditMiddleware);
export const orgProcedure = publicProcedure.use(orgMiddleware).use(auditMiddleware);
export const adminProcedure = publicProcedure.use(adminMiddleware).use(auditMiddleware);
export const bearerProcedure = publicProcedure.use(bearerMiddleware);
