import { db } from "@bytesail/db";
import { systemSettings } from "@bytesail/db/schema";
import { json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import semver from "semver";
import type { RequestHandler } from "./$types.js";

const GITHUB_REPO = "Eldritch-Logic/bytesail";

/**
 * Internal endpoint called by the K8s CronJob to check for updates.
 * Fetches the latest GitHub release, compares with the current version,
 * and writes the result to systemSettings.
 */
export const GET: RequestHandler = async () => {
	try {
		const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
			headers: { Accept: "application/vnd.github.v3+json" },
		});

		if (!res.ok) {
			return json({ ok: false, error: `GitHub API returned ${res.status}` }, { status: 502 });
		}

		const release = (await res.json()) as {
			tag_name: string;
			body: string;
			published_at: string;
			html_url: string;
		};

		const currentVersion = process.env.BYTESAIL_VERSION ?? "0.0.0";
		const latestVersion = release.tag_name.replace(/^v/, "");
		const current = semver.coerce(currentVersion);
		const latest = semver.coerce(latestVersion);

		if (current && latest && semver.gt(latest, current)) {
			const updateInfo = {
				currentVersion,
				latestVersion,
				releaseNotes: release.body ?? "",
				publishedAt: release.published_at,
				htmlUrl: release.html_url,
			};

			await db
				.insert(systemSettings)
				.values({ key: "update_available", value: updateInfo, updatedAt: new Date() })
				.onConflictDoUpdate({
					target: systemSettings.key,
					set: { value: updateInfo, updatedAt: new Date() },
				});

			return json({ ok: true, updateAvailable: updateInfo });
		}

		// Up to date — clear any stale update notification
		await db.delete(systemSettings).where(eq(systemSettings.key, "update_available"));
		return json({ ok: true, updateAvailable: null });
	} catch (e) {
		console.error("[ByteSail] Update check failed:", e);
		return json({ ok: false, error: "Update check failed" }, { status: 500 });
	}
};
