import { environments, projects, services } from "@bytesail/db/schema";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../middleware/auth.js";
import { router } from "../trpc.js";

export const projectRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.select().from(projects);
	}),

	getById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const [project] = await ctx.db
				.select({
					project: projects,
					serviceCount: sql<number>`count(${services.id})::int`,
				})
				.from(projects)
				.leftJoin(services, eq(services.projectId, projects.id))
				.where(eq(projects.id, input.id))
				.groupBy(projects.id);

			if (!project) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
			}
			return { ...project.project, serviceCount: project.serviceCount };
		}),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
				slug: z
					.string()
					.min(1)
					.max(100)
					.regex(/^[a-z0-9-]+$/),
				description: z.string().max(500).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [project] = await ctx.db
				.insert(projects)
				.values({
					organizationId: ctx.user.id,
					name: input.name,
					slug: input.slug,
					description: input.description,
				})
				.returning();

			await ctx.db.insert(environments).values({
				projectId: project.id,
				name: "Production",
				slug: "production",
				type: "production",
				isDefault: true,
			});

			return project;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				name: z.string().min(1).max(100).optional(),
				description: z.string().max(500).optional(),
				canvasState: z.any().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [project] = await ctx.db
				.update(projects)
				.set({
					...(input.name !== undefined && { name: input.name }),
					...(input.description !== undefined && { description: input.description }),
					...(input.canvasState !== undefined && { canvasState: input.canvasState }),
					updatedAt: new Date(),
				})
				.where(eq(projects.id, input.id))
				.returning();

			if (!project) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
			}
			return project;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const [project] = await ctx.db.delete(projects).where(eq(projects.id, input.id)).returning();

			if (!project) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
			}
			return project;
		}),
});
