import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { environments } from "./environments.js";
import { services } from "./services.js";

export const variables = pgTable("variables", {
	id: uuid("id").primaryKey().defaultRandom(),
	serviceId: uuid("service_id")
		.notNull()
		.references(() => services.id, { onDelete: "cascade" }),
	environmentId: uuid("environment_id")
		.notNull()
		.references(() => environments.id, { onDelete: "cascade" }),
	key: text("key").notNull(),
	value: text("value").notNull(),
	isSecret: boolean("is_secret").default(false),

	// Cross-service reference: "${SERVICE_NAME.VAR_KEY}"
	referenceServiceId: uuid("reference_service_id").references(() => services.id),
	referenceKey: text("reference_key"),

	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
