import crypto from "node:crypto";
import { environments, managedDatabases, projects, services, variables } from "@bytesail/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { orgProcedure } from "../middleware/auth.js";
import { router } from "../trpc.js";

function generatePassword(length = 24): string {
	return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

const DB_DEFAULTS: Record<
	string,
	{ port: number; image: string; userEnv: string; passEnv: string; dbEnv: string }
> = {
	postgresql: {
		port: 5432,
		image: "postgres:16-alpine",
		userEnv: "POSTGRES_USER",
		passEnv: "POSTGRES_PASSWORD",
		dbEnv: "POSTGRES_DB",
	},
	mysql: {
		port: 3306,
		image: "mysql:8",
		userEnv: "MYSQL_USER",
		passEnv: "MYSQL_PASSWORD",
		dbEnv: "MYSQL_DATABASE",
	},
	mariadb: {
		port: 3306,
		image: "mariadb:11",
		userEnv: "MYSQL_USER",
		passEnv: "MYSQL_PASSWORD",
		dbEnv: "MYSQL_DATABASE",
	},
	mongodb: {
		port: 27017,
		image: "mongo:7",
		userEnv: "MONGO_INITDB_ROOT_USERNAME",
		passEnv: "MONGO_INITDB_ROOT_PASSWORD",
		dbEnv: "MONGO_INITDB_DATABASE",
	},
	redis: {
		port: 6379,
		image: "redis:7-alpine",
		userEnv: "",
		passEnv: "",
		dbEnv: "",
	},
	keydb: {
		port: 6379,
		image: "eqalpha/keydb:latest",
		userEnv: "",
		passEnv: "",
		dbEnv: "",
	},
};

function buildConnectionUrl(
	type: string,
	host: string,
	port: number,
	user: string,
	password: string,
	dbName: string,
): string {
	switch (type) {
		case "postgresql":
			return `postgresql://${user}:${password}@${host}:${port}/${dbName}`;
		case "mysql":
		case "mariadb":
			return `mysql://${user}:${password}@${host}:${port}/${dbName}`;
		case "mongodb":
			return `mongodb://${user}:${password}@${host}:${port}/${dbName}?authSource=admin`;
		case "redis":
		case "keydb":
			return `redis://${host}:${port}`;
		default:
			return "";
	}
}

export const databaseRouter = router({
	list: orgProcedure
		.input(z.object({ projectId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			return ctx.db
				.select()
				.from(managedDatabases)
				.where(eq(managedDatabases.projectId, input.projectId));
		}),

	create: orgProcedure
		.input(
			z.object({
				projectId: z.string().uuid(),
				type: z.enum(["postgresql", "mysql", "mariadb", "mongodb", "redis", "keydb"]),
				version: z.string().optional(),
				name: z.string().min(1).max(50),
				storageSizeGb: z.number().min(1).max(100).default(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const defaults = DB_DEFAULTS[input.type];
			if (!defaults) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Unsupported database type: ${input.type}`,
				});
			}

			const slug = input.name
				.toLowerCase()
				.replace(/[^a-z0-9-]/g, "-")
				.replace(/-+/g, "-");

			const dbUser = slug.replace(/-/g, "_");
			const dbPassword = generatePassword();
			const dbName = dbUser;
			const image = input.version
				? `${defaults.image.split(":")[0]}:${input.version}`
				: defaults.image;

			// Create service record
			const [service] = await ctx.db
				.insert(services)
				.values({
					projectId: input.projectId,
					name: input.name,
					slug,
					type: input.type === "redis" || input.type === "keydb" ? "redis" : "database",
					sourceType: "docker_image",
					dockerImage: image.split(":")[0],
					dockerTag: image.split(":")[1] ?? "latest",
					buildType: "docker_image",
					port: defaults.port,
					volumeMounts: [
						{
							name: `${slug}-data`,
							mountPath:
								input.type === "postgresql"
									? "/var/lib/postgresql/data"
									: input.type === "mysql" || input.type === "mariadb"
										? "/var/lib/mysql"
										: input.type === "mongodb"
											? "/data/db"
											: "/data",
							size: `${input.storageSizeGb}Gi`,
						},
					],
				})
				.returning();

			// Get or create default environment
			let [defaultEnv] = await ctx.db
				.select()
				.from(environments)
				.where(and(eq(environments.projectId, input.projectId), eq(environments.isDefault, true)));

			if (!defaultEnv) {
				[defaultEnv] = await ctx.db
					.insert(environments)
					.values({
						projectId: input.projectId,
						name: "Production",
						slug: "production",
						type: "production",
						isDefault: true,
					})
					.returning();
			}

			// Create env vars for the database
			if (defaults.userEnv && defaultEnv) {
				const envVars = [
					{ key: defaults.userEnv, value: dbUser, isSecret: false },
					{ key: defaults.passEnv, value: dbPassword, isSecret: true },
					{ key: defaults.dbEnv, value: dbName, isSecret: false },
				];

				if (input.type === "mysql" || input.type === "mariadb") {
					envVars.push({ key: "MYSQL_ROOT_PASSWORD", value: generatePassword(), isSecret: true });
				}

				for (const v of envVars) {
					await ctx.db.insert(variables).values({
						serviceId: service.id,
						environmentId: defaultEnv.id,
						key: v.key,
						value: v.value,
						isSecret: v.isSecret,
					});
				}
			}

			const [project] = await ctx.db
				.select()
				.from(projects)
				.where(eq(projects.id, input.projectId));

			const connectionUrl = project
				? buildConnectionUrl(input.type, slug, defaults.port, dbUser, dbPassword, dbName)
				: "";

			// Create managed database record
			const [database] = await ctx.db
				.insert(managedDatabases)
				.values({
					projectId: input.projectId,
					serviceId: service.id,
					type: input.type,
					version: image.split(":")[1] ?? "latest",
					dbName,
					dbUser,
					dbPasswordEncrypted: dbPassword,
					connectionUrl,
				})
				.returning();

			// Trigger deployment
			try {
				const { triggerDeployment } = await import("@bytesail/core/deploy/pipeline");
				await triggerDeployment({
					serviceId: service.id,
					environmentId: defaultEnv.id,
					trigger: "manual",
				});
			} catch (e) {
				console.error("[ByteSail] Failed to deploy database:", e);
			}

			return database;
		}),

	getConnectionInfo: orgProcedure
		.input(z.object({ id: z.string().uuid(), reveal: z.boolean().default(false) }))
		.query(async ({ ctx, input }) => {
			const [db] = await ctx.db
				.select()
				.from(managedDatabases)
				.where(eq(managedDatabases.id, input.id));
			if (!db) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Database not found" });
			}

			// Verify the database belongs to the user's organization
			const [project] = await ctx.db
				.select({ organizationId: projects.organizationId })
				.from(projects)
				.where(eq(projects.id, db.projectId));
			if (!project || project.organizationId !== ctx.organizationId) {
				throw new TRPCError({ code: "FORBIDDEN" });
			}

			return {
				type: db.type,
				host: db.dbName ? `${db.dbUser?.replace(/_/g, "-")}` : "",
				port: DB_DEFAULTS[db.type]?.port ?? 5432,
				database: db.dbName,
				username: db.dbUser,
				password: input.reveal ? db.dbPasswordEncrypted : "••••••••",
				connectionUrl: input.reveal
					? db.connectionUrl
					: (db.connectionUrl?.replace(/:[^@]+@/, ":••••••••@") ?? ""),
			};
		}),

	delete: orgProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const [db] = await ctx.db
				.select()
				.from(managedDatabases)
				.where(eq(managedDatabases.id, input.id));
			if (!db) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Database not found" });
			}

			// Delete the service (cascades to K8s resources via service delete)
			await ctx.db.delete(services).where(eq(services.id, db.serviceId));
			await ctx.db.delete(managedDatabases).where(eq(managedDatabases.id, input.id));

			return { success: true };
		}),
});
