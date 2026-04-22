import { domains, environments, projects, services } from "@bytesail/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../middleware/auth.js";
import { router } from "../trpc.js";

const BASE_DOMAIN = process.env.BASE_DOMAIN ?? "";

export const domainRouter = router({
	list: protectedProcedure
		.input(z.object({ serviceId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.select().from(domains).where(eq(domains.serviceId, input.serviceId));
		}),

	add: protectedProcedure
		.input(
			z.object({
				serviceId: z.string().uuid(),
				environmentId: z.string().uuid(),
				hostname: z.string().min(1),
				port: z.number().default(80),
				path: z.string().default("/"),
				tlsEnabled: z.boolean().default(true),
				forceHttps: z.boolean().default(true),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [existing] = await ctx.db
				.select()
				.from(domains)
				.where(eq(domains.hostname, input.hostname));

			if (existing) {
				throw new TRPCError({ code: "CONFLICT", message: "Domain already in use" });
			}

			const [domain] = await ctx.db
				.insert(domains)
				.values({
					serviceId: input.serviceId,
					environmentId: input.environmentId,
					hostname: input.hostname,
					port: input.port,
					path: input.path,
					tlsEnabled: input.tlsEnabled,
					forceHttps: input.forceHttps,
					isGenerated: false,
				})
				.returning();

			// Create K8s Ingress
			try {
				const [service] = await ctx.db
					.select()
					.from(services)
					.where(eq(services.id, input.serviceId));
				const [project] = service
					? await ctx.db.select().from(projects).where(eq(projects.id, service.projectId))
					: [null];

				if (service && project) {
					const { createK3sClient } = await import("@bytesail/core/k3s/client");
					const { generateIngressManifest, applyIngress } = await import(
						"@bytesail/core/k3s/ingress"
					);
					const { projectNamespace } = await import("@bytesail/core/k3s/namespaces");

					const k3s = createK3sClient();
					const namespace = projectNamespace(project.id, project.slug);
					const manifest = generateIngressManifest({
						hostname: input.hostname,
						serviceSlug: service.slug,
						namespace,
						port: input.port,
						path: input.path,
						tlsEnabled: input.tlsEnabled,
					});
					await applyIngress(k3s, manifest);
				}
			} catch (e) {
				console.error("[ByteSail] Failed to create ingress:", e);
			}

			return domain;
		}),

	remove: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			// Get domain info before deleting
			const [domainInfo] = await ctx.db.select().from(domains).where(eq(domains.id, input.id));
			if (!domainInfo) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
			}

			// Delete K8s Ingress
			try {
				const [service] = await ctx.db
					.select()
					.from(services)
					.where(eq(services.id, domainInfo.serviceId));
				const [project] = service
					? await ctx.db.select().from(projects).where(eq(projects.id, service.projectId))
					: [null];

				if (service && project) {
					const { createK3sClient } = await import("@bytesail/core/k3s/client");
					const { deleteIngress } = await import("@bytesail/core/k3s/ingress");
					const { projectNamespace } = await import("@bytesail/core/k3s/namespaces");

					const k3s = createK3sClient();
					const namespace = projectNamespace(project.id, project.slug);
					const ingressName = `${service.slug}-${domainInfo.hostname.replace(/\./g, "-")}`;
					await deleteIngress(k3s, ingressName, namespace);
				}
			} catch (e) {
				console.error("[ByteSail] Failed to delete ingress:", e);
			}

			const [domain] = await ctx.db.delete(domains).where(eq(domains.id, input.id)).returning();
			return domain!;
		}),

	generateSubdomain: protectedProcedure
		.input(
			z.object({
				serviceId: z.string().uuid(),
				environmentId: z.string().uuid(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!BASE_DOMAIN) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "BASE_DOMAIN not configured" });
			}

			const [service] = await ctx.db
				.select()
				.from(services)
				.where(eq(services.id, input.serviceId));
			if (!service) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Service not found" });
			}

			const hostname = `${service.slug}.${BASE_DOMAIN}`;

			const [existing] = await ctx.db.select().from(domains).where(eq(domains.hostname, hostname));

			if (existing) return existing;

			const [domain] = await ctx.db
				.insert(domains)
				.values({
					serviceId: input.serviceId,
					environmentId: input.environmentId,
					hostname,
					isGenerated: true,
					tlsEnabled: true,
					forceHttps: true,
				})
				.returning();

			return domain;
		}),
});
