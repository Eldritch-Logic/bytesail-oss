import { db } from "@bytesail/db";
import { projects, services } from "@bytesail/db/schema";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async () => {
	const allServices = await db.select().from(services);
	const allProjects = await db
		.select({ id: projects.id, name: projects.name, slug: projects.slug })
		.from(projects);

	return { services: allServices, projects: allProjects };
};
