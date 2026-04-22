import type * as k8s from "@kubernetes/client-node";
import type { K3sClient } from "./client.js";
import { projectNamespace } from "./namespaces.js";

type ServiceInfo = {
	slug: string;
	projectId: string;
	projectSlug: string;
	port?: number;
};

export function generateServiceManifest(service: ServiceInfo): k8s.V1Service {
	const name = service.slug;
	const namespace = projectNamespace(service.projectId, service.projectSlug);
	const port = service.port ?? 3000;

	return {
		apiVersion: "v1",
		kind: "Service",
		metadata: {
			name,
			namespace,
			labels: {
				"app.kubernetes.io/name": service.slug,
				"app.kubernetes.io/part-of": service.projectSlug,
				"app.kubernetes.io/managed-by": "bytesail",
				"bytesail.io/service": service.slug,
			},
		},
		spec: {
			type: "ClusterIP",
			ports: [{ port, targetPort: port, protocol: "TCP" }],
			selector: {
				"bytesail.io/service": service.slug,
			},
		},
	};
}

export async function applyService(k3s: K3sClient, manifest: k8s.V1Service): Promise<void> {
	const name = manifest.metadata?.name ?? "";
	const namespace = manifest.metadata?.namespace ?? "default";

	try {
		await k3s.core.readNamespacedService({ name, namespace });
		await k3s.core.replaceNamespacedService({ name, namespace, body: manifest });
	} catch {
		await k3s.core.createNamespacedService({ namespace, body: manifest });
	}
}

export async function deleteService(
	k3s: K3sClient,
	name: string,
	namespace: string,
): Promise<void> {
	await k3s.core.deleteNamespacedService({ name, namespace });
}
