import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { services } from "./services.js";

export const volumes = pgTable("volumes", {
	id: uuid("id").primaryKey().defaultRandom(),
	serviceId: uuid("service_id")
		.notNull()
		.references(() => services.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	mountPath: text("mount_path").notNull(),
	sizeGb: integer("size_gb").default(1),
	storageClass: text("storage_class").default("longhorn"),
	k8sPvcName: text("k8s_pvc_name"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});
