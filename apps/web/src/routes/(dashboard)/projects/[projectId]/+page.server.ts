import { db } from "@bytesail/db";
import { projects, serviceDependencies, services } from "@bytesail/db/schema";
import { error } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ params }) => {
	const [project] = await db.select().from(projects).where(eq(projects.id, params.projectId));

	if (!project) {
		error(404, "Project not found");
	}

	const projectServices = await db
		.select()
		.from(services)
		.where(eq(services.projectId, params.projectId));

	const dependencies = await db
		.select()
		.from(serviceDependencies)
		.where(eq(serviceDependencies.projectId, params.projectId));

	return { project, services: projectServices, dependencies };
};
