import { checkForUpdates } from "@bytesail/core/update/checker";
import { performUpdate } from "@bytesail/core/update/pipeline";
import { auditLogs, systemSettings } from "@bytesail/db/schema";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, protectedProcedure } from "../middleware/auth.js";
import { router } from "../trpc.js";

// Keys whose values contain secrets that must be scrubbed from API responses
const SENSITIVE_KEYS = new Set(["github_app"]);
const SENSITIVE_FIELDS = ["privateKey", "clientSecret", "webhookSecret", "password", "secret"];

function scrubSecrets(setting: { key: string; value: unknown } | null) {
	if (!setting || !SENSITIVE_KEYS.has(setting.key)) return setting;
	if (typeof setting.value !== "object" || !setting.value) return setting;

	const scrubbed = { ...setting.value } as Record<string, unknown>;
	for (const field of SENSITIVE_FIELDS) {
		if (field in scrubbed) {
			scrubbed[field] = "••••••••";
		}
	}
	return { ...setting, value: scrubbed };
}

export const settingsRouter = router({
	get: adminProcedure.input(z.object({ key: z.string() })).query(async ({ ctx, input }) => {
		const [setting] = await ctx.db
			.select()
			.from(systemSettings)
			.where(eq(systemSettings.key, input.key));
		return scrubSecrets(setting) ?? null;
	}),

	set: adminProcedure
		.input(z.object({ key: z.string(), value: z.any() }))
		.mutation(async ({ ctx, input }) => {
			const [setting] = await ctx.db
				.insert(systemSettings)
				.values({ key: input.key, value: input.value, updatedAt: new Date() })
				.onConflictDoUpdate({
					target: systemSettings.key,
					set: { value: input.value, updatedAt: new Date() },
				})
				.returning();
			return setting;
		}),

	delete: adminProcedure.input(z.object({ key: z.string() })).mutation(async ({ ctx, input }) => {
		const [setting] = await ctx.db
			.delete(systemSettings)
			.where(eq(systemSettings.key, input.key))
			.returning();
		if (!setting) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Setting not found" });
		}
		return setting;
	}),

	list: adminProcedure.query(async ({ ctx }) => {
		const rows = await ctx.db.select().from(systemSettings);
		return rows.map((r) => scrubSecrets(r)!);
	}),

	getUpdateStatus: protectedProcedure.query(async ({ ctx }) => {
		const [version] = await ctx.db
			.select()
			.from(systemSettings)
			.where(eq(systemSettings.key, "version"));
		const [updateAvailable] = await ctx.db
			.select()
			.from(systemSettings)
			.where(eq(systemSettings.key, "update_available"));
		const [updateHistory] = await ctx.db
			.select()
			.from(systemSettings)
			.where(eq(systemSettings.key, "update_history"));

		return {
			currentVersion:
				(version?.value as { current: string })?.current ?? process.env.BYTESAIL_VERSION ?? "dev",
			updateAvailable: updateAvailable?.value ?? null,
			updateHistory: (updateHistory?.value as unknown[]) ?? [],
		};
	}),

	applyUpdate: adminProcedure
		.input(z.object({ targetVersion: z.string() }))
		.mutation(async ({ input }) => {
			performUpdate(input.targetVersion).catch(() => {});
			return { started: true };
		}),

	checkForUpdates: adminProcedure.mutation(async () => {
		const result = await checkForUpdates();
		return { updateAvailable: result };
	}),

	getAuditLogs: adminProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(100).default(50),
				offset: z.number().min(0).default(0),
				action: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			let query = ctx.db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));

			if (input.action) {
				query = query.where(eq(auditLogs.action, input.action)) as typeof query;
			}

			const rows = await query.limit(input.limit).offset(input.offset);
			return rows;
		}),
});
