import type * as k8s from "@kubernetes/client-node";
import { createK3sClient } from "../k3s/client.js";

const BUILDER_NAMESPACE = "bytesail-system";
const BUILDKIT_IMAGE = "moby/buildkit:latest";
const BUILD_TIMEOUT_MS = 600_000;
const POLL_INTERVAL_MS = 3_000;

export async function buildWithDockerfile(params: {
	sourceDir: string;
	imageTag: string;
	dockerfilePath: string;
	buildArgs?: Record<string, string>;
	serviceId: string;
	deploymentId: string;
	registryUrl: string;
}): Promise<string> {
	const k3s = createK3sClient();
	const jobName = `build-${params.deploymentId.slice(0, 8)}`;
	const pvcName = `source-${params.deploymentId.slice(0, 8)}`;
	const fullImageTag = `${params.registryUrl}/${params.imageTag}`;

	const buildArgFlags = Object.entries(params.buildArgs ?? {}).flatMap(([key, value]) => [
		"--opt",
		`build-arg:${key}=${value}`,
	]);

	const job: k8s.V1Job = {
		apiVersion: "batch/v1",
		kind: "Job",
		metadata: {
			name: jobName,
			namespace: BUILDER_NAMESPACE,
			labels: {
				"app.kubernetes.io/managed-by": "bytesail",
				"bytesail.io/service-id": params.serviceId,
				"bytesail.io/deployment-id": params.deploymentId,
				"bytesail.io/component": "builder",
			},
		},
		spec: {
			backoffLimit: 0,
			ttlSecondsAfterFinished: 300,
			template: {
				metadata: {
					labels: {
						"bytesail.io/component": "builder",
						"bytesail.io/deployment-id": params.deploymentId,
					},
				},
				spec: {
					restartPolicy: "Never",
					containers: [
						{
							name: "builder",
							image: BUILDKIT_IMAGE,
							args: [
								"build",
								"--frontend",
								"dockerfile.v0",
								"--local",
								"context=/workspace",
								"--local",
								`dockerfile=/workspace/${params.dockerfilePath.replace(/\/[^/]+$/, "") || "."}`,
								"--opt",
								`filename=${params.dockerfilePath.split("/").pop() ?? "Dockerfile"}`,
								"--output",
								`type=image,name=${fullImageTag},push=true`,
								...buildArgFlags,
							],
							volumeMounts: [
								{ name: "source", mountPath: "/workspace" },
								{ name: "buildkit-cache", mountPath: "/var/lib/buildkit" },
							],
							securityContext: {
								privileged: true,
							},
							resources: {
								requests: { cpu: "500m", memory: "512Mi" },
								limits: { cpu: "2", memory: "2Gi" },
							},
						},
					],
					volumes: [
						{
							name: "source",
							persistentVolumeClaim: { claimName: pvcName },
						},
						{
							name: "buildkit-cache",
							persistentVolumeClaim: { claimName: "buildkit-cache" },
						},
					],
				},
			},
		},
	};

	await k3s.batch.createNamespacedJob({ namespace: BUILDER_NAMESPACE, body: job });

	const status = await waitForJob(k3s, jobName);

	if (status !== "succeeded") {
		throw new Error(`Build job ${jobName} ${status}`);
	}

	return fullImageTag;
}

async function waitForJob(
	k3s: ReturnType<typeof createK3sClient>,
	jobName: string,
): Promise<"succeeded" | "failed" | "timeout"> {
	const deadline = Date.now() + BUILD_TIMEOUT_MS;

	while (Date.now() < deadline) {
		const job = await k3s.batch.readNamespacedJob({
			name: jobName,
			namespace: BUILDER_NAMESPACE,
		});

		if (job.status?.succeeded && job.status.succeeded > 0) return "succeeded";
		if (job.status?.failed && job.status.failed > 0) return "failed";

		await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
	}

	return "timeout";
}
