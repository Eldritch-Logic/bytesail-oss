import { db } from "@bytesail/db";
import { managedDatabases, projects, services } from "@bytesail/db/schema";
import { error } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ params }) => {
	const [project] = await db.select().from(projects).where(eq(projects.id, params.projectId));
	if (!project) error(404, "Project not found");

	const databases = await db
		.select()
		.from(managedDatabases)
		.where(eq(managedDatabases.projectId, params.projectId));

	const dbServices = await db
		.select()
		.from(services)
		.where(eq(services.projectId, params.projectId));

	return {
		project,
		databases: databases.map((d) => ({
			...d,
			service: dbServices.find((s) => s.id === d.serviceId),
		})),
	};
};
