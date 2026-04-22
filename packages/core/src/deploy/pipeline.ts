import { db } from "@bytesail/db";
import {
	deployments,
	environments,
	gitProviders,
	projects,
	services,
	systemSettings,
} from "@bytesail/db/schema";
import { eq } from "drizzle-orm";
import { buildWithRailpacks, getBuildLogs } from "../build/railpacks.js";
import { getRegistryInternalUrl, getRegistryUrl, imageTag } from "../build/registry.js";
import { GitHubIntegration } from "../git/github.js";
import { createK3sClient } from "../k3s/client.js";
import { applyDeployment, generateDeploymentManifest } from "../k3s/deployments.js";
import { createProjectNamespace, projectNamespace } from "../k3s/namespaces.js";
import { applyService, generateServiceManifest } from "../k3s/services.js";
import { dispatchNotification } from "../notifications/dispatch.js";

type TriggerParams = {
	serviceId: string;
	environmentId: string;
	commitHash?: string;
	commitMessage?: string;
	commitAuthor?: string;
	branch?: string;
	trigger: "git_push" | "manual" | "cli" | "rollback" | "pr_preview" | "compose" | "api";
	triggeredBy?: string;
};

export async function triggerDeployment(params: TriggerParams): Promise<string> {
	const [service] = await db.select().from(services).where(eq(services.id, params.serviceId));
	if (!service) throw new Error("Service not found");

	const [project] = await db.select().from(projects).where(eq(projects.id, service.projectId));
	if (!project) throw new Error("Project not found");

	const [env] = await db
		.select()
		.from(environments)
		.where(eq(environments.id, params.environmentId));
	if (!env) throw new Error("Environment not found");

	// Determine version number
	const existing = await db
		.select()
		.from(deployments)
		.where(eq(deployments.serviceId, params.serviceId));
	const version = existing.length + 1;

	// Create deployment record
	const [deployment] = await db
		.insert(deployments)
		.values({
			serviceId: params.serviceId,
			environmentId: params.environmentId,
			version,
			commitHash: params.commitHash,
			commitMessage: params.commitMessage,
			commitAuthor: params.commitAuthor,
			branch: params.branch ?? service.repoBranch ?? "main",
			trigger: params.trigger,
			triggeredBy: params.triggeredBy,
			status: "queued",
			startedAt: new Date(),
		})
		.returning();

	// Run the pipeline asynchronously
	runPipeline(deployment.id, service, project, env, version).catch((e) => {
		console.error(`[ByteSail] Deployment ${deployment.id} failed:`, e);
	});

	return deployment.id;
}

async function getGitToken(service: typeof services.$inferSelect): Promise<string | undefined> {
	if (!service.gitProviderId) return undefined;

	const [provider] = await db
		.select()
		.from(gitProviders)
		.where(eq(gitProviders.id, service.gitProviderId));

	if (!provider?.githubInstallationId) return undefined;

	const [appSetting] = await db
		.select()
		.from(systemSettings)
		.where(eq(systemSettings.key, "github_app"));

	if (!appSetting) return undefined;

	const appConfig = appSetting.value as { appId: string; privateKey: string };

	try {
		const { App } = await import("@octokit/app");
		const app = new App({ appId: appConfig.appId, privateKey: appConfig.privateKey });
		const octokit = await app.getInstallationOctokit(Number(provider.githubInstallationId));
		const { data } = await octokit.request(
			"POST /app/installations/{installation_id}/access_tokens",
			{
				installation_id: Number(provider.githubInstallationId),
			},
		);
		return data.token;
	} catch (e) {
		console.error("[ByteSail] Failed to get git token:", e);
		return undefined;
	}
}

async function reportCommitStatus(
	service: typeof services.$inferSelect,
	commitHash: string | null | undefined,
	state: "pending" | "success" | "failure" | "error",
	description: string,
	targetUrl?: string,
): Promise<void> {
	if (!commitHash || !service.repoOwner || !service.repoName || !service.gitProviderId) return;

	try {
		const [provider] = await db
			.select()
			.from(gitProviders)
			.where(eq(gitProviders.id, service.gitProviderId));
		if (!provider?.githubInstallationId) return;

		const [appSetting] = await db
			.select()
			.from(systemSettings)
			.where(eq(systemSettings.key, "github_app"));
		if (!appSetting) return;

		const appConfig = appSetting.value as { appId: string; privateKey: string };
		const github = new GitHubIntegration(appConfig.appId, appConfig.privateKey);

		await github.createCommitStatus(Number(provider.githubInstallationId), {
			owner: service.repoOwner,
			repo: service.repoName,
			sha: commitHash,
			state,
			description,
			targetUrl,
		});
	} catch (e) {
		console.error("[ByteSail] Failed to report commit status:", e);
	}
}

async function runPipeline(
	deploymentId: string,
	service: typeof services.$inferSelect,
	project: typeof projects.$inferSelect,
	env: typeof environments.$inferSelect,
	version: number,
) {
	const startTime = Date.now();

	try {
		// Update status: building
		await updateStatus(deploymentId, "building");
		await updateServiceStatus(service.id, "building");

		await dispatchNotification({
			type: "deployment.started",
			title: "Deployment Started",
			message: `${project.name}/${service.name} v${version} is building...`,
		});

		const commitHash = (
			await db.select().from(deployments).where(eq(deployments.id, deploymentId))
		)[0]?.commitHash;
		await reportCommitStatus(service, commitHash, "pending", "ByteSail: Building...");

		let builtImageTag: string;

		if (service.sourceType === "docker_image" && service.dockerImage) {
			builtImageTag = `${service.dockerImage}:${service.dockerTag ?? "latest"}`;
		} else if (service.sourceType === "github" && service.repoOwner && service.repoName) {
			const tag = imageTag(project.slug, service.slug, version);
			const internalRegistryUrl = getRegistryInternalUrl();
			const externalRegistryUrl = getRegistryUrl();
			const gitToken = await getGitToken(service);
			const repoUrl = `https://github.com/${service.repoOwner}/${service.repoName}.git`;

			// Build and push using internal registry URL (accessible from build pod)
			await buildWithRailpacks({
				repoUrl,
				branch: service.repoBranch ?? "main",
				imageTag: tag,
				buildArgs: (service.buildArgs as Record<string, string>) ?? undefined,
				serviceId: service.id,
				deploymentId,
				registryUrl: internalRegistryUrl,
				gitToken,
				subdirectory: service.repoSubdirectory ?? undefined,
			});

			// Use external registry URL for K3s to pull (accessible from kubelet)
			builtImageTag = `${externalRegistryUrl}/${tag}`;
		} else {
			throw new Error("No valid source configured for this service");
		}

		const buildDuration = Math.round((Date.now() - startTime) / 1000);
		const buildLogs = await getBuildLogs(deploymentId);

		await db
			.update(deployments)
			.set({ imageTag: builtImageTag, buildDuration, buildLogs })
			.where(eq(deployments.id, deploymentId));

		// Update status: deploying
		await updateStatus(deploymentId, "deploying");
		await updateServiceStatus(service.id, "deploying");
		await reportCommitStatus(service, commitHash, "pending", "ByteSail: Deploying...");

		const k3s = createK3sClient();

		// Ensure namespace exists
		try {
			await createProjectNamespace(k3s, project.id, project.slug);
		} catch {
			// Namespace may already exist
		}

		// Sync environment variables to K8s Secret
		try {
			const { syncVariablesToSecret } = await import("../k3s/secrets.js");
			await syncVariablesToSecret(k3s, service.id, env.id);
		} catch (e) {
			console.error(`[ByteSail] Failed to sync variables to secret: ${e}`);
		}

		// Apply K3s Service
		const svcManifest = generateServiceManifest({
			slug: service.slug,
			projectId: project.id,
			projectSlug: project.slug,
			port: service.port ?? 3000,
		});
		await applyService(k3s, svcManifest);

		// Create PVCs for volume mounts
		const vols =
			(service.volumeMounts as Array<{ name: string; mountPath: string; size?: string }>) ?? [];
		const namespace = projectNamespace(project.id, project.slug);
		for (const vol of vols) {
			try {
				await k3s.core.readNamespacedPersistentVolumeClaim({ name: vol.name, namespace });
			} catch {
				await k3s.core.createNamespacedPersistentVolumeClaim({
					namespace,
					body: {
						apiVersion: "v1",
						kind: "PersistentVolumeClaim",
						metadata: {
							name: vol.name,
							namespace,
							labels: {
								"app.kubernetes.io/managed-by": "bytesail",
								"bytesail.io/service": service.slug,
							},
						},
						spec: {
							accessModes: ["ReadWriteOnce"],
							resources: { requests: { storage: vol.size ?? "1Gi" } },
						},
					},
				});
			}
		}

		// Apply K3s Deployment
		const deployManifest = generateDeploymentManifest(
			{
				slug: service.slug,
				projectId: project.id,
				projectSlug: project.slug,
				replicas: service.replicas ?? 1,
				port: service.port,
				cpuRequest: service.cpuRequest,
				memoryRequest: service.memoryRequest,
				cpuLimit: service.cpuLimit,
				memoryLimit: service.memoryLimit,
				healthCheckPath: service.healthCheckPath,
				healthCheckPort: service.healthCheckPort,
				healthCheckInterval: service.healthCheckInterval,
				command: service.command,
				volumeMounts: vols,
			},
			{
				id: deploymentId,
				imageTag: builtImageTag,
				environmentSlug: env.slug,
			},
		);
		await applyDeployment(k3s, deployManifest);

		const deployDuration = Math.round((Date.now() - startTime) / 1000);

		// Update status: running
		await db
			.update(deployments)
			.set({
				status: "running",
				deployDuration,
				completedAt: new Date(),
				k8sDeploymentName: `${service.slug}-${env.slug}`,
				k8sNamespace: projectNamespace(project.id, project.slug),
			})
			.where(eq(deployments.id, deploymentId));

		await updateServiceStatus(service.id, "running");
		await reportCommitStatus(service, commitHash, "success", `ByteSail: Deployed v${version}`);

		await dispatchNotification({
			type: "deployment.succeeded",
			title: "Deployment Succeeded",
			message: `${project.name}/${service.name} v${version} deployed successfully`,
		});
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : "Unknown error";
		const buildLogs = await getBuildLogs(deploymentId).catch(() => "");
		const failCommitHash = (
			await db.select().from(deployments).where(eq(deployments.id, deploymentId))
		)[0]?.commitHash;
		await reportCommitStatus(
			service,
			failCommitHash,
			"failure",
			`ByteSail: ${errorMessage.slice(0, 100)}`,
		);

		await db
			.update(deployments)
			.set({
				status: "failed",
				errorMessage,
				buildLogs,
				completedAt: new Date(),
			})
			.where(eq(deployments.id, deploymentId));

		await updateServiceStatus(service.id, "failed");

		await dispatchNotification({
			type: "deployment.failed",
			title: "Deployment Failed",
			message: `${project.name}/${service.name} v${version}: ${errorMessage}`,
		});
	}
}

async function updateStatus(
	deploymentId: string,
	status:
		| "queued"
		| "building"
		| "pushing"
		| "deploying"
		| "running"
		| "failed"
		| "cancelled"
		| "rolled_back",
) {
	await db.update(deployments).set({ status }).where(eq(deployments.id, deploymentId));
}

async function updateServiceStatus(
	serviceId: string,
	status: "running" | "deploying" | "stopped" | "failed" | "building" | "queued",
) {
	await db
		.update(services)
		.set({ status, updatedAt: new Date() })
		.where(eq(services.id, serviceId));
}
