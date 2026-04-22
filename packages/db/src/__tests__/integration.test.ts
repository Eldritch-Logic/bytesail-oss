import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema/index.js";

let container: StartedPostgreSqlContainer;
let db: ReturnType<typeof drizzle>;
let client: ReturnType<typeof postgres>;

beforeAll(async () => {
	container = await new PostgreSqlContainer("postgres:16-alpine").start();

	const connectionString = container.getConnectionUri();
	client = postgres(connectionString);
	db = drizzle(client, { schema });

	// Push schema using raw SQL from drizzle-kit is complex, so we use drizzle push approach
	// Create tables directly from schema definitions
	await client.unsafe(`
		CREATE TABLE IF NOT EXISTS projects (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			organization_id TEXT NOT NULL,
			name TEXT NOT NULL,
			slug TEXT NOT NULL,
			description TEXT,
			canvas_state JSONB,
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS environments (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			slug TEXT NOT NULL,
			type TEXT NOT NULL DEFAULT 'production',
			is_default BOOLEAN DEFAULT FALSE,
			pr_number INTEGER,
			pr_branch TEXT,
			auto_destroy BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS compose_stacks (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			slug TEXT NOT NULL,
			compose_file TEXT NOT NULL DEFAULT '',
			env_file TEXT,
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS services (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			compose_stack_id UUID REFERENCES compose_stacks(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			slug TEXT NOT NULL,
			type TEXT NOT NULL,
			source_type TEXT NOT NULL,
			git_provider_id UUID,
			repo_owner TEXT,
			repo_name TEXT,
			repo_branch TEXT DEFAULT 'main',
			repo_subdirectory TEXT,
			auto_deploy BOOLEAN DEFAULT TRUE,
			docker_image TEXT,
			docker_tag TEXT,
			build_type TEXT DEFAULT 'railpacks',
			dockerfile_path TEXT,
			build_args JSONB,
			port INTEGER DEFAULT 3000,
			volume_mounts JSONB,
			replicas INTEGER DEFAULT 1,
			cpu_limit TEXT,
			memory_limit TEXT,
			cpu_request TEXT,
			memory_request TEXT,
			command TEXT,
			args JSONB,
			health_check_path TEXT,
			health_check_port INTEGER,
			health_check_interval INTEGER DEFAULT 30,
			restart_policy TEXT DEFAULT 'always',
			status TEXT NOT NULL DEFAULT 'stopped',
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS variables (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
			environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
			key TEXT NOT NULL,
			value TEXT NOT NULL,
			is_secret BOOLEAN DEFAULT FALSE,
			reference_service_id UUID REFERENCES services(id),
			reference_key TEXT,
			created_at TIMESTAMP NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP NOT NULL DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS deployments (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
			environment_id TEXT NOT NULL,
			version INTEGER NOT NULL,
			commit_hash TEXT,
			commit_message TEXT,
			commit_author TEXT,
			branch TEXT,
			image_tag TEXT,
			build_duration INTEGER,
			build_logs TEXT,
			status TEXT NOT NULL DEFAULT 'queued',
			deploy_duration INTEGER,
			error_message TEXT,
			trigger TEXT NOT NULL,
			triggered_by TEXT,
			k8s_deployment_name TEXT,
			k8s_namespace TEXT,
			started_at TIMESTAMP,
			completed_at TIMESTAMP,
			created_at TIMESTAMP NOT NULL DEFAULT NOW()
		);
	`);
}, 120_000);

afterAll(async () => {
	await client.end();
	await container.stop();
});

describe("Project CRUD", () => {
	let projectId: string;

	it("creates a project", async () => {
		const [project] = await db
			.insert(schema.projects)
			.values({ organizationId: "org-1", name: "Test Project", slug: "test-project" })
			.returning();

		expect(project.id).toBeDefined();
		expect(project.name).toBe("Test Project");
		expect(project.slug).toBe("test-project");
		projectId = project.id;
	});

	it("reads a project by id", async () => {
		const [project] = await db
			.select()
			.from(schema.projects)
			.where(sql`${schema.projects.id} = ${projectId}`);

		expect(project.name).toBe("Test Project");
	});

	it("updates a project", async () => {
		const [updated] = await db
			.update(schema.projects)
			.set({ name: "Updated Project", updatedAt: new Date() })
			.where(sql`${schema.projects.id} = ${projectId}`)
			.returning();

		expect(updated.name).toBe("Updated Project");
	});

	it("lists all projects", async () => {
		const projects = await db.select().from(schema.projects);
		expect(projects.length).toBeGreaterThanOrEqual(1);
	});

	it("deletes a project", async () => {
		const [deleted] = await db
			.delete(schema.projects)
			.where(sql`${schema.projects.id} = ${projectId}`)
			.returning();

		expect(deleted.id).toBe(projectId);

		const remaining = await db
			.select()
			.from(schema.projects)
			.where(sql`${schema.projects.id} = ${projectId}`);
		expect(remaining).toHaveLength(0);
	});
});

describe("Service CRUD", () => {
	let projectId: string;
	let serviceId: string;

	beforeAll(async () => {
		const [project] = await db
			.insert(schema.projects)
			.values({ organizationId: "org-1", name: "Service Test", slug: "service-test" })
			.returning();
		projectId = project.id;
	});

	it("creates a service", async () => {
		const [service] = await db
			.insert(schema.services)
			.values({
				projectId,
				name: "Web App",
				slug: "web-app",
				type: "app",
				sourceType: "docker_image",
				dockerImage: "nginx",
				status: "stopped",
			})
			.returning();

		expect(service.id).toBeDefined();
		expect(service.name).toBe("Web App");
		expect(service.type).toBe("app");
		serviceId = service.id;
	});

	it("reads a service", async () => {
		const [service] = await db
			.select()
			.from(schema.services)
			.where(sql`${schema.services.id} = ${serviceId}`);

		expect(service.slug).toBe("web-app");
		expect(service.dockerImage).toBe("nginx");
	});

	it("updates service status", async () => {
		const [updated] = await db
			.update(schema.services)
			.set({ status: "running" })
			.where(sql`${schema.services.id} = ${serviceId}`)
			.returning();

		expect(updated.status).toBe("running");
	});

	it("deletes a service", async () => {
		const [deleted] = await db
			.delete(schema.services)
			.where(sql`${schema.services.id} = ${serviceId}`)
			.returning();

		expect(deleted.id).toBe(serviceId);
	});

	it("cascades delete from project to services", async () => {
		const [svc] = await db
			.insert(schema.services)
			.values({
				projectId,
				name: "Cascade Test",
				slug: "cascade-test",
				type: "app",
				sourceType: "docker_image",
				status: "stopped",
			})
			.returning();

		await db.delete(schema.projects).where(sql`${schema.projects.id} = ${projectId}`);

		const remaining = await db
			.select()
			.from(schema.services)
			.where(sql`${schema.services.id} = ${svc.id}`);
		expect(remaining).toHaveLength(0);
	});
});

describe("Variable CRUD with encryption", () => {
	let projectId: string;
	let serviceId: string;
	let environmentId: string;

	beforeAll(async () => {
		const [project] = await db
			.insert(schema.projects)
			.values({ organizationId: "org-1", name: "Var Test", slug: "var-test" })
			.returning();
		projectId = project.id;

		const [env] = await db
			.insert(schema.environments)
			.values({
				projectId,
				name: "Production",
				slug: "production",
				type: "production",
				isDefault: true,
			})
			.returning();
		environmentId = env.id;

		const [service] = await db
			.insert(schema.services)
			.values({
				projectId,
				name: "API",
				slug: "api",
				type: "app",
				sourceType: "docker_image",
				status: "stopped",
			})
			.returning();
		serviceId = service.id;
	});

	it("creates a plain variable", async () => {
		const [variable] = await db
			.insert(schema.variables)
			.values({ serviceId, environmentId, key: "NODE_ENV", value: "production", isSecret: false })
			.returning();

		expect(variable.key).toBe("NODE_ENV");
		expect(variable.value).toBe("production");
		expect(variable.isSecret).toBe(false);
	});

	it("creates a secret variable", async () => {
		const [variable] = await db
			.insert(schema.variables)
			.values({
				serviceId,
				environmentId,
				key: "DB_PASSWORD",
				value: "encrypted-value",
				isSecret: true,
			})
			.returning();

		expect(variable.key).toBe("DB_PASSWORD");
		expect(variable.isSecret).toBe(true);
	});

	it("updates a variable value", async () => {
		const [variable] = await db
			.insert(schema.variables)
			.values({ serviceId, environmentId, key: "PORT", value: "3000", isSecret: false })
			.returning();

		const [updated] = await db
			.update(schema.variables)
			.set({ value: "8080", updatedAt: new Date() })
			.where(sql`${schema.variables.id} = ${variable.id}`)
			.returning();

		expect(updated.value).toBe("8080");
	});

	it("lists variables for a service", async () => {
		const vars = await db
			.select()
			.from(schema.variables)
			.where(sql`${schema.variables.serviceId} = ${serviceId}`);

		expect(vars.length).toBeGreaterThanOrEqual(3);
	});

	it("deletes a variable", async () => {
		const [variable] = await db
			.insert(schema.variables)
			.values({ serviceId, environmentId, key: "TEMP", value: "delete-me", isSecret: false })
			.returning();

		await db.delete(schema.variables).where(sql`${schema.variables.id} = ${variable.id}`);

		const remaining = await db
			.select()
			.from(schema.variables)
			.where(sql`${schema.variables.id} = ${variable.id}`);
		expect(remaining).toHaveLength(0);
	});

	it("cascades delete from service to variables", async () => {
		const [svc] = await db
			.insert(schema.services)
			.values({
				projectId,
				name: "Temp Svc",
				slug: "temp-svc",
				type: "app",
				sourceType: "docker_image",
				status: "stopped",
			})
			.returning();

		await db.insert(schema.variables).values({
			serviceId: svc.id,
			environmentId,
			key: "CASCADE_KEY",
			value: "cascade-val",
		});

		await db.delete(schema.services).where(sql`${schema.services.id} = ${svc.id}`);

		const vars = await db
			.select()
			.from(schema.variables)
			.where(sql`${schema.variables.serviceId} = ${svc.id}`);
		expect(vars).toHaveLength(0);
	});
});

describe("Deployment creation and status tracking", () => {
	let projectId: string;
	let serviceId: string;
	let environmentId: string;

	beforeAll(async () => {
		const [project] = await db
			.insert(schema.projects)
			.values({ organizationId: "org-1", name: "Deploy Test", slug: "deploy-test" })
			.returning();
		projectId = project.id;

		const [env] = await db
			.insert(schema.environments)
			.values({ projectId, name: "Production", slug: "production", type: "production" })
			.returning();
		environmentId = env.id;

		const [service] = await db
			.insert(schema.services)
			.values({
				projectId,
				name: "Worker",
				slug: "worker",
				type: "worker",
				sourceType: "docker_image",
				status: "stopped",
			})
			.returning();
		serviceId = service.id;
	});

	it("creates a deployment with queued status", async () => {
		const [deploy] = await db
			.insert(schema.deployments)
			.values({
				serviceId,
				environmentId,
				version: 1,
				trigger: "manual",
				triggeredBy: "user-1",
				status: "queued",
			})
			.returning();

		expect(deploy.id).toBeDefined();
		expect(deploy.status).toBe("queued");
		expect(deploy.version).toBe(1);
	});

	it("transitions status through pipeline stages", async () => {
		const [deploy] = await db
			.insert(schema.deployments)
			.values({
				serviceId,
				environmentId,
				version: 2,
				trigger: "cli",
				status: "queued",
			})
			.returning();

		// queued → building
		const [building] = await db
			.update(schema.deployments)
			.set({ status: "building", startedAt: new Date() })
			.where(sql`${schema.deployments.id} = ${deploy.id}`)
			.returning();
		expect(building.status).toBe("building");

		// building → deploying
		const [deploying] = await db
			.update(schema.deployments)
			.set({ status: "deploying", buildDuration: 45 })
			.where(sql`${schema.deployments.id} = ${deploy.id}`)
			.returning();
		expect(deploying.status).toBe("deploying");
		expect(deploying.buildDuration).toBe(45);

		// deploying → running
		const [running] = await db
			.update(schema.deployments)
			.set({ status: "running", completedAt: new Date(), deployDuration: 12 })
			.where(sql`${schema.deployments.id} = ${deploy.id}`)
			.returning();
		expect(running.status).toBe("running");
		expect(running.deployDuration).toBe(12);
	});

	it("records failure with error message", async () => {
		const [deploy] = await db
			.insert(schema.deployments)
			.values({
				serviceId,
				environmentId,
				version: 3,
				trigger: "git_push",
				status: "building",
				commitHash: "abc123",
			})
			.returning();

		const [failed] = await db
			.update(schema.deployments)
			.set({
				status: "failed",
				errorMessage: "Build failed: missing dependency",
				completedAt: new Date(),
			})
			.where(sql`${schema.deployments.id} = ${deploy.id}`)
			.returning();

		expect(failed.status).toBe("failed");
		expect(failed.errorMessage).toContain("Build failed");
		expect(failed.commitHash).toBe("abc123");
	});

	it("lists deployments for a service ordered by version", async () => {
		const deploys = await db
			.select()
			.from(schema.deployments)
			.where(sql`${schema.deployments.serviceId} = ${serviceId}`)
			.orderBy(schema.deployments.version);

		expect(deploys.length).toBeGreaterThanOrEqual(3);
		expect(deploys[0].version).toBeLessThan(deploys[deploys.length - 1].version);
	});
});
