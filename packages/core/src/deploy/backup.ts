import { db } from "@bytesail/db";
import { managedDatabases, projects, services, systemSettings } from "@bytesail/db/schema";
import { eq } from "drizzle-orm";
import { createK3sClient } from "../k3s/client.js";
import { applyBackupCronJob, deleteBackupCronJob, triggerBackupJobNow } from "../k3s/jobs.js";
import { projectNamespace } from "../k3s/namespaces.js";

type S3Config = {
	endpoint: string;
	bucket: string;
	accessKey: string;
	secretKey: string;
	region?: string;
};

async function getS3Config(database: typeof managedDatabases.$inferSelect): Promise<S3Config> {
	// Check database-specific S3 config first
	if (database.backupS3Bucket) {
		const [setting] = await db
			.select()
			.from(systemSettings)
			.where(eq(systemSettings.key, "backup_s3"));

		const config = (setting?.value as S3Config) ?? {
			endpoint: process.env.BACKUP_S3_ENDPOINT ?? "https://s3.amazonaws.com",
			bucket: database.backupS3Bucket,
			accessKey: process.env.BACKUP_S3_ACCESS_KEY ?? "",
			secretKey: process.env.BACKUP_S3_SECRET_KEY ?? "",
		};

		return { ...config, bucket: database.backupS3Bucket };
	}

	// Fall back to global S3 config
	const [setting] = await db
		.select()
		.from(systemSettings)
		.where(eq(systemSettings.key, "backup_s3"));

	if (setting?.value) return setting.value as S3Config;

	return {
		endpoint: process.env.BACKUP_S3_ENDPOINT ?? "https://s3.amazonaws.com",
		bucket: process.env.BACKUP_S3_BUCKET ?? "bytesail-backups",
		accessKey: process.env.BACKUP_S3_ACCESS_KEY ?? "",
		secretKey: process.env.BACKUP_S3_SECRET_KEY ?? "",
	};
}

export async function triggerBackup(databaseId: string): Promise<string> {
	const [database] = await db
		.select()
		.from(managedDatabases)
		.where(eq(managedDatabases.id, databaseId));
	if (!database) throw new Error("Database not found");

	const [service] = await db.select().from(services).where(eq(services.id, database.serviceId));
	if (!service) throw new Error("Service not found");

	const [project] = await db.select().from(projects).where(eq(projects.id, database.projectId));
	if (!project) throw new Error("Project not found");

	const s3 = await getS3Config(database);
	const k3s = createK3sClient();

	// Ensure CronJob exists
	await applyBackupCronJob(k3s, {
		projectId: project.id,
		projectSlug: project.slug,
		serviceSlug: service.slug,
		dbType: database.type,
		dbName: database.dbName ?? service.slug,
		dbUser: database.dbUser ?? service.slug,
		schedule: database.backupSchedule ?? "0 2 * * *",
		s3Endpoint: s3.endpoint,
		s3Bucket: s3.bucket,
		s3AccessKey: s3.accessKey,
		s3SecretKey: s3.secretKey,
		retentionDays: database.backupRetentionDays ?? 7,
	});

	// Trigger manual backup
	const jobName = await triggerBackupJobNow(k3s, service.slug, project.id, project.slug);

	return jobName;
}

export async function enableScheduledBackups(
	databaseId: string,
	schedule = "0 2 * * *",
	retentionDays = 7,
): Promise<void> {
	const [database] = await db
		.select()
		.from(managedDatabases)
		.where(eq(managedDatabases.id, databaseId));
	if (!database) throw new Error("Database not found");

	const [service] = await db.select().from(services).where(eq(services.id, database.serviceId));
	if (!service) throw new Error("Service not found");

	const [project] = await db.select().from(projects).where(eq(projects.id, database.projectId));
	if (!project) throw new Error("Project not found");

	const s3 = await getS3Config(database);
	const k3s = createK3sClient();

	await applyBackupCronJob(k3s, {
		projectId: project.id,
		projectSlug: project.slug,
		serviceSlug: service.slug,
		dbType: database.type,
		dbName: database.dbName ?? service.slug,
		dbUser: database.dbUser ?? service.slug,
		schedule,
		s3Endpoint: s3.endpoint,
		s3Bucket: s3.bucket,
		s3AccessKey: s3.accessKey,
		s3SecretKey: s3.secretKey,
		retentionDays,
	});

	await db
		.update(managedDatabases)
		.set({
			backupEnabled: true,
			backupSchedule: schedule,
			backupRetentionDays: retentionDays,
		})
		.where(eq(managedDatabases.id, databaseId));
}

export async function disableScheduledBackups(databaseId: string): Promise<void> {
	const [database] = await db
		.select()
		.from(managedDatabases)
		.where(eq(managedDatabases.id, databaseId));
	if (!database) throw new Error("Database not found");

	const [service] = await db.select().from(services).where(eq(services.id, database.serviceId));
	if (!service) throw new Error("Service not found");

	const [project] = await db.select().from(projects).where(eq(projects.id, database.projectId));
	if (!project) throw new Error("Project not found");

	const k3s = createK3sClient();
	await deleteBackupCronJob(k3s, service.slug, project.id, project.slug);

	await db
		.update(managedDatabases)
		.set({ backupEnabled: false })
		.where(eq(managedDatabases.id, databaseId));
}

export async function listBackups(
	databaseId: string,
): Promise<Array<{ key: string; size: number; lastModified: string }>> {
	const [database] = await db
		.select()
		.from(managedDatabases)
		.where(eq(managedDatabases.id, databaseId));
	if (!database) throw new Error("Database not found");

	const [service] = await db.select().from(services).where(eq(services.id, database.serviceId));
	if (!service) throw new Error("Service not found");

	const [project] = await db.select().from(projects).where(eq(projects.id, database.projectId));
	if (!project) throw new Error("Project not found");

	const s3 = await getS3Config(database);
	const prefix = `${project.slug}/${service.slug}/`;

	// List objects via S3 API
	const url = `${s3.endpoint}/${s3.bucket}?list-type=2&prefix=${encodeURIComponent(prefix)}`;

	try {
		const response = await fetch(url, {
			headers: {
				Authorization: `AWS ${s3.accessKey}:${s3.secretKey}`,
			},
		});

		if (!response.ok) return [];

		const text = await response.text();
		const items: Array<{ key: string; size: number; lastModified: string }> = [];

		// Parse simple XML response
		const keyMatches = text.matchAll(/<Key>([^<]+)<\/Key>/g);
		const sizeMatches = text.matchAll(/<Size>(\d+)<\/Size>/g);
		const dateMatches = text.matchAll(/<LastModified>([^<]+)<\/LastModified>/g);

		const keys = [...keyMatches].map((m) => m[1]);
		const sizes = [...sizeMatches].map((m) => Number.parseInt(m[1], 10));
		const dates = [...dateMatches].map((m) => m[1]);

		for (let i = 0; i < keys.length; i++) {
			items.push({
				key: keys[i],
				size: sizes[i] ?? 0,
				lastModified: dates[i] ?? "",
			});
		}

		return items.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
	} catch {
		return [];
	}
}

export async function restoreBackup(databaseId: string, backupKey: string): Promise<string> {
	const [database] = await db
		.select()
		.from(managedDatabases)
		.where(eq(managedDatabases.id, databaseId));
	if (!database) throw new Error("Database not found");

	const [service] = await db.select().from(services).where(eq(services.id, database.serviceId));
	if (!service) throw new Error("Service not found");

	const [project] = await db.select().from(projects).where(eq(projects.id, database.projectId));
	if (!project) throw new Error("Project not found");

	const s3 = await getS3Config(database);
	const k3s = createK3sClient();
	const namespace = projectNamespace(project.id, project.slug);
	const jobName = `restore-${service.slug}-${Date.now()}`;

	const restoreCommands: Record<string, string> = {
		postgresql: `mc alias set s3 ${s3.endpoint} ${s3.accessKey} ${s3.secretKey} && mc cp s3/${s3.bucket}/${backupKey} /backup/restore.sql.gz && gunzip -c /backup/restore.sql.gz | psql -U ${database.dbUser} -d ${database.dbName}`,
		mysql: `mc alias set s3 ${s3.endpoint} ${s3.accessKey} ${s3.secretKey} && mc cp s3/${s3.bucket}/${backupKey} /backup/restore.sql.gz && gunzip -c /backup/restore.sql.gz | mysql -u ${database.dbUser} -p"$MYSQL_PASSWORD" ${database.dbName}`,
		mariadb: `mc alias set s3 ${s3.endpoint} ${s3.accessKey} ${s3.secretKey} && mc cp s3/${s3.bucket}/${backupKey} /backup/restore.sql.gz && gunzip -c /backup/restore.sql.gz | mysql -u ${database.dbUser} -p"$MYSQL_PASSWORD" ${database.dbName}`,
		mongodb: `mc alias set s3 ${s3.endpoint} ${s3.accessKey} ${s3.secretKey} && mc cp s3/${s3.bucket}/${backupKey} /backup/restore.archive && mongorestore --archive=/backup/restore.archive --gzip --drop`,
		redis: `mc alias set s3 ${s3.endpoint} ${s3.accessKey} ${s3.secretKey} && mc cp s3/${s3.bucket}/${backupKey} /data/dump.rdb && redis-cli DEBUG RELOAD`,
		keydb: `mc alias set s3 ${s3.endpoint} ${s3.accessKey} ${s3.secretKey} && mc cp s3/${s3.bucket}/${backupKey} /data/dump.rdb && keydb-cli DEBUG RELOAD`,
	};

	const restoreCmd = restoreCommands[database.type];
	if (!restoreCmd) throw new Error(`Restore not supported for type: ${database.type}`);

	const jobManifest = {
		apiVersion: "batch/v1",
		kind: "Job",
		metadata: {
			name: jobName,
			namespace,
			labels: {
				"app.kubernetes.io/managed-by": "bytesail",
				"bytesail.io/service": service.slug,
				"bytesail.io/component": "restore",
			},
		},
		spec: {
			backoffLimit: 0,
			template: {
				spec: {
					restartPolicy: "Never",
					containers: [
						{
							name: "restore",
							image: "minio/mc:latest",
							command: ["/bin/sh", "-c", restoreCmd],
							envFrom: [{ secretRef: { name: `${service.slug}-env`, optional: true } }],
							volumeMounts: [{ name: "backup-tmp", mountPath: "/backup" }],
						},
					],
					volumes: [{ name: "backup-tmp", emptyDir: { sizeLimit: "2Gi" } }],
				},
			},
		},
	};

	await k3s.batch.createNamespacedJob({ namespace, body: jobManifest });
	return jobName;
}
