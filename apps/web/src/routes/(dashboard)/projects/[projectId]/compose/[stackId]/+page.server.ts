import { db } from "@bytesail/db";
import { composeStacks } from "@bytesail/db/schema";
import { error } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ params }) => {
	const [stack] = await db.select().from(composeStacks).where(eq(composeStacks.id, params.stackId));

	if (!stack) {
		error(404, "Compose stack not found");
	}

	return { stack, projectId: params.projectId };
};
