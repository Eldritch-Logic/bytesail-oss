import { db } from "@bytesail/db";
import { volumes } from "@bytesail/db/schema";
import { eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ params }) => {
	const vols = await db.select().from(volumes).where(eq(volumes.serviceId, params.serviceId));
	return { volumes: vols, serviceId: params.serviceId, projectId: params.projectId };
};
