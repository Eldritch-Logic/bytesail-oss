import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const environments = pgTable("environments", {
	id: uuid("id").primaryKey().defaultRandom(),
	projectId: uuid("project_id")
		.notNull()
		.references(() => projects.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	slug: text("slug").notNull(),
	type: text("type", {
		enum: ["production", "staging", "preview", "development"],
	}).notNull(),
	isDefault: boolean("is_default").default(false),

	// Preview environment metadata
	prNumber: integer("pr_number"),
	prBranch: text("pr_branch"),
	autoDestroy: boolean("auto_destroy").default(false),

	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
