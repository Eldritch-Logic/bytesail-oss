import { db } from "@bytesail/db";
import { projects, services } from "@bytesail/db/schema";
import { error } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ params }) => {
	const [service] = await db.select().from(services).where(eq(services.id, params.serviceId));
	if (!service) error(404, "Service not found");

	const [project] = await db.select().from(projects).where(eq(projects.id, service.projectId));
	if (!project) error(404, "Project not found");

	return {
		service,
		project,
		wsChannel: `service:logs:${service.slug}:${project.slug}`,
	};
};
