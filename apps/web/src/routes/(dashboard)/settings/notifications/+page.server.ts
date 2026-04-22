import { db } from "@bytesail/db";
import { notificationChannels } from "@bytesail/db/schema";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async () => {
	const channels = await db.select().from(notificationChannels);
	return { channels };
};
