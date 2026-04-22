import { db } from "@bytesail/db";
import {
	deployments,
	domains,
	environments,
	projects,
	services,
	variables,
} from "@bytesail/db/schema";
import { and, eq } from "drizzle-orm";
import { createK3sClient } from "../k3s/client.js";
import { deleteDeployment } from "../k3s/deployments.js";
import { deleteIngress } from "../k3s/ingress.js";
import { projectNamespace } from "../k3s/namespaces.js";
import { deleteService as deleteK3sService } from "../k3s/services.js";
import { triggerDeployment } from "./pipeline.js";

const _BASE_DOMAIN = process.env.BASE_DOMAIN ?? "";

export async function createOrUpdatePreview(params: {
	repoOwner: string;
	repoName: string;
	prNumber: number;
	prBranch: string;
	commitHash: string;
}): Promise<void> {
	const matchingServices = await db
		.select()
		.from(services)
		.where(
			and(
				eq(services.repoOwner, params.repoOwner),
				eq(services.repoName, params.repoName),
				eq(services.autoDeploy, true),
			),
		);

	for (const service of matchingServices) {
		const envSlug = `pr-${params.prNumber}`;
		const envName = `PR #${params.prNumber}`;

		let [previewEnv] = await db
			.select()
			.from(environments)
			.where(and(eq(environments.projectId, service.projectId), eq(environments.slug, envSlug)));

		if (!previewEnv) {
			[previewEnv] = await db
				.insert(environments)
				.values({
					projectId: service.projectId,
					name: envName,
					slug: envSlug,
					type: "preview",
					prNumber: params.prNumber,
					prBranch: params.prBranch,
					autoDestroy: true,
				})
				.returning();
		}

		try {
			await triggerDeployment({
				serviceId: service.id,
				environmentId: previewEnv.id,
				commitHash: params.commitHash,
				commitMessage: `PR #${params.prNumber}`,
				branch: params.prBranch,
				trigger: "pr_preview",
			});

			console.log(`[ByteSail] Preview deploy triggered for ${service.name} PR #${params.prNumber}`);
		} catch (e) {
			console.error(`[ByteSail] Preview deploy failed for ${service.name}:`, e);
		}
	}
}

export async function destroyPreview(params: {
	repoOwner: string;
	repoName: string;
	prNumber: number;
}): Promise<void> {
	const matchingServices = await db
		.select()
		.from(services)
		.where(and(eq(services.repoOwner, params.repoOwner), eq(services.repoName, params.repoName)));

	const k3s = createK3sClient();

	for (const service of matchingServices) {
		const envSlug = `pr-${params.prNumber}`;

		const [previewEnv] = await db
			.select()
			.from(environments)
			.where(and(eq(environments.projectId, service.projectId), eq(environments.slug, envSlug)));

		if (!previewEnv) continue;

		const [project] = await db.select().from(projects).where(eq(projects.id, service.projectId));
		if (!project) continue;

		const namespace = projectNamespace(project.id, project.slug);
		const deploymentName = `${service.slug}-${envSlug}`;

		try {
			await deleteDeployment(k3s, deploymentName, namespace);
		} catch {}

		try {
			await deleteK3sService(k3s, service.slug, namespace);
		} catch {}

		try {
			await deleteIngress(k3s, `${service.slug}-pr-${params.prNumber}`, namespace);
		} catch {}

		// Clean up DB records
		await db.delete(variables).where(eq(variables.environmentId, previewEnv.id));
		await db.delete(domains).where(eq(domains.environmentId, previewEnv.id));
		await db.delete(deployments).where(eq(deployments.environmentId, previewEnv.id));
		await db.delete(environments).where(eq(environments.id, previewEnv.id));

		console.log(
			`[ByteSail] Preview environment destroyed for ${service.name} PR #${params.prNumber}`,
		);
	}
}
