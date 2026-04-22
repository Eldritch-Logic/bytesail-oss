import { deployments, domains, environments, variables } from "@bytesail/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../middleware/auth.js";
import { router } from "../trpc.js";

export const environmentRouter = router({
	list: protectedProcedure
		.input(z.object({ projectId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.select().from(environments).where(eq(environments.projectId, input.projectId));
		}),

	create: protectedProcedure
		.input(
			z.object({
				projectId: z.string().uuid(),
				name: z.string().min(1).max(100),
				slug: z
					.string()
					.min(1)
					.max(100)
					.regex(/^[a-z0-9-]+$/),
				type: z.enum(["production", "staging", "preview", "development"]),
				prNumber: z.number().optional(),
				prBranch: z.string().optional(),
				autoDestroy: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [env] = await ctx.db
				.insert(environments)
				.values({
					projectId: input.projectId,
					name: input.name,
					slug: input.slug,
					type: input.type,
					prNumber: input.prNumber,
					prBranch: input.prBranch,
					autoDestroy: input.autoDestroy,
				})
				.returning();
			return env;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			// Delete scoped resources first
			await ctx.db.delete(variables).where(eq(variables.environmentId, input.id));
			await ctx.db.delete(domains).where(eq(domains.environmentId, input.id));
			await ctx.db.delete(deployments).where(eq(deployments.environmentId, input.id));

			const [env] = await ctx.db
				.delete(environments)
				.where(eq(environments.id, input.id))
				.returning();

			if (!env) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Environment not found" });
			}
			return env;
		}),

	setDefault: protectedProcedure
		.input(z.object({ id: z.string().uuid(), projectId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			// Unset current default
			await ctx.db
				.update(environments)
				.set({ isDefault: false })
				.where(eq(environments.projectId, input.projectId));

			// Set new default
			const [env] = await ctx.db
				.update(environments)
				.set({ isDefault: true })
				.where(eq(environments.id, input.id))
				.returning();

			if (!env) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Environment not found" });
			}
			return env;
		}),
});
