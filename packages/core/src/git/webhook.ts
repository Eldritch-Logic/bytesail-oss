import { db } from "@bytesail/db";
import { environments, gitProviders, services } from "@bytesail/db/schema";
import { and, eq } from "drizzle-orm";
import { triggerDeployment } from "../deploy/pipeline.js";
import { createOrUpdatePreview, destroyPreview } from "../deploy/preview.js";

type PushPayload = {
	ref: string;
	head_commit: {
		id: string;
		message: string;
		author: { name: string };
	};
	repository: {
		name: string;
		owner: { login: string };
	};
};

type PRPayload = {
	action: string;
	pull_request: {
		number: number;
		head: { ref: string; sha: string };
	};
	repository: {
		name: string;
		owner: { login: string };
	};
};

type InstallationPayload = {
	action: string;
	installation: {
		id: number;
		account: { login: string };
	};
	sender: { login: string; id: number };
};

export async function handleGitHubWebhook(event: string, payload: unknown): Promise<void> {
	switch (event) {
		case "push":
			await handlePushEvent(payload as PushPayload);
			break;
		case "pull_request":
			await handlePREvent(payload as PRPayload);
			break;
		case "installation":
			await handleInstallationEvent(payload as InstallationPayload);
			break;
		default:
			console.log(`[ByteSail] Ignoring webhook event: ${event}`);
	}
}

async function handlePushEvent(payload: PushPayload): Promise<void> {
	const branch = payload.ref.replace("refs/heads/", "");
	const { repository, head_commit } = payload;

	const matchingServices = await db
		.select()
		.from(services)
		.where(
			and(
				eq(services.repoOwner, repository.owner.login),
				eq(services.repoName, repository.name),
				eq(services.repoBranch, branch),
				eq(services.autoDeploy, true),
			),
		);

	for (const service of matchingServices) {
		const [defaultEnv] = await db
			.select()
			.from(environments)
			.where(and(eq(environments.projectId, service.projectId), eq(environments.isDefault, true)));

		if (!defaultEnv) continue;

		try {
			await triggerDeployment({
				serviceId: service.id,
				environmentId: defaultEnv.id,
				commitHash: head_commit.id,
				commitMessage: head_commit.message,
				commitAuthor: head_commit.author.name,
				branch,
				trigger: "git_push",
			});
			console.log(`[ByteSail] Auto-deploy triggered for ${service.name} on push to ${branch}`);
		} catch (e) {
			console.error(`[ByteSail] Failed to trigger deploy for ${service.name}:`, e);
		}
	}
}

async function handlePREvent(payload: PRPayload): Promise<void> {
	const { action, pull_request, repository } = payload;

	if (action === "opened" || action === "synchronize") {
		await createOrUpdatePreview({
			repoOwner: repository.owner.login,
			repoName: repository.name,
			prNumber: pull_request.number,
			prBranch: pull_request.head.ref,
			commitHash: pull_request.head.sha,
		});
	}

	if (action === "closed") {
		await destroyPreview({
			repoOwner: repository.owner.login,
			repoName: repository.name,
			prNumber: pull_request.number,
		});
	}
}

async function handleInstallationEvent(payload: InstallationPayload): Promise<void> {
	const { action, installation } = payload;

	if (action === "created") {
		console.log(
			`[ByteSail] GitHub App installed on ${installation.account.login} (installation ${installation.id})`,
		);
	}

	if (action === "deleted") {
		console.log(
			`[ByteSail] GitHub App uninstalled from ${installation.account.login} (installation ${installation.id})`,
		);

		await db
			.delete(gitProviders)
			.where(eq(gitProviders.githubInstallationId, String(installation.id)));
	}
}
