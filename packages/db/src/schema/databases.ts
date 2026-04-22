import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { projects } from "./projects.js";
import { services } from "./services.js";

export const managedDatabases = pgTable("managed_databases", {
	id: uuid("id").primaryKey().defaultRandom(),
	projectId: uuid("project_id")
		.notNull()
		.references(() => projects.id, { onDelete: "cascade" }),
	serviceId: uuid("service_id")
		.notNull()
		.references(() => services.id, { onDelete: "cascade" }),
	type: text("type", {
		enum: ["postgresql", "mysql", "mariadb", "mongodb", "redis", "keydb"],
	}).notNull(),
	version: text("version").notNull(),
	dbName: text("db_name"),
	dbUser: text("db_user"),
	dbPasswordEncrypted: text("db_password_encrypted"),
	connectionUrl: text("connection_url"),

	// Backup configuration
	backupEnabled: boolean("backup_enabled").default(false),
	backupSchedule: text("backup_schedule"),
	backupRetentionDays: integer("backup_retention_days").default(7),
	backupS3Bucket: text("backup_s3_bucket"),

	createdAt: timestamp("created_at").notNull().defaultNow(),
});
