import { db } from "@bytesail/db";
import { projects } from "@bytesail/db/schema";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async () => {
	try {
		const allProjects = await db.select().from(projects);
		return { projects: allProjects, loading: false };
	} catch {
		return { projects: [], loading: false };
	}
};
