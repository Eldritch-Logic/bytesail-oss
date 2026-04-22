import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { environments } from "./environments.js";
import { services } from "./services.js";

export const certificates = pgTable("certificates", {
	id: uuid("id").primaryKey().defaultRandom(),
	domain: text("domain").notNull(),
	issuer: text("issuer", { enum: ["lets_encrypt", "custom"] }).default("lets_encrypt"),
	certPem: text("cert_pem"),
	keyPem: text("key_pem"),
	expiresAt: timestamp("expires_at"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const domains = pgTable("domains", {
	id: uuid("id").primaryKey().defaultRandom(),
	serviceId: uuid("service_id")
		.notNull()
		.references(() => services.id, { onDelete: "cascade" }),
	environmentId: uuid("environment_id")
		.notNull()
		.references(() => environments.id, { onDelete: "cascade" }),
	hostname: text("hostname").notNull().unique(),
	isGenerated: boolean("is_generated").default(false),
	port: integer("port").default(80),
	path: text("path").default("/"),
	tlsEnabled: boolean("tls_enabled").default(true),
	certificateId: uuid("certificate_id").references(() => certificates.id),
	forceHttps: boolean("force_https").default(true),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});
