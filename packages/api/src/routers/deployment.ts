import { triggerDeployment } from "@bytesail/core/deploy/pipeline";
import { deployments, environments, services } from "@bytesail/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../middleware/auth.js";
import { router } from "../trpc.js";

export const deploymentRouter = router({
	list: protectedProcedure
		.input(
			z.object({
				serviceId: z.string().uuid(),
				environmentId: z.string().uuid().optional(),
				limit: z.number().min(1).max(100).default(20),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const conditions = [eq(deployments.serviceId, input.serviceId)];
			if (input.environmentId) {
				conditions.push(eq(deployments.environmentId, input.environmentId));
			}

			return ctx.db
				.select()
				.from(deployments)
				.where(and(...conditions))
				.orderBy(desc(deployments.createdAt))
				.limit(input.limit)
				.offset(input.offset);
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const [deployment] = await ctx.db
				.select()
				.from(deployments)
				.where(eq(deployments.id, input.id));
			if (!deployment) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Deployment not found" });
			}
			return deployment;
		}),

	deploy: protectedProcedure
		.input(
			z.object({
				serviceId: z.string().uuid(),
				environmentId: z.string().uuid().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [service] = await ctx.db
				.select()
				.from(services)
				.where(eq(services.id, input.serviceId));
			if (!service) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
			}

			let environmentId = input.environmentId;
			if (!environmentId) {
				const [defaultEnv] = await ctx.db
					.select()
					.from(environments)
					.where(
						and(eq(environments.projectId, service.projectId), eq(environments.isDefault, true)),
					);
				if (!defaultEnv) {
					throw new TRPCError({ code: "NOT_FOUND", message: "No default environment found" });
				}
				environmentId = defaultEnv.id;
			}

			const deploymentId = await triggerDeployment({
				serviceId: input.serviceId,
				environmentId,
				branch: service.repoBranch ?? "main",
				trigger: "manual",
				triggeredBy: ctx.user.id,
			});

			return { deploymentId };
		}),

	rollback: protectedProcedure
		.input(
			z.object({
				serviceId: z.string().uuid(),
				targetDeploymentId: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [target] = await ctx.db
				.select()
				.from(deployments)
				.where(eq(deployments.id, input.targetDeploymentId));
			if (!target) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Target deployment not found" });
			}

			const deploymentId = await triggerDeployment({
				serviceId: input.serviceId,
				environmentId: target.environmentId,
				commitHash: target.commitHash ?? undefined,
				commitMessage: `Rollback to v${target.version}`,
				branch: target.branch ?? "main",
				trigger: "rollback",
				triggeredBy: ctx.user.id,
			});

			return { deploymentId };
		}),

	getBuildLogs: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const [deployment] = await ctx.db
				.select({ buildLogs: deployments.buildLogs, status: deployments.status })
				.from(deployments)
				.where(eq(deployments.id, input.id));

			if (!deployment) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Deployment not found" });
			}

			// If build is still running and no stored logs yet, try fetching live from K3s
			if (!deployment.buildLogs && deployment.status === "building") {
				try {
					const { getBuildLogs } = await import("@bytesail/core/build/railpacks");
					const liveLogs = await getBuildLogs(input.id);
					return { logs: liveLogs || "Build in progress..." };
				} catch {
					return { logs: "Build in progress..." };
				}
			}

			return { logs: deployment.buildLogs ?? "" };
		}),

	cancel: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const [deployment] = await ctx.db
				.update(deployments)
				.set({ status: "cancelled", completedAt: new Date() })
				.where(and(eq(deployments.id, input.id), eq(deployments.status, "building")))
				.returning();

			if (!deployment) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Deployment cannot be cancelled (not in building state)",
				});
			}

			return deployment;
		}),
});
