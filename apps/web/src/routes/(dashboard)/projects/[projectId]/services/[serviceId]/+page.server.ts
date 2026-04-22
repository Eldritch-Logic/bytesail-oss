import { db } from "@bytesail/db";
import { deployments, domains, environments, services, variables } from "@bytesail/db/schema";
import { error } from "@sveltejs/kit";
import { and, desc, eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ params }) => {
	const [service] = await db.select().from(services).where(eq(services.id, params.serviceId));

	if (!service) {
		error(404, "Service not found");
	}

	const recentDeployments = await db
		.select()
		.from(deployments)
		.where(eq(deployments.serviceId, params.serviceId))
		.orderBy(desc(deployments.createdAt))
		.limit(10);

	// Get default environment for variable loading
	const [defaultEnv] = await db
		.select()
		.from(environments)
		.where(and(eq(environments.projectId, service.projectId), eq(environments.isDefault, true)));

	let serviceVars: (typeof variables.$inferSelect)[] = [];
	if (defaultEnv) {
		serviceVars = await db
			.select()
			.from(variables)
			.where(
				and(eq(variables.serviceId, params.serviceId), eq(variables.environmentId, defaultEnv.id)),
			);
	}

	const serviceDomains = await db
		.select()
		.from(domains)
		.where(eq(domains.serviceId, params.serviceId));

	return {
		service,
		deployments: recentDeployments,
		variables: serviceVars.map((v) => ({
			...v,
			value: v.isSecret ? "••••••••" : v.value,
		})),
		domains: serviceDomains,
		defaultEnvironmentId: defaultEnv?.id ?? null,
	};
};
