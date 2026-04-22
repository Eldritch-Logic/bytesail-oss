import type * as k8s from "@kubernetes/client-node";
import type { K3sClient } from "./client.js";

type IngressParams = {
	hostname: string;
	serviceSlug: string;
	namespace: string;
	port: number;
	path: string;
	tlsEnabled: boolean;
};

export function generateIngressManifest(params: IngressParams): k8s.V1Ingress {
	const name = `${params.serviceSlug}-${params.hostname.replace(/\./g, "-")}`;

	const ingress: k8s.V1Ingress = {
		apiVersion: "networking.k8s.io/v1",
		kind: "Ingress",
		metadata: {
			name,
			namespace: params.namespace,
			labels: {
				"app.kubernetes.io/managed-by": "bytesail",
				"bytesail.io/service": params.serviceSlug,
			},
			annotations: {
				"traefik.ingress.kubernetes.io/router.entrypoints": "web,websecure",
			},
		},
		spec: {
			rules: [
				{
					host: params.hostname,
					http: {
						paths: [
							{
								path: params.path,
								pathType: "Prefix",
								backend: {
									service: {
										name: params.serviceSlug,
										port: { number: params.port },
									},
								},
							},
						],
					},
				},
			],
		},
	};

	if (params.tlsEnabled) {
		if (ingress.metadata?.annotations) {
			ingress.metadata.annotations["cert-manager.io/cluster-issuer"] = "letsencrypt-prod";
		}
		if (ingress.spec) {
			ingress.spec.tls = [
				{
					hosts: [params.hostname],
					secretName: `tls-${name}`,
				},
			];
		}
	}

	return ingress;
}

export async function applyIngress(k3s: K3sClient, manifest: k8s.V1Ingress): Promise<void> {
	const name = manifest.metadata?.name ?? "";
	const namespace = manifest.metadata?.namespace ?? "default";

	try {
		await k3s.networking.readNamespacedIngress({ name, namespace });
		await k3s.networking.replaceNamespacedIngress({ name, namespace, body: manifest });
	} catch {
		await k3s.networking.createNamespacedIngress({ namespace, body: manifest });
	}
}

export async function deleteIngress(
	k3s: K3sClient,
	name: string,
	namespace: string,
): Promise<void> {
	await k3s.networking.deleteNamespacedIngress({ name, namespace });
}
