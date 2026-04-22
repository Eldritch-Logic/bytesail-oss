import { db } from "@bytesail/db";
import { auditLogs } from "@bytesail/db/schema";
import { desc } from "drizzle-orm";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async () => {
	const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(50);
	return { logs };
};
