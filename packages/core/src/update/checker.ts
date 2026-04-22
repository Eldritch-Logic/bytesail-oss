import { db } from "@bytesail/db";
import { systemSettings } from "@bytesail/db/schema";
import { eq } from "drizzle-orm";
import { coerce, gt, valid } from "semver";
import { dispatchNotification } from "../notifications/dispatch.js";

const GITHUB_RELEASES_URL = "https://api.github.com/repos/Eldritch-Logic/bytesail/releases/latest";

export type UpdateInfo = {
	currentVersion: string;
	latestVersion: string;
	releaseNotes: string;
	publishedAt: string;
	htmlUrl: string;
};

export async function checkForUpdates(): Promise<UpdateInfo | null> {
	const currentVersion = process.env.BYTESAIL_VERSION ?? "0.0.0";
	const current = coerce(currentVersion);
	if (!current) return null;

	const response = await fetch(GITHUB_RELEASES_URL, {
		headers: { Accept: "application/vnd.github.v3+json" },
	});

	if (!response.ok) return null;

	const release = (await response.json()) as {
		tag_name: string;
		body: string;
		published_at: string;
		html_url: string;
	};

	const latest = coerce(release.tag_name);
	if (!latest || !valid(latest)) return null;

	if (gt(latest, current)) {
		const updateInfo: UpdateInfo = {
			currentVersion: current.version,
			latestVersion: latest.version,
			releaseNotes: release.body ?? "",
			publishedAt: release.published_at,
			htmlUrl: release.html_url,
		};

		await db
			.insert(systemSettings)
			.values({
				key: "update_available",
				value: updateInfo,
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: systemSettings.key,
				set: { value: updateInfo, updatedAt: new Date() },
			});

		await dispatchNotification({
			type: "system.update_available",
			title: `ByteSail ${latest.version} is available`,
			message: `Current: v${current.version}. Release notes: ${release.html_url}`,
			url: release.html_url,
		});

		return updateInfo;
	}

	await db.delete(systemSettings).where(eq(systemSettings.key, "update_available"));

	return null;
}
