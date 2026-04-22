import { db } from "./index.js";
import { environments } from "./schema/environments.js";
import { projects } from "./schema/projects.js";

async function seed() {
	console.log("Seeding database...");

	const [project] = await db
		.insert(projects)
		.values({
			organizationId: "seed-org",
			name: "Demo Project",
			slug: "demo-project",
			description: "A sample project to get started with ByteSail",
		})
		.returning();

	await db.insert(environments).values({
		projectId: project.id,
		name: "Production",
		slug: "production",
		type: "production",
		isDefault: true,
	});

	console.log("Seed complete.");
}

seed()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("Seed failed:", err);
		process.exit(1);
	});
