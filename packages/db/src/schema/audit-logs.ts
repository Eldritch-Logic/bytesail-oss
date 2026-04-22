import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const auditLogs = pgTable("audit_logs", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: text("user_id"),
	organizationId: text("organization_id"),
	action: text("action").notNull(),
	resourceType: text("resource_type").notNull(),
	resourceId: uuid("resource_id"),
	metadata: jsonb("metadata"),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});
