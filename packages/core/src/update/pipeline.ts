import { db } from "@bytesail/db";
import { systemSettings } from "@bytesail/db/schema";
import { eq } from "drizzle-orm";
import { createK3sClient } from "../k3s/client.js";

const BYTESAIL_DEPLOYMENT = "bytesail";
const BYTESAIL_NAMESPACE = "bytesail-system";
const BYTESAIL_IMAGE = "ghcr.io/eldritch-logic/bytesail";
const ROLLOUT_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 3_000;

export type UpdateStatus = "in_progress" | "success" | "failed";

type UpdateHistoryEntry = {
	from: string;
	to: string;
	at: string;
	status: UpdateStatus;
	error?: string;
	duration?: number;
};

async function appendUpdateHistory(entry: UpdateHistoryEntry) {
	const [existing] = await db
		.select()
		.from(systemSettings)
		.where(eq(systemSettings.key, "update_history"));

	const history: UpdateHistoryEntry[] = existing ? (existing.value as UpdateHistoryEntry[]) : [];

	history.unshift(entry);
	const trimmed = history.slice(0, 50);

	await db
		.insert(systemSettings)
		.values({ key: "update_history", value: trimmed, updatedAt: new Date() })
		.onConflictDoUpdate({
			target: systemSettings.key,
			set: { value: trimmed, updatedAt: new Date() },
		});
}

async function waitForRollout(k3s: ReturnType<typeof createK3sClient>): Promise<void> {
	const deadline = Date.now() + ROLLOUT_TIMEOUT_MS;

	while (Date.now() < deadline) {
		const deployment = await k3s.apps.readNamespacedDeployment({
			name: BYTESAIL_DEPLOYMENT,
			namespace: BYTESAIL_NAMESPACE,
		});

		const status = deployment.status;
		const spec = deployment.spec;

		if (
			status?.updatedReplicas === spec?.replicas &&
			status?.readyReplicas === spec?.replicas &&
			status?.availableReplicas === spec?.replicas
		) {
			return;
		}

		await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
	}

	throw new Error("Rollout timed out waiting for pods to become ready");
}

export async function performUpdate(targetVersion: string): Promise<void> {
	const k3s = createK3sClient();
	const currentVersion = process.env.BYTESAIL_VERSION ?? "0.0.0";
	const startTime = Date.now();

	await appendUpdateHistory({
		from: currentVersion,
		to: targetVersion,
		at: new Date().toISOString(),
		status: "in_progress",
	});

	try {
		// Verify cluster health
		const nodes = await k3s.core.listNode();
		const unhealthy = nodes.items.filter(
			(n) => !n.status?.conditions?.some((c) => c.type === "Ready" && c.status === "True"),
		);
		if (unhealthy.length > 0) {
			throw new Error(`${unhealthy.length} node(s) not ready`);
		}

		// Patch deployment image
		// biome-ignore lint/suspicious/noExplicitAny: K8s client typing doesn't include contentType for JSON Patch
		await (k3s.apps.patchNamespacedDeployment as any)({
			name: BYTESAIL_DEPLOYMENT,
			namespace: BYTESAIL_NAMESPACE,
			body: [
				{
					op: "replace",
					path: "/spec/template/spec/containers/0/image",
					value: `${BYTESAIL_IMAGE}:${targetVersion}`,
				},
				{
					op: "replace",
					path: "/spec/template/spec/initContainers/0/image",
					value: `${BYTESAIL_IMAGE}:${targetVersion}`,
				},
			],
			contentType: "application/json-patch+json",
		});

		// Wait for rollout
		await waitForRollout(k3s);

		const duration = Math.round((Date.now() - startTime) / 1000);

		// Update version in system settings
		await db
			.insert(systemSettings)
			.values({ key: "version", value: { current: targetVersion }, updatedAt: new Date() })
			.onConflictDoUpdate({
				target: systemSettings.key,
				set: { value: { current: targetVersion }, updatedAt: new Date() },
			});

		// Clear update_available
		await db.delete(systemSettings).where(eq(systemSettings.key, "update_available"));

		// Record success
		await appendUpdateHistory({
			from: currentVersion,
			to: targetVersion,
			at: new Date().toISOString(),
			status: "success",
			duration,
		});
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : "Unknown error";

		await appendUpdateHistory({
			from: currentVersion,
			to: targetVersion,
			at: new Date().toISOString(),
			status: "failed",
			error: errorMessage,
			duration: Math.round((Date.now() - startTime) / 1000),
		});

		throw e;
	}
}
