import type * as k8s from "@kubernetes/client-node";
import { createK3sClient } from "../k3s/client.js";

const BUILDER_NAMESPACE = "bytesail-system";
const BUILDER_IMAGE = "docker.io/library/bytesail-builder:latest";
const GIT_CLONE_IMAGE = "alpine/git:latest";
const BUILD_TIMEOUT_MS = 600_000;
const POLL_INTERVAL_MS = 3_000;

export async function buildWithRailpacks(params: {
	repoUrl: string;
	branch: string;
	imageTag: string;
	buildArgs?: Record<string, string>;
	serviceId: string;
	deploymentId: string;
	registryUrl: string;
	gitToken?: string;
	subdirectory?: string;
}): Promise<string> {
	const k3s = createK3sClient();
	const jobName = `build-${params.deploymentId.slice(0, 8)}`;
	const fullImageTag = `${params.registryUrl}/${params.imageTag}`;

	const cloneUrl = params.gitToken
		? params.repoUrl.replace("https://", `https://x-access-token:${params.gitToken}@`)
		: params.repoUrl;

	const workDir = params.subdirectory ? `/workspace/${params.subdirectory}` : "/workspace";

	const envArgs = Object.entries(params.buildArgs ?? {})
		.map(([key, value]) => `-e ${key}=${value}`)
		.join(" ");

	const registryUrl = params.registryUrl;

	// Use railpack CLI to generate the plan, then buildctl to build and push
	const _railpackEnvFlags = envArgs ? ` ${envArgs}` : "";

	const buildCmd = `mkdir -p /etc/buildkit && printf '[registry."${registryUrl}"]\\n  http = true\\n  insecure = true\\n' > /etc/buildkit/buildkitd.toml && buildkitd --config /etc/buildkit/buildkitd.toml & export BUILDKIT_HOST=unix:///run/buildkit/buildkitd.sock; i=0; while [ ! -S /run/buildkit/buildkitd.sock ] && [ "$i" -lt 30 ]; do echo "Waiting for buildkitd... ($i)"; sleep 1; i=$((i+1)); done; if [ ! -S /run/buildkit/buildkitd.sock ]; then echo "ERROR: buildkitd failed to start"; exit 1; fi && cd ${workDir} && railpack plan . > railpack-plan.json && buildctl build --frontend gateway.v0 --opt source=ghcr.io/railwayapp/railpack-frontend:latest --local context=. --local dockerfile=. --output type=image,name=${fullImageTag},push=true,registry.insecure=true --progress=plain`;

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
			ttlSecondsAfterFinished: 600,
			template: {
				metadata: {
					labels: {
						"bytesail.io/component": "builder",
						"bytesail.io/deployment-id": params.deploymentId,
					},
				},
				spec: {
					restartPolicy: "Never",
					initContainers: [
						{
							name: "clone",
							image: GIT_CLONE_IMAGE,
							args: [
								"clone",
								"--depth",
								"1",
								"--branch",
								params.branch,
								"--single-branch",
								cloneUrl,
								"/workspace",
							],
							volumeMounts: [{ name: "source", mountPath: "/workspace" }],
						},
					],
					containers: [
						{
							name: "builder",
							image: BUILDER_IMAGE,
							imagePullPolicy: "Never",
							command: ["/bin/sh", "-c"],
							args: [buildCmd],
							securityContext: {
								privileged: true,
							},
							volumeMounts: [
								{ name: "source", mountPath: "/workspace" },
								{ name: "buildkit-cache", mountPath: "/var/lib/buildkit" },
							],
							resources: {
								requests: { cpu: "500m", memory: "1Gi" },
								limits: { cpu: "2", memory: "4Gi" },
							},
						},
					],
					volumes: [
						{ name: "source", emptyDir: {} },
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
		const logs = await getBuildLogs(params.deploymentId);
		throw new Error(`Build failed:\n${logs.slice(-1000)}`);
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

export async function getBuildLogs(deploymentId: string): Promise<string> {
	const k3s = createK3sClient();
	const labelSelector = `bytesail.io/deployment-id=${deploymentId},bytesail.io/component=builder`;

	const pods = await k3s.core.listNamespacedPod({
		namespace: BUILDER_NAMESPACE,
		labelSelector,
	});

	if (pods.items.length === 0) return "";

	const podName = pods.items[0].metadata?.name;
	if (!podName) return "";

	const logs: string[] = [];

	try {
		const cloneLogs = await k3s.core.readNamespacedPodLog({
			name: podName,
			namespace: BUILDER_NAMESPACE,
			container: "clone",
		});
		if (typeof cloneLogs === "string" && cloneLogs) logs.push(`[clone]\n${cloneLogs}`);
	} catch {}

	try {
		const buildLogs = await k3s.core.readNamespacedPodLog({
			name: podName,
			namespace: BUILDER_NAMESPACE,
			container: "builder",
		});
		if (typeof buildLogs === "string" && buildLogs) logs.push(`[build]\n${buildLogs}`);
	} catch {}

	return logs.join("\n\n");
}
