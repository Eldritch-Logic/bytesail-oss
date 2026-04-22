import {
	composeStacks,
	environments,
	serviceDependencies,
	services,
	variables,
} from "@bytesail/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import yaml from "js-yaml";
import { z } from "zod";
import { protectedProcedure } from "../middleware/auth.js";
import { router } from "../trpc.js";
import { detectPort, detectServiceType } from "./compose-utils.js";

export { detectPort, detectServiceType } from "./compose-utils.js";

type ParsedCompose = {
	services?: Record<
		string,
		{
			image?: string;
			ports?: Array<string | number>;
			build?: unknown;
			depends_on?: string[] | Record<string, unknown>;
			environment?: Record<string, string> | string[];
			volumes?: string[];
			healthcheck?: {
				test?: string | string[];
				interval?: string;
				timeout?: string;
				retries?: number;
				start_period?: string;
			};
		}
	>;
};

async function syncServicesAndDeps(
	db: import("@bytesail/db").Database,
	projectId: string,
	stackId: string,
	composeFile: string,
	envFile?: string,
) {
	// Preserve existing variable values before deletion
	const previousVarsBySlug = new Map<string, Map<string, { value: string; isSecret: boolean }>>();
	const stackServices = await db
		.select({ id: services.id, slug: services.slug })
		.from(services)
		.where(eq(services.composeStackId, stackId));
	const stackServiceIds = stackServices.map((s) => s.id);

	for (const svc of stackServices) {
		const existingVars = await db
			.select({ key: variables.key, value: variables.value, isSecret: variables.isSecret })
			.from(variables)
			.where(eq(variables.serviceId, svc.id));
		const varMap = new Map<string, { value: string; isSecret: boolean }>();
		for (const v of existingVars) {
			varMap.set(v.key, { value: v.value, isSecret: v.isSecret ?? false });
		}
		// Store by service name (slug matches the YAML service name after normalization)
		previousVarsBySlug.set(svc.slug, varMap);
	}

	if (stackServiceIds.length > 0) {
		for (const svcId of stackServiceIds) {
			await db
				.delete(serviceDependencies)
				.where(
					and(
						eq(serviceDependencies.projectId, projectId),
						eq(serviceDependencies.fromServiceId, svcId),
					),
				);
			await db
				.delete(serviceDependencies)
				.where(
					and(
						eq(serviceDependencies.projectId, projectId),
						eq(serviceDependencies.toServiceId, svcId),
					),
				);
		}
		await db.delete(services).where(eq(services.composeStackId, stackId));
	}

	const parsed = yaml.load(composeFile) as ParsedCompose;
	if (!parsed?.services) return;

	// Parse .env file values for variable interpolation
	const envFileVars = new Map<string, string>();
	if (envFile) {
		for (const line of envFile.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const eqIdx = trimmed.indexOf("=");
			if (eqIdx > 0) {
				envFileVars.set(trimmed.slice(0, eqIdx).trim(), trimmed.slice(eqIdx + 1).trim());
			}
		}
	}

	// Get or create default environment
	let [defaultEnv] = await db
		.select()
		.from(environments)
		.where(and(eq(environments.projectId, projectId), eq(environments.isDefault, true)));

	if (!defaultEnv) {
		[defaultEnv] = await db
			.insert(environments)
			.values({
				projectId,
				name: "Production",
				slug: "production",
				type: "production",
				isDefault: true,
			})
			.returning();
	}

	// First pass: collect ALL env vars across all services to build resolution map
	const allVarValues = new Map<string, string>(envFileVars);
	for (const [, svcConfig] of Object.entries(parsed.services)) {
		const envVars = svcConfig.environment;
		if (!envVars) continue;
		if (Array.isArray(envVars)) {
			for (const entry of envVars) {
				const eqIdx = entry.indexOf("=");
				if (eqIdx > 0) {
					const k = entry.slice(0, eqIdx);
					const v = entry.slice(eqIdx + 1);
					if (!v.includes("${") && !allVarValues.has(k)) {
						allVarValues.set(k, v);
					}
				}
			}
		} else {
			for (const [k, v] of Object.entries(envVars)) {
				const val = String(v ?? "");
				if (!val.includes("${") && !allVarValues.has(k)) {
					allVarValues.set(k, val);
				}
			}
		}
	}

	// Build service name → K8s slug mapping for hostname replacement
	const serviceSlugMap = new Map<string, string>();
	for (const svcName of Object.keys(parsed.services)) {
		const slug = svcName
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, "-")
			.replace(/-+/g, "-");
		if (slug !== svcName) {
			serviceSlugMap.set(svcName, slug);
		}
	}

	function resolveVarRefs(value: string): string {
		let resolved = value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
			return allVarValues.get(varName) ?? match;
		});
		// Replace compose service names with K8s-compatible slugs in hostnames
		for (const [name, slug] of serviceSlugMap) {
			resolved = resolved.replaceAll(name, slug);
		}
		return resolved;
	}

	const serviceMap = new Map<string, string>();

	for (const [svcName, svcConfig] of Object.entries(parsed.services)) {
		const slug = svcName
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, "-")
			.replace(/-+/g, "-");

		// Parse healthcheck from compose
		const hc = svcConfig.healthcheck;
		let healthCheckPath: string | undefined;
		let healthCheckPort: number | undefined;
		let healthCheckInterval: number | undefined;

		if (hc?.test) {
			const testCmd = Array.isArray(hc.test) ? hc.test.join(" ") : hc.test;
			// Extract HTTP path from curl/wget commands
			const httpMatch = testCmd.match(
				/(?:curl|wget).*(?:localhost|127\.0\.0\.1):?(\d+)?(\/[^\s]*)?/,
			);
			if (httpMatch) {
				healthCheckPort = httpMatch[1] ? Number.parseInt(httpMatch[1]) : undefined;
				healthCheckPath = httpMatch[2] ?? "/";
			}
			if (hc.interval) {
				const intervalMatch = hc.interval.match(/(\d+)/);
				if (intervalMatch) healthCheckInterval = Number.parseInt(intervalMatch[1]);
			}
		}

		// Parse volume mounts (named_volume:/container/path format)
		const volumeMounts = (svcConfig.volumes ?? [])
			.map((v) => {
				const parts = String(v).split(":");
				if (parts.length < 2) return null;
				// Skip bind mounts (start with . or /)
				if (parts[0].startsWith(".") || parts[0].startsWith("/")) return null;
				const volName = parts[0]
					.toLowerCase()
					.replace(/[^a-z0-9-]/g, "-")
					.replace(/-+/g, "-");
				return { name: `${slug}-${volName}`, mountPath: parts[1], size: "1Gi" };
			})
			.filter(Boolean) as Array<{ name: string; mountPath: string; size: string }>;

		const [created] = await db
			.insert(services)
			.values({
				projectId,
				composeStackId: stackId,
				name: svcName,
				slug,
				type: detectServiceType(svcName, svcConfig.image),
				sourceType: svcConfig.image ? "docker_image" : "compose",
				dockerImage: svcConfig.image?.split(":")[0],
				dockerTag: svcConfig.image?.includes(":") ? svcConfig.image.split(":")[1] : "latest",
				buildType: svcConfig.image ? "docker_image" : "railpacks",
				port: detectPort(svcConfig.image, svcConfig.ports),
				volumeMounts: volumeMounts.length > 0 ? volumeMounts : undefined,
				healthCheckPath: healthCheckPath,
				healthCheckPort: healthCheckPort,
				healthCheckInterval: healthCheckInterval,
			})
			.returning();

		serviceMap.set(svcName, created.id);

		// Save environment variables for this service
		const envVars = svcConfig.environment;
		if (envVars && defaultEnv) {
			const entries: Array<{ key: string; value: string }> = [];

			if (Array.isArray(envVars)) {
				for (const entry of envVars) {
					const eqIdx = entry.indexOf("=");
					if (eqIdx > 0) {
						entries.push({ key: entry.slice(0, eqIdx), value: entry.slice(eqIdx + 1) });
					} else {
						entries.push({ key: entry, value: "" });
					}
				}
			} else {
				for (const [key, val] of Object.entries(envVars)) {
					entries.push({ key, value: String(val ?? "") });
				}
			}

			// Check if this service had variables before (from a previous sync)
			// by looking at the previousVars map built before deletion
			const previousVarsForService =
				previousVarsBySlug.get(slug) ?? new Map<string, { value: string; isSecret: boolean }>();

			for (const { key, value } of entries) {
				// Resolve ${VAR} references from .env file and other compose variables
				const resolved = resolveVarRefs(value);

				// Preserve user-edited values: if the key existed before and was modified
				// from the compose default, keep the user's value
				const previous = previousVarsForService.get(key);
				const finalValue = previous ? previous.value : resolved;

				const isSecret = previous
					? previous.isSecret
					: /password|secret|key|token/i.test(key) || /password|secret|key|token/i.test(value);

				await db.insert(variables).values({
					serviceId: created.id,
					environmentId: defaultEnv.id,
					key,
					value: finalValue,
					isSecret,
				});
			}
		}
	}

	// Build connections based on environment variable cross-references
	// If service A's env var value contains service B's name, they're connected
	const connectedPairs = new Set<string>();

	for (const [svcName, svcConfig] of Object.entries(parsed.services)) {
		const fromId = serviceMap.get(svcName);
		if (!fromId) continue;

		const envVars = svcConfig.environment;
		if (!envVars) continue;

		const envEntries: Array<{ key: string; value: string }> = [];
		if (Array.isArray(envVars)) {
			for (const entry of envVars) {
				const eqIdx = entry.indexOf("=");
				if (eqIdx > 0) {
					envEntries.push({ key: entry.slice(0, eqIdx), value: entry.slice(eqIdx + 1) });
				}
			}
		} else {
			for (const [key, val] of Object.entries(envVars)) {
				envEntries.push({ key, value: String(val ?? "") });
			}
		}

		for (const [otherName, otherId] of serviceMap) {
			if (otherName === svcName) continue;
			const pairKey = [fromId, otherId].sort().join(":");
			if (connectedPairs.has(pairKey)) continue;

			const matchingVars = envEntries.filter((e) => e.value && e.value.includes(otherName));

			if (matchingVars.length > 0) {
				connectedPairs.add(pairKey);

				await db.insert(serviceDependencies).values({
					projectId,
					fromServiceId: fromId,
					toServiceId: otherId,
					dependencyType: "env_reference",
					label: matchingVars.map((v) => v.key).join(", "),
				});
			}
		}
	}
}

export const composeRouter = router({
	list: protectedProcedure
		.input(z.object({ projectId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			return ctx.db
				.select()
				.from(composeStacks)
				.where(eq(composeStacks.projectId, input.projectId));
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const [stack] = await ctx.db
				.select()
				.from(composeStacks)
				.where(eq(composeStacks.id, input.id));
			if (!stack) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Compose stack not found" });
			}
			return stack;
		}),

	create: protectedProcedure
		.input(
			z.object({
				projectId: z.string().uuid(),
				name: z.string().min(1).max(100),
				composeFile: z.string(),
				envFile: z.string().optional(),
				sourceType: z.enum(["inline", "github"]).default("inline"),
				gitProviderId: z.string().uuid().optional(),
				repoOwner: z.string().optional(),
				repoName: z.string().optional(),
				repoBranch: z.string().optional(),
				composePath: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const [stack] = await ctx.db
				.insert(composeStacks)
				.values({
					projectId: input.projectId,
					name: input.name,
					composeFile: input.composeFile,
					envFile: input.envFile,
					sourceType: input.sourceType,
					gitProviderId: input.gitProviderId,
					repoOwner: input.repoOwner,
					repoName: input.repoName,
					repoBranch: input.repoBranch,
					composePath: input.composePath,
				})
				.returning();

			try {
				await syncServicesAndDeps(
					ctx.db,
					input.projectId,
					stack.id,
					input.composeFile,
					input.envFile,
				);
			} catch (e) {
				console.error("[ByteSail] Failed to parse compose services:", e);
			}

			return stack;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				composeFile: z.string().optional(),
				envFile: z.string().optional(),
				name: z.string().min(1).max(100).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { id, ...updates } = input;
			const setValues: Record<string, unknown> = { updatedAt: new Date() };
			for (const [key, value] of Object.entries(updates)) {
				if (value !== undefined) setValues[key] = value;
			}

			const [stack] = await ctx.db
				.update(composeStacks)
				.set(setValues)
				.where(eq(composeStacks.id, id))
				.returning();

			if (!stack) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Compose stack not found" });
			}

			if (input.composeFile && input.composeFile.trim()) {
				try {
					await syncServicesAndDeps(
						ctx.db,
						stack.projectId,
						stack.id,
						input.composeFile,
						input.envFile ?? stack.envFile ?? undefined,
					);
				} catch (e) {
					console.error("[ByteSail] Failed to sync compose services:", e);
				}
			}

			return stack;
		}),

	deploy: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const [stack] = await ctx.db
				.select()
				.from(composeStacks)
				.where(eq(composeStacks.id, input.id));

			if (!stack) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Compose stack not found" });
			}

			await ctx.db
				.update(composeStacks)
				.set({ status: "deploying", lastDeployedAt: new Date(), updatedAt: new Date() })
				.where(eq(composeStacks.id, input.id));

			const projectServices = await ctx.db
				.select()
				.from(services)
				.where(eq(services.projectId, stack.projectId));

			const { triggerDeployment } = await import("@bytesail/core/deploy/pipeline");
			const { environments } = await import("@bytesail/db/schema");
			const { and: andOp } = await import("drizzle-orm");

			const [defaultEnv] = await ctx.db
				.select()
				.from(environments)
				.where(
					andOp(eq(environments.projectId, stack.projectId), eq(environments.isDefault, true)),
				);

			if (defaultEnv) {
				// Deploy in order: databases/redis first, then apps
				const infra = projectServices.filter((s) => s.type === "database" || s.type === "redis");
				const apps = projectServices.filter((s) => s.type !== "database" && s.type !== "redis");

				// Deploy infrastructure services first and wait for them
				for (const svc of infra) {
					try {
						await triggerDeployment({
							serviceId: svc.id,
							environmentId: defaultEnv.id,
							trigger: "compose",
						});
					} catch (e) {
						console.error(`[ByteSail] Failed to deploy infra service ${svc.name}:`, e);
					}
				}

				// Wait for infrastructure to be ready before deploying apps
				if (infra.length > 0) {
					await new Promise((r) => setTimeout(r, 5000));
				}

				// Deploy application services
				for (const svc of apps) {
					try {
						await triggerDeployment({
							serviceId: svc.id,
							environmentId: defaultEnv.id,
							trigger: "compose",
						});
					} catch (e) {
						console.error(`[ByteSail] Failed to deploy app service ${svc.name}:`, e);
					}
				}
			}

			await ctx.db
				.update(composeStacks)
				.set({ status: "running", updatedAt: new Date() })
				.where(eq(composeStacks.id, input.id));

			return stack;
		}),

	stop: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const [stack] = await ctx.db
				.update(composeStacks)
				.set({ status: "stopped", updatedAt: new Date() })
				.where(eq(composeStacks.id, input.id))
				.returning();

			if (!stack) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Compose stack not found" });
			}

			// Scale down all K8s deployments to 0
			try {
				const stackServices = await ctx.db
					.select()
					.from(services)
					.where(eq(services.composeStackId, input.id));
				const { projects } = await import("@bytesail/db/schema");
				const [project] = await ctx.db
					.select()
					.from(projects)
					.where(eq(projects.id, stack.projectId));

				if (project) {
					const { createK3sClient } = await import("@bytesail/core/k3s/client");
					const { projectNamespace } = await import("@bytesail/core/k3s/namespaces");
					const k3s = createK3sClient();
					const namespace = projectNamespace(project.id, project.slug);

					for (const svc of stackServices) {
						try {
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							await (k3s.apps.patchNamespacedDeployment as any)({
								name: `${svc.slug}-production`,
								namespace,
								body: [{ op: "replace", path: "/spec/replicas", value: 0 }],
								contentType: "application/json-patch+json",
							});
						} catch {
							// Deployment might not exist
						}
					}
				}
			} catch (e) {
				console.error("[ByteSail] Failed to scale down K8s deployments:", e);
			}

			return stack;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			// Get stack and its services before deleting
			const [stack] = await ctx.db
				.select()
				.from(composeStacks)
				.where(eq(composeStacks.id, input.id));

			if (!stack) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Compose stack not found" });
			}

			const stackServices = await ctx.db
				.select()
				.from(services)
				.where(eq(services.composeStackId, input.id));

			// Tear down K3s resources
			try {
				const { createK3sClient } = await import("@bytesail/core/k3s/client");
				const { deleteDeployment } = await import("@bytesail/core/k3s/deployments");
				const { deleteService: deleteK3sService } = await import("@bytesail/core/k3s/services");
				const { projectNamespace } = await import("@bytesail/core/k3s/namespaces");
				const { projects } = await import("@bytesail/db/schema");

				const [project] = await ctx.db
					.select()
					.from(projects)
					.where(eq(projects.id, stack.projectId));

				if (project) {
					const k3s = createK3sClient();
					const namespace = projectNamespace(project.id, project.slug);

					for (const svc of stackServices) {
						const deployName = `${svc.slug}-production`;
						try {
							await deleteDeployment(k3s, deployName, namespace);
						} catch {
							// Deployment might not exist
						}
						try {
							await deleteK3sService(k3s, svc.slug, namespace);
						} catch {
							// Service might not exist
						}
					}
				}
			} catch (e) {
				console.error("[ByteSail] Failed to tear down K3s resources:", e);
			}

			// Delete from database (cascades to services, dependencies, variables)
			await ctx.db.delete(composeStacks).where(eq(composeStacks.id, input.id));

			return stack;
		}),
});
