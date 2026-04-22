import type { Database } from "@bytesail/db";
import { projects, services, variables } from "@bytesail/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { orgProcedure } from "../middleware/auth.js";
import { router } from "../trpc.js";

async function verifyVariableAccess(db: Database, variableId: string, organizationId: string) {
	const [variable] = await db.select().from(variables).where(eq(variables.id, variableId));
	if (!variable) throw new TRPCError({ code: "NOT_FOUND", message: "Variable not found" });

	const [service] = await db
		.select({ projectId: services.projectId })
		.from(services)
		.where(eq(services.id, variable.serviceId));
	if (!service) throw new TRPCError({ code: "NOT_FOUND" });

	const [project] = await db
		.select({ organizationId: projects.organizationId })
		.from(projects)
		.where(eq(projects.id, service.projectId));
	if (!project || project.organizationId !== organizationId) {
		throw new TRPCError({ code: "FORBIDDEN" });
	}

	return variable;
}

export const variableRouter = router({
	list: orgProcedure
		.input(
			z.object({
				serviceId: z.string().uuid(),
				environmentId: z.string().uuid().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const condition = input.environmentId
				? and(
						eq(variables.serviceId, input.serviceId),
						eq(variables.environmentId, input.environmentId),
					)
				: eq(variables.serviceId, input.serviceId);

			const rows = await ctx.db.select().from(variables).where(condition);

			return rows.map((v) => ({
				...v,
				value: v.isSecret ? "••••••••" : v.value,
			}));
		}),

	set: orgProcedure
		.input(
			z.object({
				serviceId: z.string().uuid(),
				environmentId: z.string().uuid(),
				key: z.string().min(1).max(256),
				value: z.string(),
				isSecret: z.boolean().default(false),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db
				.select()
				.from(variables)
				.where(
					and(
						eq(variables.serviceId, input.serviceId),
						eq(variables.environmentId, input.environmentId),
						eq(variables.key, input.key),
					),
				);

			if (existing.length > 0) {
				const [updated] = await ctx.db
					.update(variables)
					.set({
						value: input.value,
						isSecret: input.isSecret,
						updatedAt: new Date(),
					})
					.where(eq(variables.id, existing[0].id))
					.returning();
				return updated;
			}

			const [created] = await ctx.db
				.insert(variables)
				.values({
					serviceId: input.serviceId,
					environmentId: input.environmentId,
					key: input.key,
					value: input.value,
					isSecret: input.isSecret,
				})
				.returning();
			return created;
		}),

	reveal: orgProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
		const variable = await verifyVariableAccess(ctx.db, input.id, ctx.organizationId);
		return { value: variable.value };
	}),

	delete: orgProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const [deleted] = await ctx.db
				.delete(variables)
				.where(eq(variables.id, input.id))
				.returning();
			if (!deleted) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Variable not found" });
			}
			return deleted;
		}),

	bulkSet: orgProcedure
		.input(
			z.object({
				serviceId: z.string().uuid(),
				environmentId: z.string().uuid(),
				variables: z.array(
					z.object({
						key: z.string().min(1),
						value: z.string(),
						isSecret: z.boolean().default(false),
					}),
				),
				overwrite: z.boolean().default(false),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			let created = 0;
			let updated = 0;
			let skipped = 0;

			for (const v of input.variables) {
				const [existing] = await ctx.db
					.select()
					.from(variables)
					.where(
						and(
							eq(variables.serviceId, input.serviceId),
							eq(variables.environmentId, input.environmentId),
							eq(variables.key, v.key),
						),
					);

				if (existing) {
					if (input.overwrite) {
						await ctx.db
							.update(variables)
							.set({ value: v.value, isSecret: v.isSecret, updatedAt: new Date() })
							.where(eq(variables.id, existing.id));
						updated++;
					} else {
						skipped++;
					}
				} else {
					await ctx.db.insert(variables).values({
						serviceId: input.serviceId,
						environmentId: input.environmentId,
						key: v.key,
						value: v.value,
						isSecret: v.isSecret,
					});
					created++;
				}
			}

			return { created, updated, skipped };
		}),
});
