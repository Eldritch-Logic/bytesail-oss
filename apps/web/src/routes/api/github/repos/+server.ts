import { auth } from "@bytesail/auth";
import { db } from "@bytesail/db";
import { gitProviders, systemSettings } from "@bytesail/db/schema";
import { json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types.js";

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) return json({ repos: [], error: "Not authenticated" }, { status: 401 });

	const [appSetting] = await db
		.select()
		.from(systemSettings)
		.where(eq(systemSettings.key, "github_app"));

	if (!appSetting) return json({ repos: [], error: "No GitHub App configured" });

	const appConfig = appSetting.value as {
		appId: string;
		privateKey: string;
	};

	const providers = await db
		.select()
		.from(gitProviders)
		.where(eq(gitProviders.userId, session.user.id));

	const allRepos: unknown[] = [];

	for (const provider of providers) {
		if (!provider.githubInstallationId) continue;

		try {
			const { App } = await import("@octokit/app");
			const app = new App({
				appId: appConfig.appId,
				privateKey: appConfig.privateKey,
			});
			const octokit = await app.getInstallationOctokit(Number(provider.githubInstallationId));
			const { data } = await octokit.request("GET /installation/repositories", {
				per_page: 100,
			});
			allRepos.push(
				...data.repositories.map((r: Record<string, unknown>) => ({
					...r,
					installationId: provider.githubInstallationId,
					providerId: provider.id,
				})),
			);
		} catch (e) {
			console.error(
				`[ByteSail] Failed to fetch repos for installation ${provider.githubInstallationId}:`,
				e,
			);
		}
	}

	return json({ repos: allRepos });
};
