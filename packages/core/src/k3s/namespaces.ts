import type { K3sClient } from "./client.js";

const PROJECT_NS_PREFIX = "project-";

export function projectNamespace(projectId: string, projectSlug: string): string {
	const idPrefix = projectId.split("-")[0];
	return `${PROJECT_NS_PREFIX}${idPrefix}-${projectSlug}`;
}

export async function createProjectNamespace(
	k3s: K3sClient,
	projectId: string,
	projectSlug: string,
): Promise<void> {
	const name = projectNamespace(projectId, projectSlug);
	await k3s.core.createNamespace({
		body: {
			metadata: {
				name,
				labels: {
					"app.kubernetes.io/managed-by": "bytesail",
					"bytesail.io/project": projectSlug,
					"bytesail.io/project-id": projectId,
				},
			},
		},
	});
}

export async function deleteProjectNamespace(
	k3s: K3sClient,
	projectId: string,
	projectSlug: string,
): Promise<void> {
	const name = projectNamespace(projectId, projectSlug);
	await k3s.core.deleteNamespace({ name, body: {} });
}
