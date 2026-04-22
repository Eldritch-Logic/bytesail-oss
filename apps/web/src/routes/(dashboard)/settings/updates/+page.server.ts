import { trpc } from "$lib/trpc.js";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async () => {
	try {
		return await trpc.settings.getUpdateStatus.query();
	} catch {
		return {
			currentVersion: process.env.BYTESAIL_VERSION ?? "dev",
			updateAvailable: null,
			updateHistory: [],
		};
	}
};
