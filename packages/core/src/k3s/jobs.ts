import type { K3sClient } from "./client.js";
import { projectNamespace } from "./namespaces.js";

type BackupJobParams = {
	projectId: string;
	projectSlug: string;
	serviceSlug: string;
	dbType: string;
	dbName: string;
	dbUser: string;
	schedule?: string;
	s3Endpoint: string;
	s3Bucket: string;
	s3AccessKey: string;
	s3SecretKey: string;
	retentionDays: number;
};

const BACKUP_COMMANDS: Record<string, (dbName: string, dbUser: string) => string> = {
	postgresql: (dbName, dbUser) =>
		`pg_dump -U ${dbUser} -d ${dbName} | gzip > /backup/${dbName}-$(date +%Y%m%d-%H%M%S).sql.gz`,
	mysql: (dbName, dbUser) =>
		`mysqldump -u ${dbUser} -p"$MYSQL_PASSWORD" ${dbName} | gzip > /backup/${dbName}-$(date +%Y%m%d-%H%M%S).sql.gz`,
	mariadb: (dbName, dbUser) =>
		`mysqldump -u ${dbUser} -p"$MYSQL_PASSWORD" ${dbName} | gzip > /backup/${dbName}-$(date +%Y%m%d-%H%M%S).sql.gz`,
	mongodb: (dbName) =>
		`mongodump --db ${dbName} --archive=/backup/${dbName}-$(date +%Y%m%d-%H%M%S).archive --gzip`,
	redis: () =>
		`redis-cli BGSAVE && sleep 2 && cp /data/dump.rdb /backup/dump-$(date +%Y%m%d-%H%M%S).rdb`,
	keydb: () =>
		`keydb-cli BGSAVE && sleep 2 && cp /data/dump.rdb /backup/dump-$(date +%Y%m%d-%H%M%S).rdb`,
};

export function generateBackupCronJob(params: BackupJobParams) {
	const namespace = projectNamespace(params.projectId, params.projectSlug);
	const name = `backup-${params.serviceSlug}`;
	const backupCmd = BACKUP_COMMANDS[params.dbType];
	if (!backupCmd) throw new Error(`Unsupported db type for backup: ${params.dbType}`);

	const dumpCommand = backupCmd(params.dbName, params.dbUser);
	const uploadCommand = `mc alias set s3 ${params.s3Endpoint} ${params.s3AccessKey} ${params.s3SecretKey} && mc cp /backup/* s3/${params.s3Bucket}/${params.projectSlug}/${params.serviceSlug}/ && mc rm --older-than ${params.retentionDays}d --recursive --force s3/${params.s3Bucket}/${params.projectSlug}/${params.serviceSlug}/`;

	return {
		apiVersion: "batch/v1",
		kind: "CronJob",
		metadata: {
			name,
			namespace,
			labels: {
				"app.kubernetes.io/managed-by": "bytesail",
				"bytesail.io/service": params.serviceSlug,
				"bytesail.io/component": "backup",
			},
		},
		spec: {
			schedule: params.schedule ?? "0 2 * * *",
			concurrencyPolicy: "Forbid",
			successfulJobsHistoryLimit: 3,
			failedJobsHistoryLimit: 3,
			jobTemplate: {
				spec: {
					backoffLimit: 2,
					template: {
						metadata: {
							labels: {
								"bytesail.io/service": params.serviceSlug,
								"bytesail.io/component": "backup",
							},
						},
						spec: {
							restartPolicy: "OnFailure",
							containers: [
								{
									name: "backup",
									image: "minio/mc:latest",
									command: ["/bin/sh", "-c", `${dumpCommand} && ${uploadCommand}`],
									envFrom: [
										{
											secretRef: {
												name: `${params.serviceSlug}-env`,
												optional: true,
											},
										},
									],
									volumeMounts: [
										{
											name: "backup-tmp",
											mountPath: "/backup",
										},
									],
								},
							],
							volumes: [
								{
									name: "backup-tmp",
									emptyDir: { sizeLimit: "2Gi" },
								},
							],
						},
					},
				},
			},
		},
	};
}

export async function applyBackupCronJob(k3s: K3sClient, params: BackupJobParams): Promise<void> {
	const manifest = generateBackupCronJob(params);
	const name = manifest.metadata.name;
	const namespace = manifest.metadata.namespace;

	try {
		await k3s.batch.readNamespacedCronJob({ name, namespace });
		await k3s.batch.replaceNamespacedCronJob({ name, namespace, body: manifest });
	} catch {
		await k3s.batch.createNamespacedCronJob({ namespace, body: manifest });
	}
}

export async function deleteBackupCronJob(
	k3s: K3sClient,
	serviceSlug: string,
	projectId: string,
	projectSlug: string,
): Promise<void> {
	const namespace = projectNamespace(projectId, projectSlug);
	try {
		await k3s.batch.deleteNamespacedCronJob({
			name: `backup-${serviceSlug}`,
			namespace,
		});
	} catch {
		// CronJob might not exist
	}
}

export async function triggerBackupJobNow(
	k3s: K3sClient,
	serviceSlug: string,
	projectId: string,
	projectSlug: string,
): Promise<string> {
	const namespace = projectNamespace(projectId, projectSlug);
	const cronJobName = `backup-${serviceSlug}`;
	const jobName = `${cronJobName}-manual-${Date.now()}`;

	// Read the CronJob to get its spec
	const cronJob = await k3s.batch.readNamespacedCronJob({ name: cronJobName, namespace });

	const jobManifest = {
		apiVersion: "batch/v1",
		kind: "Job",
		metadata: {
			name: jobName,
			namespace,
			labels: {
				"app.kubernetes.io/managed-by": "bytesail",
				"bytesail.io/service": serviceSlug,
				"bytesail.io/component": "backup",
			},
		},
		spec: cronJob.spec?.jobTemplate?.spec,
	};

	await k3s.batch.createNamespacedJob({ namespace, body: jobManifest });
	return jobName;
}
