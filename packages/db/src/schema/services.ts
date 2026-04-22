import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { composeStacks } from "./compose-stacks.js";
import { projects } from "./projects.js";

export const services = pgTable("services", {
	id: uuid("id").primaryKey().defaultRandom(),
	projectId: uuid("project_id")
		.notNull()
		.references(() => projects.id, { onDelete: "cascade" }),
	composeStackId: uuid("compose_stack_id").references(() => composeStacks.id, {
		onDelete: "cascade",
	}),
	name: text("name").notNull(),
	slug: text("slug").notNull(),
	type: text("type", {
		enum: ["app", "database", "redis", "worker", "cron"],
	}).notNull(),

	// Source configuration
	sourceType: text("source_type", {
		enum: ["github", "docker_image", "compose", "template"],
	}).notNull(),
	gitProviderId: uuid("git_provider_id"),
	repoOwner: text("repo_owner"),
	repoName: text("repo_name"),
	repoBranch: text("repo_branch").default("main"),
	repoSubdirectory: text("repo_subdirectory"),
	autoDeploy: boolean("auto_deploy").default(true),

	// Docker image source
	dockerImage: text("docker_image"),
	dockerTag: text("docker_tag"),

	// Build configuration
	buildType: text("build_type", {
		enum: ["railpacks", "dockerfile", "docker_image"],
	}).default("railpacks"),
	dockerfilePath: text("dockerfile_path"),
	buildArgs: jsonb("build_args").$type<Record<string, string>>(),

	// Port configuration
	port: integer("port").default(3000),

	// Volume mounts (from compose: [{name, mountPath, size}])
	volumeMounts:
		jsonb("volume_mounts").$type<Array<{ name: string; mountPath: string; size?: string }>>(),

	// Runtime configuration
	replicas: integer("replicas").default(1),
	cpuLimit: text("cpu_limit"),
	memoryLimit: text("memory_limit"),
	cpuRequest: text("cpu_request"),
	memoryRequest: text("memory_request"),
	command: text("command"),
	args: jsonb("args").$type<string[]>(),

	// Health check
	healthCheckPath: text("health_check_path"),
	healthCheckPort: integer("health_check_port"),
	healthCheckInterval: integer("health_check_interval").default(30),

	// Restart policy
	restartPolicy: text("restart_policy", {
		enum: ["always", "on-failure", "never"],
	}).default("always"),

	// State
	status: text("status", {
		enum: ["running", "deploying", "stopped", "failed", "building", "queued"],
	}).default("stopped"),

	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
