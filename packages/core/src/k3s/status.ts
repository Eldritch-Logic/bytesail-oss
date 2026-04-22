import type { K3sClient } from "./client.js";
import { projectNamespace } from "./namespaces.js";

export type PodStatus = {
	serviceSlug: string;
	status: "running" | "failed" | "stopped" | "building" | "deploying";
	ready: number;
	total: number;
	restarts: number;
	message?: string;
};

export async function getProjectPodStatuses(
	k3s: K3sClient,
	projectId: string,
	projectSlug: string,
): Promise<PodStatus[]> {
	const namespace = projectNamespace(projectId, projectSlug);

	try {
		const response = await k3s.core.listNamespacedPod({ namespace });
		const pods = response.items ?? [];

		const serviceMap = new Map<string, PodStatus>();

		for (const pod of pods) {
			const svcLabel =
				pod.metadata?.labels?.["bytesail.io/service"] ??
				pod.metadata?.labels?.app ??
				pod.metadata?.labels?.["app.kubernetes.io/name"];

			if (!svcLabel) continue;

			if (!serviceMap.has(svcLabel)) {
				serviceMap.set(svcLabel, {
					serviceSlug: svcLabel,
					status: "stopped",
					ready: 0,
					total: 0,
					restarts: 0,
				});
			}

			const entry = serviceMap.get(svcLabel);
			if (!entry) continue;
			entry.total += 1;

			const phase = pod.status?.phase;
			const containerStatuses = pod.status?.containerStatuses ?? [];

			const totalRestarts = containerStatuses.reduce((sum, cs) => sum + (cs.restartCount ?? 0), 0);
			entry.restarts = Math.max(entry.restarts, totalRestarts);

			const hasWaiting = containerStatuses.some((cs) => cs.state?.waiting);
			const waitingReason = containerStatuses.find((cs) => cs.state?.waiting)?.state?.waiting
				?.reason;

			if (
				waitingReason === "CrashLoopBackOff" ||
				waitingReason === "Error" ||
				waitingReason === "ImagePullBackOff" ||
				waitingReason === "ErrImagePull"
			) {
				entry.status = "failed";
				entry.message = waitingReason;
			} else if (phase === "Running" && !hasWaiting) {
				const allReady = containerStatuses.every((cs) => cs.ready);
				if (allReady) {
					entry.ready += 1;
					if (entry.status !== "failed") entry.status = "running";
				} else {
					if (entry.status !== "failed") entry.status = "deploying";
				}
			} else if (phase === "Pending") {
				if (entry.status !== "failed" && entry.status !== "running") entry.status = "deploying";
			} else if (phase === "Failed") {
				entry.status = "failed";
				entry.message = pod.status?.reason ?? "Pod failed";
			} else if (phase === "Succeeded") {
				// Completed job pod, ignore
			}
		}

		return Array.from(serviceMap.values());
	} catch {
		return [];
	}
}
