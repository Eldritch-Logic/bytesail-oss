import { db } from "@bytesail/db";
import { systemSettings } from "@bytesail/db/schema";
import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types.js";

export const GET: RequestHandler = async ({ url }) => {
	const code = url.searchParams.get("code");

	if (!code) {
		redirect(303, "/settings/git?error=missing_code");
	}

	const response = await fetch(`https://api.github.com/app-manifests/${code}/conversions`, {
		method: "POST",
		headers: {
			Accept: "application/vnd.github+json",
		},
	});

	if (!response.ok) {
		console.error("[ByteSail] GitHub manifest conversion failed:", await response.text());
		redirect(303, "/settings/git?error=github_error");
	}

	const data = await response.json();

	const appConfig = {
		appId: String(data.id),
		appName: data.name,
		appSlug: data.slug,
		clientId: data.client_id,
		clientSecret: data.client_secret,
		privateKey: data.pem,
		webhookSecret: data.webhook_secret,
		owner: data.owner?.login,
		htmlUrl: data.html_url,
	};

	await db
		.insert(systemSettings)
		.values({
			key: "github_app",
			value: appConfig,
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: systemSettings.key,
			set: { value: appConfig, updatedAt: new Date() },
		});

	redirect(303, `/settings/git?success=true&app=${appConfig.appSlug}`);
};
