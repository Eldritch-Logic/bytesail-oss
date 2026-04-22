import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { services } from "./services.js";

export const deployments = pgTable("deployments", {
	id: uuid("id").primaryKey().defaultRandom(),
	serviceId: uuid("service_id")
		.notNull()
		.references(() => services.id, { onDelete: "cascade" }),
	environmentId: uuid("environment_id").notNull(),

	// Version info
	version: integer("version").notNull(),
	commitHash: text("commit_hash"),
	commitMessage: text("commit_message"),
	commitAuthor: text("commit_author"),
	branch: text("branch"),

	// Build info
	imageTag: text("image_tag"),
	buildDuration: integer("build_duration"),
	buildLogs: text("build_logs"),

	// Deploy info
	status: text("status", {
		enum: [
			"queued",
			"building",
			"pushing",
			"deploying",
			"running",
			"failed",
			"cancelled",
			"rolled_back",
		],
	})
		.notNull()
		.default("queued"),
	deployDuration: integer("deploy_duration"),
	errorMessage: text("error_message"),

	// Trigger
	trigger: text("trigger", {
		enum: ["git_push", "manual", "cli", "rollback", "pr_preview", "compose", "api"],
	}).notNull(),
	triggeredBy: text("triggered_by"),

	// K8s metadata
	k8sDeploymentName: text("k8s_deployment_name"),
	k8sNamespace: text("k8s_namespace"),

	startedAt: timestamp("started_at"),
	completedAt: timestamp("completed_at"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});
