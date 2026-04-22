import { auth } from "@bytesail/auth";
import { db } from "@bytesail/db";
import { projects } from "@bytesail/db/schema";
import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types.js";

export const load: LayoutServerLoad = async ({ request }) => {
	try {
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			redirect(303, "/login");
		}

		const allProjects = await db
			.select({ id: projects.id, name: projects.name, slug: projects.slug })
			.from(projects);

		return {
			session: {
				user: {
					name: session.user.name,
					email: session.user.email,
					image: session.user.image,
				},
			},
			projects: allProjects,
		};
	} catch (e) {
		if (e && typeof e === "object" && "status" in e) throw e;
		redirect(303, "/login");
	}
};
