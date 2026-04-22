import { db } from "@bytesail/db";
import { projects, services, variables } from "@bytesail/db/schema";
import { and, eq } from "drizzle-orm";
import type { K3sClient } from "./client.js";
import { restartDeployment } from "./deployments.js";
import { projectNamespace } from "./namespaces.js";

export async function syncVariablesToSecret(
	k3s: K3sClient,
	serviceId: string,
	environmentId: string,
	triggerRestart = false,
): Promise<void> {
	const [service] = await db.select().from(services).where(eq(services.id, serviceId));
	if (!service) return;

	const [project] = await db.select().from(projects).where(eq(projects.id, service.projectId));
	if (!project) return;

	const vars = await db
		.select()
		.from(variables)
		.where(and(eq(variables.serviceId, serviceId), eq(variables.environmentId, environmentId)));

	const namespace = projectNamespace(project.id, project.slug);
	const secretName = `${service.slug}-env`;

	const stringData: Record<string, string> = {};
	for (const v of vars) {
		stringData[v.key] = v.value;
	}

	const secretManifest = {
		apiVersion: "v1",
		kind: "Secret",
		metadata: {
			name: secretName,
			namespace,
			labels: {
				"app.kubernetes.io/managed-by": "bytesail",
				"bytesail.io/service": service.slug,
			},
		},
		stringData,
	};

	try {
		await k3s.core.readNamespacedSecret({ name: secretName, namespace });
		await k3s.core.replaceNamespacedSecret({
			name: secretName,
			namespace,
			body: secretManifest,
		});
	} catch {
		await k3s.core.createNamespacedSecret({ namespace, body: secretManifest });
	}

	if (triggerRestart) {
		try {
			const deploymentName = `${service.slug}-production`;
			await restartDeployment(k3s, deploymentName, namespace);
		} catch {
			// Deployment may not exist yet
		}
	}
}
