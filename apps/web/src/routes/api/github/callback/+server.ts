import { auth } from "@bytesail/auth";
import { db } from "@bytesail/db";
import { gitProviders } from "@bytesail/db/schema";
import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types.js";

export const GET: RequestHandler = async ({ url, request }) => {
	const installationId = url.searchParams.get("installation_id");
	const setupAction = url.searchParams.get("setup_action");

	if (setupAction === "install" && installationId) {
		const session = await auth.api.getSession({ headers: request.headers });

		if (session) {
			await db.insert(gitProviders).values({
				userId: session.user.id,
				provider: "github",
				githubInstallationId: installationId,
			});
		}

		redirect(303, "/settings/git");
	}

	redirect(303, "/settings/git");
};
