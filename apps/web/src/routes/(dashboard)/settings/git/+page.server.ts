import { auth } from "@bytesail/auth";
import { db } from "@bytesail/db";
import { deployments, gitProviders, systemSettings } from "@bytesail/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import type { PageServerLoad } from "./$types.js";

type GitHubAppConfig = {
	appId: string;
	appName: string;
	appSlug: string;
	clientId: string;
	clientSecret: string;
	owner?: string;
	htmlUrl?: string;
};

export const load: PageServerLoad = async ({ request }) => {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session) return { providers: [], githubApp: null };

		const providers = await db
			.select()
			.from(gitProviders)
			.where(eq(gitProviders.userId, session.user.id));

		const [appSetting] = await db
			.select()
			.from(systemSettings)
			.where(eq(systemSettings.key, "github_app"));

		const githubApp = appSetting ? (appSetting.value as GitHubAppConfig) : null;

		const webhookEvents = await db
			.select()
			.from(deployments)
			.where(inArray(deployments.trigger, ["git_push", "pr_preview"]))
			.orderBy(desc(deployments.createdAt))
			.limit(20);

		return { providers, githubApp, webhookEvents };
	} catch {
		return { providers: [], githubApp: null, webhookEvents: [] };
	}
};
