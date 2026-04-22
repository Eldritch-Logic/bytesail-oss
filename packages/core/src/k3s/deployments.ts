import type * as k8s from "@kubernetes/client-node";
import type { K3sClient } from "./client.js";
import { projectNamespace } from "./namespaces.js";

type VolumeMount = { name: string; mountPath: string; size?: string };

type ServiceInfo = {
	slug: string;
	projectId: string;
	projectSlug: string;
	replicas: number;
	port?: number | null;
	cpuRequest?: string | null;
	memoryRequest?: string | null;
	cpuLimit?: string | null;
	memoryLimit?: string | null;
	healthCheckPath?: string | null;
	healthCheckPort?: number | null;
	healthCheckInterval?: number | null;
	command?: string | null;
	volumeMounts?: VolumeMount[] | null;
};

type DeploymentInfo = {
	id: string;
	imageTag: string;
	environmentSlug: string;
};

export function generateDeploymentManifest(
	service: ServiceInfo,
	deployment: DeploymentInfo,
): k8s.V1Deployment {
	const name = `${service.slug}-${deployment.environmentSlug}`;
	const namespace = projectNamespace(service.projectId, service.projectSlug);

	return {
		apiVersion: "apps/v1",
		kind: "Deployment",
		metadata: {
			name,
			namespace,
			labels: {
				"app.kubernetes.io/name": service.slug,
				"app.kubernetes.io/part-of": service.projectSlug,
				"app.kubernetes.io/managed-by": "bytesail",
				"bytesail.io/service": service.slug,
				"bytesail.io/environment": deployment.environmentSlug,
				"bytesail.io/deployment-id": deployment.id,
			},
		},
		spec: {
			replicas: service.replicas,
			selector: {
				matchLabels: { "bytesail.io/service": service.slug },
			},
			template: {
				metadata: {
					labels: {
						app: service.slug,
						"app.kubernetes.io/name": service.slug,
						"app.kubernetes.io/part-of": service.projectSlug,
						"app.kubernetes.io/managed-by": "bytesail",
						"bytesail.io/service": service.slug,
						"bytesail.io/project": service.projectSlug,
						"bytesail.io/environment": deployment.environmentSlug,
					},
					annotations: {
						"bytesail.io/deployment-id": deployment.id,
					},
				},
				spec: {
					containers: [
						{
							name: service.slug,
							image: deployment.imageTag,
							...(service.command ? { command: ["/bin/sh", "-c", service.command] } : {}),
							ports: [
								{
									containerPort: service.port ?? 3000,
									protocol: "TCP",
								},
							],
							envFrom: [
								{
									secretRef: {
										name: `${service.slug}-env`,
										optional: true,
									},
								},
							],
							resources: {
								requests: {
									...(service.cpuRequest ? { cpu: service.cpuRequest } : {}),
									...(service.memoryRequest ? { memory: service.memoryRequest } : {}),
								},
								limits: {
									...(service.cpuLimit ? { cpu: service.cpuLimit } : {}),
									...(service.memoryLimit ? { memory: service.memoryLimit } : {}),
								},
							},
							...(service.healthCheckPath
								? {
										livenessProbe: {
											httpGet: {
												path: service.healthCheckPath,
												port: service.healthCheckPort ?? 3000,
											},
											periodSeconds: service.healthCheckInterval ?? 30,
										},
										readinessProbe: {
											httpGet: {
												path: service.healthCheckPath,
												port: service.healthCheckPort ?? 3000,
											},
											periodSeconds: 10,
										},
									}
								: {}),
							...(service.volumeMounts && service.volumeMounts.length > 0
								? {
										volumeMounts: service.volumeMounts.map((vm) => ({
											name: vm.name,
											mountPath: vm.mountPath,
										})),
									}
								: {}),
						},
					],
					...(service.volumeMounts && service.volumeMounts.length > 0
						? {
								volumes: service.volumeMounts.map((vm) => ({
									name: vm.name,
									persistentVolumeClaim: { claimName: vm.name },
								})),
							}
						: {}),
				},
			},
		},
	};
}

export async function applyDeployment(k3s: K3sClient, manifest: k8s.V1Deployment): Promise<void> {
	const name = manifest.metadata?.name ?? "";
	const namespace = manifest.metadata?.namespace ?? "default";

	try {
		await k3s.apps.readNamespacedDeployment({ name, namespace });
		await k3s.apps.replaceNamespacedDeployment({ name, namespace, body: manifest });
	} catch {
		await k3s.apps.createNamespacedDeployment({ namespace, body: manifest });
	}
}

export async function deleteDeployment(
	k3s: K3sClient,
	name: string,
	namespace: string,
): Promise<void> {
	await k3s.apps.deleteNamespacedDeployment({ name, namespace });
}

export async function getDeploymentStatus(
	k3s: K3sClient,
	name: string,
	namespace: string,
): Promise<{ ready: number; available: number; replicas: number }> {
	const deployment = await k3s.apps.readNamespacedDeployment({ name, namespace });
	return {
		ready: deployment.status?.readyReplicas ?? 0,
		available: deployment.status?.availableReplicas ?? 0,
		replicas: deployment.status?.replicas ?? 0,
	};
}

export async function restartDeployment(
	k3s: K3sClient,
	name: string,
	namespace: string,
): Promise<void> {
	// biome-ignore lint/suspicious/noExplicitAny: K8s client typing doesn't include contentType for JSON Patch
	await (k3s.apps.patchNamespacedDeployment as any)({
		name,
		namespace,
		body: [
			{
				op: "replace",
				path: "/spec/template/metadata/annotations/kubectl.kubernetes.io~1restartedAt",
				value: new Date().toISOString(),
			},
		],
		contentType: "application/json-patch+json",
	});
}
