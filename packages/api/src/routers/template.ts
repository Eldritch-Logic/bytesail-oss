import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { environments, projects, services, variables } from "@bytesail/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../middleware/auth.js";
import { router } from "../trpc.js";
import { resolveTemplateVar } from "./template-utils.js";

export { resolveTemplateVar } from "./template-utils.js";

type TemplateRegistryEntry = {
	slug: string;
	name: string;
	description: string;
	icon: string;
	category: string;
	tags: string[];
	file: string;
};

type TemplateRegistry = {
	version: number;
	templates: TemplateRegistryEntry[];
	categories: Array<{ slug: string; name: string }>;
};

type TemplateService = {
	name: string;
	image: string;
	port?: number;
	command?: string;
	volumes?: Array<{ name: string; mountPath: string; size?: string }>;
	environment?: Record<string, string>;
};

type TemplateSpec = {
	slug: string;
	name: string;
	description: string;
	icon: string;
	category: string;
	services: TemplateService[];
	form?: Array<{
		key: string;
		label: string;
		type: string;
		default?: string;
		required?: boolean;
		options?: string[];
	}>;
};

function getTemplatesDir(): string {
	// Try multiple paths to find templates directory
	const candidates = [
		join(process.cwd(), "templates"),
		join(process.cwd(), "../../templates"),
		join(process.cwd(), "../templates"),
	];
	for (const dir of candidates) {
		try {
			readFileSync(join(dir, "registry.json"), "utf-8");
			return dir;
		} catch {
			// Try next
		}
	}
	return join(process.cwd(), "templates");
}

function loadRegistry(): TemplateRegistry {
	try {
		const content = readFileSync(join(getTemplatesDir(), "registry.json"), "utf-8");
		return JSON.parse(content) as TemplateRegistry;
	} catch {
		return { version: 1, templates: [], categories: [] };
	}
}

function loadTemplate(file: string): TemplateSpec | null {
	try {
		const content = readFileSync(join(getTemplatesDir(), file), "utf-8");
		return JSON.parse(content) as TemplateSpec;
	} catch {
		return null;
	}
}

function resolveEnvironment(
	env: Record<string, string>,
	formValues: Record<string, string>,
): Record<string, string> {
	const resolved: Record<string, string> = {};
	for (const [key, value] of Object.entries(env)) {
		resolved[key] = resolveTemplateVar(value, formValues);
	}
	return resolved;
}

export const templateRouter = router({
	list: protectedProcedure
		.input(
			z
				.object({
					category: z.string().optional(),
					tag: z.string().optional(),
					search: z.string().optional(),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			const registry = loadRegistry();
			let templates = registry.templates;

			if (input?.category) {
				templates = templates.filter((t) => t.category === input.category);
			}
			if (input?.tag) {
				templates = templates.filter((t) => t.tags.includes(input.tag!));
			}
			if (input?.search) {
				const q = input.search.toLowerCase();
				templates = templates.filter(
					(t) =>
						t.name.toLowerCase().includes(q) ||
						t.description.toLowerCase().includes(q) ||
						t.tags.some((tag) => tag.includes(q)),
				);
			}

			return { templates, categories: registry.categories };
		}),

	getBySlug: protectedProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
		const registry = loadRegistry();
		const entry = registry.templates.find((t) => t.slug === input.slug);
		if (!entry) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
		}

		const template = loadTemplate(entry.file);
		if (!template) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Template file not found" });
		}

		return template;
	}),

	deploy: protectedProcedure
		.input(
			z.object({
				slug: z.string(),
				projectId: z.string().uuid(),
				formValues: z.record(z.string()).default({}),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const registry = loadRegistry();
			const entry = registry.templates.find((t) => t.slug === input.slug);
			if (!entry) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
			}

			const template = loadTemplate(entry.file);
			if (!template) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Template file not found" });
			}

			const [project] = await ctx.db
				.select()
				.from(projects)
				.where(eq(projects.id, input.projectId));
			if (!project) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
			}

			// Get or create default environment
			let [defaultEnv] = await ctx.db
				.select()
				.from(environments)
				.where(and(eq(environments.projectId, input.projectId), eq(environments.isDefault, true)));

			if (!defaultEnv) {
				[defaultEnv] = await ctx.db
					.insert(environments)
					.values({
						projectId: input.projectId,
						name: "Production",
						slug: "production",
						type: "production",
						isDefault: true,
					})
					.returning();
			}

			const createdServiceIds: string[] = [];

			for (const svcSpec of template.services) {
				const slug = svcSpec.name
					.toLowerCase()
					.replace(/[^a-z0-9-]/g, "-")
					.replace(/-+/g, "-");

				const resolvedEnv = svcSpec.environment
					? resolveEnvironment(svcSpec.environment, input.formValues)
					: {};

				// Detect type from image
				const imageLower = svcSpec.image.toLowerCase();
				const type = /postgres|mysql|mariadb|mongo|cockroach/.test(imageLower)
					? "database"
					: /redis|keydb|valkey/.test(imageLower)
						? "redis"
						: "app";

				const [service] = await ctx.db
					.insert(services)
					.values({
						projectId: input.projectId,
						name: svcSpec.name,
						slug,
						type,
						sourceType: "docker_image",
						dockerImage: svcSpec.image.split(":")[0],
						dockerTag: svcSpec.image.includes(":") ? svcSpec.image.split(":")[1] : "latest",
						buildType: "docker_image",
						port: svcSpec.port ?? 3000,
						command: svcSpec.command,
						volumeMounts: svcSpec.volumes,
					})
					.returning();

				createdServiceIds.push(service.id);

				// Save environment variables
				for (const [key, value] of Object.entries(resolvedEnv)) {
					const isSecret = /password|secret|key|token/i.test(key);
					await ctx.db.insert(variables).values({
						serviceId: service.id,
						environmentId: defaultEnv.id,
						key,
						value,
						isSecret,
					});
				}
			}

			// Trigger deployments (infra first, then apps)
			try {
				const { triggerDeployment } = await import("@bytesail/core/deploy/pipeline");

				const allServices = await ctx.db
					.select()
					.from(services)
					.where(eq(services.projectId, input.projectId));

				const created = allServices.filter((s) => createdServiceIds.includes(s.id));
				const infra = created.filter((s) => s.type === "database" || s.type === "redis");
				const apps = created.filter((s) => s.type !== "database" && s.type !== "redis");

				for (const svc of infra) {
					await triggerDeployment({
						serviceId: svc.id,
						environmentId: defaultEnv.id,
						trigger: "manual",
					});
				}

				if (infra.length > 0) {
					await new Promise((r) => setTimeout(r, 5000));
				}

				for (const svc of apps) {
					await triggerDeployment({
						serviceId: svc.id,
						environmentId: defaultEnv.id,
						trigger: "manual",
					});
				}
			} catch (e) {
				console.error("[ByteSail] Template deployment failed:", e);
			}

			return { serviceIds: createdServiceIds };
		}),
});
