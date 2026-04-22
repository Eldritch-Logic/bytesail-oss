import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { services } from "./services.js";

export const serviceDependencies = pgTable("service_dependencies", {
	id: uuid("id").primaryKey().defaultRandom(),
	projectId: uuid("project_id")
		.notNull()
		.references(() => projects.id, { onDelete: "cascade" }),
	fromServiceId: uuid("from_service_id")
		.notNull()
		.references(() => services.id, { onDelete: "cascade" }),
	toServiceId: uuid("to_service_id")
		.notNull()
		.references(() => services.id, { onDelete: "cascade" }),
	dependencyType: text("dependency_type", {
		enum: ["depends_on", "network", "volume", "env_reference"],
	})
		.notNull()
		.default("depends_on"),
	label: text("label"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});
