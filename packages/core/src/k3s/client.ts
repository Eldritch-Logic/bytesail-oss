import * as k8s from "@kubernetes/client-node";

export function createK3sClient() {
	const kc = new k8s.KubeConfig();
	kc.loadFromDefault();

	return {
		core: kc.makeApiClient(k8s.CoreV1Api),
		apps: kc.makeApiClient(k8s.AppsV1Api),
		batch: kc.makeApiClient(k8s.BatchV1Api),
		networking: kc.makeApiClient(k8s.NetworkingV1Api),
		custom: kc.makeApiClient(k8s.CustomObjectsApi),
		watch: new k8s.Watch(kc),
		kubeConfig: kc,
	};
}

export type K3sClient = ReturnType<typeof createK3sClient>;

export async function checkK3sConnection(k3s: K3sClient): Promise<{
	connected: boolean;
	error?: string;
}> {
	try {
		await k3s.core.getAPIResources();
		return { connected: true };
	} catch (e) {
		return {
			connected: false,
			error: e instanceof Error ? e.message : "Failed to connect to K3s",
		};
	}
}
