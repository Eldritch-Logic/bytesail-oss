import { createK3sClient } from "@bytesail/core/k3s/client";
import { projectNamespace } from "@bytesail/core/k3s/namespaces";
import { projects, services, volumes } from "@bytesail/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { orgProcedure } from "../middleware/auth.js";
import { router } from "../trpc.js";

export const volumeRouter = router({
	list: orgProcedure
		.input(z.object({ serviceId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.select().from(volumes).where(eq(volumes.serviceId, input.serviceId));
		}),

	create: orgProcedure
		.input(
			z.object({
				serviceId: z.string().uuid(),
				name: z.string().min(1).max(63),
				mountPath: z.string().min(1),
				sizeGb: z.number().min(1).max(100).default(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [svc] = await ctx.db
				.select({ id: services.id, slug: services.slug, projectId: services.projectId })
				.from(services)
				.where(eq(services.id, input.serviceId));
			if (!svc) throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });

			const [project] = await ctx.db
				.select({ id: projects.id, slug: projects.slug })
				.from(projects)
				.where(eq(projects.id, svc.projectId));
			if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

			const pvcName = `${svc.slug}-${input.name}`
				.toLowerCase()
				.replace(/[^a-z0-9-]/g, "-")
				.replace(/-+/g, "-")
				.slice(0, 63);

			const namespace = projectNamespace(project.id, project.slug);

			// Create PVC in K8s
			try {
				const k3s = createK3sClient();
				await k3s.core.createNamespacedPersistentVolumeClaim({
					namespace,
					body: {
						metadata: { name: pvcName, namespace },
						spec: {
							accessModes: ["ReadWriteOnce"],
							storageClassName: "longhorn",
							resources: { requests: { storage: `${input.sizeGb}Gi` } },
						},
					},
				});
			} catch (e) {
				console.error("[ByteSail] Failed to create PVC:", e);
				throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create volume" });
			}

			const [vol] = await ctx.db
				.insert(volumes)
				.values({
					serviceId: input.serviceId,
					name: input.name,
					mountPath: input.mountPath,
					sizeGb: input.sizeGb,
					storageClass: "longhorn",
					k8sPvcName: pvcName,
				})
				.returning();

			return vol;
		}),

	delete: orgProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const [vol] = await ctx.db.select().from(volumes).where(eq(volumes.id, input.id));
			if (!vol) throw new TRPCError({ code: "NOT_FOUND" });

			const [svc] = await ctx.db
				.select({ projectId: services.projectId, slug: services.slug })
				.from(services)
				.where(eq(services.id, vol.serviceId));
			if (!svc) throw new TRPCError({ code: "NOT_FOUND" });

			const [project] = await ctx.db
				.select({ id: projects.id, slug: projects.slug })
				.from(projects)
				.where(eq(projects.id, svc.projectId));
			if (!project) throw new TRPCError({ code: "NOT_FOUND" });

			const namespace = projectNamespace(project.id, project.slug);

			// Delete PVC from K8s
			if (vol.k8sPvcName) {
				try {
					const k3s = createK3sClient();
					await k3s.core.deleteNamespacedPersistentVolumeClaim({
						name: vol.k8sPvcName,
						namespace,
					});
				} catch (e) {
					console.error("[ByteSail] Failed to delete PVC:", e);
				}
			}

			await ctx.db.delete(volumes).where(eq(volumes.id, input.id));
			return { success: true };
		}),
});
