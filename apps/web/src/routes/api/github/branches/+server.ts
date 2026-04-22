import { auth } from "@bytesail/auth";
import { db } from "@bytesail/db";
import { systemSettings } from "@bytesail/db/schema";
import { json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types.js";

export const GET: RequestHandler = async ({ request, url }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session) return json({ branches: [] }, { status: 401 });

	const owner = url.searchParams.get("owner");
	const repo = url.searchParams.get("repo");
	const installationId = url.searchParams.get("installationId");

	if (!owner || !repo || !installationId) {
		return json({ branches: [], error: "Missing owner, repo, or installationId" }, { status: 400 });
	}

	const [appSetting] = await db
		.select()
		.from(systemSettings)
		.where(eq(systemSettings.key, "github_app"));

	if (!appSetting) return json({ branches: [] });

	const appConfig = appSetting.value as { appId: string; privateKey: string };

	try {
		const { App } = await import("@octokit/app");
		const app = new App({ appId: appConfig.appId, privateKey: appConfig.privateKey });
		const octokit = await app.getInstallationOctokit(Number(installationId));
		const { data } = await octokit.request("GET /repos/{owner}/{repo}/branches", {
			owner,
			repo,
			per_page: 100,
		});
		return json({ branches: data });
	} catch (e) {
		console.error("[ByteSail] Failed to fetch branches:", e);
		return json({ branches: [] });
	}
};
