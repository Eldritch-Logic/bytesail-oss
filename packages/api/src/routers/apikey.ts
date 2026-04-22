import { createHash, randomBytes } from "node:crypto";
import { apikey } from "@bytesail/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../middleware/auth.js";
import { router } from "../trpc.js";

function generateApiKey(): { raw: string; hash: string; prefix: string; start: string } {
	const raw = `bs_${randomBytes(32).toString("hex")}`;
	const hash = createHash("sha256").update(raw).digest("hex");
	const prefix = raw.slice(0, 7);
	const start = raw.slice(0, 12);
	return { raw, hash, prefix, start };
}

export const apikeyRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db
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
			.where(eq(apikey.userId, ctx.user.id));
	}),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
				expiresIn: z.enum(["never", "30d", "90d", "1y", "custom"]).default("never"),
				customExpiry: z.string().datetime().optional(),
				permissions: z
					.object({
						project: z.array(z.enum(["read", "write", "delete"])).default(["read"]),
						service: z.array(z.enum(["read", "write", "delete"])).default(["read"]),
						deploy: z.array(z.enum(["read", "write"])).default(["read"]),
						settings: z.array(z.enum(["read", "write"])).default(["read"]),
					})
					.optional(),
				rateLimitEnabled: z.boolean().default(false),
				rateLimitMax: z.number().min(1).max(10000).optional(),
				rateLimitTimeWindow: z.number().min(1).max(3600).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { raw, hash, prefix, start } = generateApiKey();

			let expiresAt: Date | null = null;
			if (input.expiresIn === "30d") expiresAt = new Date(Date.now() + 30 * 86400000);
			else if (input.expiresIn === "90d") expiresAt = new Date(Date.now() + 90 * 86400000);
			else if (input.expiresIn === "1y") expiresAt = new Date(Date.now() + 365 * 86400000);
			else if (input.expiresIn === "custom" && input.customExpiry)
				expiresAt = new Date(input.customExpiry);

			const id = randomBytes(16).toString("hex");

			const [created] = await ctx.db
				.insert(apikey)
				.values({
					id,
					name: input.name,
					key: hash,
					prefix,
					start,
					userId: ctx.user.id,
					enabled: true,
					expiresAt,
					permissions: input.permissions ? JSON.stringify(input.permissions) : null,
					rateLimitEnabled: input.rateLimitEnabled,
					rateLimitMax: input.rateLimitMax ?? null,
					rateLimitTimeWindow: input.rateLimitTimeWindow ?? null,
				})
				.returning({
					id: apikey.id,
					name: apikey.name,
					prefix: apikey.prefix,
					start: apikey.start,
					createdAt: apikey.createdAt,
				});

			return { ...created, key: raw };
		}),

	toggle: protectedProcedure
		.input(z.object({ id: z.string(), enabled: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			const [updated] = await ctx.db
				.update(apikey)
				.set({ enabled: input.enabled, updatedAt: new Date() })
				.where(and(eq(apikey.id, input.id), eq(apikey.userId, ctx.user.id)))
				.returning();
			if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const [deleted] = await ctx.db
				.delete(apikey)
				.where(and(eq(apikey.id, input.id), eq(apikey.userId, ctx.user.id)))
				.returning();
			if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
			return { success: true };
		}),
});
