import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const composeStacks = pgTable("compose_stacks", {
	id: uuid("id").primaryKey().defaultRandom(),
	projectId: uuid("project_id")
		.notNull()
		.references(() => projects.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	composeFile: text("compose_file").notNull(),
	envFile: text("env_file"),

	// Source (inline paste vs. git repo)
	sourceType: text("source_type", { enum: ["inline", "github"] }).default("inline"),
	gitProviderId: uuid("git_provider_id"),
	repoOwner: text("repo_owner"),
	repoName: text("repo_name"),
	repoBranch: text("repo_branch"),
	composePath: text("compose_path").default("docker-compose.yml"),

	status: text("status", {
		enum: ["running", "stopped", "deploying", "failed", "partial"],
	}).default("stopped"),

	lastDeployedAt: timestamp("last_deployed_at"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
