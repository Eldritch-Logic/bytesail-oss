import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const notificationChannels = pgTable("notification_channels", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: text("organization_id").notNull(),
	name: text("name").notNull(),
	type: text("type", {
		enum: ["slack", "discord", "email", "telegram", "webhook"],
	}).notNull(),
	config: jsonb("config").notNull(),
	events: jsonb("events").$type<string[]>(),
	enabled: boolean("enabled").default(true),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});
