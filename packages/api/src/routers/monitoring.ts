import { projects, services } from "@bytesail/db/schema";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../middleware/auth.js";
import { router } from "../trpc.js";

export const monitoringRouter = router({
	getLogs: protectedProcedure
		.input(
			z.object({
				serviceId: z.string().uuid(),
				query: z.string().optional(),
				start: z.string().optional(),
				end: z.string().optional(),
				limit: z.number().min(1).max(5000).default(500),
				direction: z.enum(["forward", "backward"]).default("backward"),
			}),
		)
		.query(async ({ ctx, input }) => {
			const [service] = await ctx.db
				.select()
				.from(services)
				.where(eq(services.id, input.serviceId));
			if (!service) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
			}

			const [project] = await ctx.db
				.select()
				.from(projects)
				.where(eq(projects.id, service.projectId));
			if (!project) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
			}

			const { queryLogs } = await import("@bytesail/core/monitoring/logs");
			return queryLogs(service.slug, project.id, project.slug, {
				query: input.query,
				start: input.start,
				end: input.end,
				limit: input.limit,
				direction: input.direction,
			});
		}),

	getMetrics: protectedProcedure
		.input(
			z.object({
				serviceId: z.string().uuid(),
				metric: z.enum(["cpu", "memory", "network_rx", "network_tx", "restarts"]),
				start: z.string(),
				end: z.string(),
				step: z.string().default("60s"),
			}),
		)
		.query(async ({ ctx, input }) => {
			const [service] = await ctx.db
				.select()
				.from(services)
				.where(eq(services.id, input.serviceId));
			if (!service) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
			}

			const [project] = await ctx.db
				.select()
				.from(projects)
				.where(eq(projects.id, service.projectId));
			if (!project) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
			}

			const { queryMetrics } = await import("@bytesail/core/monitoring/metrics");
			return queryMetrics(
				service.slug,
				project.id,
				project.slug,
				input.metric,
				input.start,
				input.end,
				input.step,
			);
		}),

	getCurrentMetrics: protectedProcedure
		.input(z.object({ serviceId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const [service] = await ctx.db
				.select()
				.from(services)
				.where(eq(services.id, input.serviceId));
			if (!service) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
			}

			const [project] = await ctx.db
				.select()
				.from(projects)
				.where(eq(projects.id, service.projectId));
			if (!project) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
			}

			const { queryCurrentMetrics } = await import("@bytesail/core/monitoring/metrics");
			return queryCurrentMetrics(service.slug, project.id, project.slug);
		}),

	getSystemOverview: protectedProcedure.query(async () => {
		const { querySystemMetrics } = await import("@bytesail/core/monitoring/metrics");
		return querySystemMetrics();
	}),

	getLogStreamChannel: protectedProcedure
		.input(z.object({ serviceId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const [service] = await ctx.db
				.select()
				.from(services)
				.where(eq(services.id, input.serviceId));
			if (!service) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
			}

			const [project] = await ctx.db
				.select()
				.from(projects)
				.where(eq(projects.id, service.projectId));
			if (!project) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
			}

			return { channel: `service:logs:${service.slug}:${project.slug}` };
		}),
});
