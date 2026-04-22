import { environments, projects, services } from "@bytesail/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../middleware/auth.js";
import { router } from "../trpc.js";

const createServiceSchema = z.object({
	projectId: z.string().uuid(),
	name: z.string().min(1).max(100),
	slug: z
		.string()
		.min(1)
		.max(100)
		.regex(/^[a-z0-9-]+$/),
	type: z.enum(["app", "database", "redis", "worker", "cron"]),
	sourceType: z.enum(["github", "docker_image", "compose", "template"]),
	repoOwner: z.string().optional(),
	repoName: z.string().optional(),
	repoBranch: z.string().optional(),
	repoSubdirectory: z.string().optional(),
	gitProviderId: z.string().uuid().optional(),
	dockerImage: z.string().optional(),
	dockerTag: z.string().optional(),
	buildType: z.enum(["railpacks", "dockerfile", "docker_image"]).optional(),
	autoDeploy: z.boolean().optional(),
});

const updateServiceSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(100).optional(),
	repoBranch: z.string().optional(),
	repoSubdirectory: z.string().optional(),
	autoDeploy: z.boolean().optional(),
	buildType: z.enum(["railpacks", "dockerfile", "docker_image"]).optional(),
	dockerfilePath: z.string().optional(),
	buildArgs: z.record(z.string()).optional(),
	replicas: z.number().min(0).max(10).optional(),
	cpuLimit: z.string().optional(),
	memoryLimit: z.string().optional(),
	cpuRequest: z.string().optional(),
	memoryRequest: z.string().optional(),
	command: z.string().optional(),
	healthCheckPath: z.string().optional(),
	healthCheckPort: z.number().optional(),
	healthCheckInterval: z.number().optional(),
	restartPolicy: z.enum(["always", "on-failure", "never"]).optional(),
});

export const serviceRouter = router({
	list: protectedProcedure
		.input(z.object({ projectId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.select().from(services).where(eq(services.projectId, input.projectId));
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const [service] = await ctx.db.select().from(services).where(eq(services.id, input.id));
			if (!service) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
			}
			return service;
		}),

	getStatus: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const [service] = await ctx.db
				.select({ status: services.status, replicas: services.replicas })
				.from(services)
				.where(eq(services.id, input.id));
			if (!service) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
			}
			return service;
		}),

	create: protectedProcedure.input(createServiceSchema).mutation(async ({ ctx, input }) => {
		const [service] = await ctx.db
			.insert(services)
			.values({
				projectId: input.projectId,
				name: input.name,
				slug: input.slug,
				type: input.type,
				sourceType: input.sourceType,
				gitProviderId: input.gitProviderId,
				repoOwner: input.repoOwner,
				repoName: input.repoName,
				repoBranch: input.repoBranch ?? "main",
				repoSubdirectory: input.repoSubdirectory,
				dockerImage: input.dockerImage,
				dockerTag: input.dockerTag,
				buildType: input.buildType ?? "railpacks",
				autoDeploy: input.autoDeploy ?? true,
			})
			.returning();
		return service;
	}),

	update: protectedProcedure.input(updateServiceSchema).mutation(async ({ ctx, input }) => {
		const { id, ...updates } = input;
		const setValues: Record<string, unknown> = { updatedAt: new Date() };
		for (const [key, value] of Object.entries(updates)) {
			if (value !== undefined) setValues[key] = value;
		}

		const [service] = await ctx.db
			.update(services)
			.set(setValues)
			.where(eq(services.id, id))
			.returning();
		if (!service) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
		}
		return service;
	}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			// Get service info before deletion for K8s cleanup
			const [svc] = await ctx.db.select().from(services).where(eq(services.id, input.id));
			if (!svc) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
			}

			// Clean up K8s resources
			try {
				const [project] = await ctx.db
					.select()
					.from(projects)
					.where(eq(projects.id, svc.projectId));

				if (project) {
					const { createK3sClient } = await import("@bytesail/core/k3s/client");
					const { deleteDeployment } = await import("@bytesail/core/k3s/deployments");
					const { deleteService: deleteK3sSvc } = await import("@bytesail/core/k3s/services");
					const { projectNamespace } = await import("@bytesail/core/k3s/namespaces");

					const k3s = createK3sClient();
					const namespace = projectNamespace(project.id, project.slug);

					try {
						await deleteDeployment(k3s, `${svc.slug}-production`, namespace);
					} catch {}
					try {
						await deleteK3sSvc(k3s, svc.slug, namespace);
					} catch {}

					// Delete PVCs
					const vols = (svc.volumeMounts as Array<{ name: string }>) ?? [];
					for (const vol of vols) {
						try {
							await k3s.core.deleteNamespacedPersistentVolumeClaim({ name: vol.name, namespace });
						} catch {}
					}
				}
			} catch (e) {
				console.error("[ByteSail] Failed to clean up K8s resources:", e);
			}

			// Delete from DB
			await ctx.db.delete(services).where(eq(services.id, input.id));
			return svc;
		}),

	restart: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const [service] = await ctx.db
				.update(services)
				.set({ updatedAt: new Date() })
				.where(eq(services.id, input.id))
				.returning();
			if (!service) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
			}
			// K3s rolling restart will be triggered here when K3s integration is wired up
			return service;
		}),

	scale: protectedProcedure
		.input(z.object({ id: z.string().uuid(), replicas: z.number().min(0).max(10) }))
		.mutation(async ({ ctx, input }) => {
			const [service] = await ctx.db
				.update(services)
				.set({ replicas: input.replicas, updatedAt: new Date() })
				.where(eq(services.id, input.id))
				.returning();
			if (!service) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
			}
			return service;
		}),

	syncStatuses: protectedProcedure
		.input(z.object({ projectId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const [project] = await ctx.db
				.select()
				.from(projects)
				.where(eq(projects.id, input.projectId));
			if (!project) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
			}

			try {
				const { createK3sClient } = await import("@bytesail/core/k3s/client");
				const { getProjectPodStatuses } = await import("@bytesail/core/k3s/status");
				const k3s = createK3sClient();
				const podStatuses = await getProjectPodStatuses(k3s, project.id, project.slug);

				const projectServices = await ctx.db
					.select()
					.from(services)
					.where(eq(services.projectId, input.projectId));

				for (const svc of projectServices) {
					const pod = podStatuses.find((p) => p.serviceSlug === svc.slug);
					const newStatus = pod?.status ?? "stopped";
					if (svc.status !== newStatus) {
						await ctx.db
							.update(services)
							.set({ status: newStatus, updatedAt: new Date() })
							.where(eq(services.id, svc.id));
					}
				}

				return podStatuses;
			} catch (e) {
				console.error("[ByteSail] Failed to sync K3s statuses:", e);
				return [];
			}
		}),
});
