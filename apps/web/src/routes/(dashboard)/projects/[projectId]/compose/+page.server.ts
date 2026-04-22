import { db } from "@bytesail/db";
import { composeStacks } from "@bytesail/db/schema";
import { eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ params }) => {
	const stacks = await db
		.select()
		.from(composeStacks)
		.where(eq(composeStacks.projectId, params.projectId));

	return { stacks, projectId: params.projectId };
};
