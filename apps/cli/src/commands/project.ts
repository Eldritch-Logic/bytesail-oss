import chalk from "chalk";
import type { Command } from "commander";
import open from "open";
import ora from "ora";
import { getClient } from "../api/client.js";
import {
	clearProjectState,
	getConfig,
	getProjectState,
	saveProjectState,
} from "../config/store.js";
import { output } from "../output/format.js";

export function registerProjectCommands(program: Command) {
	const project = program.command("project").description("Manage projects");

	project
		.command("list")
		.alias("ls")
		.description("List all projects")
		.action(async () => {
			const client = getClient();
			const spinner = ora("Fetching projects...").start();
			try {
				const projects = await client.project.list.query();
				spinner.stop();

				if (projects.length === 0) {
					console.log(chalk.dim("No projects found."));
					return;
				}

				const jsonMode = program.opts().json;
				output(
					projects.map((p) => ({
						name: p.name,
						slug: p.slug,
						id: p.id,
						updated: new Date(p.updatedAt).toLocaleDateString(),
					})),
					[
						{ key: "name", header: "Name" },
						{ key: "slug", header: "Slug" },
						{ key: "id", header: "ID" },
						{ key: "updated", header: "Updated" },
					],
					jsonMode,
				);
			} catch (e) {
				spinner.fail("Failed to fetch projects");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	project
		.command("create")
		.argument("<name>", "Project name")
		.description("Create a new project")
		.action(async (name: string) => {
			const client = getClient();
			const spinner = ora(`Creating project "${name}"...`).start();
			try {
				const p = await client.project.create.mutate({ name });
				spinner.succeed(`Project created: ${chalk.bold(p.name)} (${chalk.dim(p.id)})`);

				const config = getConfig();
				if (config.instanceUrl) {
					console.log(`  ${chalk.dim("URL:")} ${config.instanceUrl}/projects/${p.id}`);
				}
			} catch (e) {
				spinner.fail("Failed to create project");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	project
		.command("link")
		.argument("[project-id]", "Project ID to link")
		.description("Link current directory to a project")
		.action(async (projectId?: string) => {
			const client = getClient();

			if (!projectId) {
				const projects = await client.project.list.query();
				if (projects.length === 0) {
					console.log(chalk.dim("No projects found. Create one first."));
					process.exit(1);
				}

				console.log(chalk.bold("Select a project:\n"));
				projects.forEach((p, i) => {
					console.log(`  ${chalk.cyan(String(i + 1))}. ${p.name} ${chalk.dim(`(${p.id})`)}`);
				});
				console.log();

				const readline = await import("node:readline/promises");
				const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
				const answer = await rl.question("Enter number: ");
				rl.close();

				const idx = parseInt(answer, 10) - 1;
				if (idx < 0 || idx >= projects.length) {
					console.log(chalk.red("Invalid selection."));
					process.exit(1);
				}

				projectId = projects[idx].id;
				saveProjectState({ projectId });
				console.log(chalk.green("✓"), `Linked to ${chalk.bold(projects[idx].name)}`);
			} else {
				saveProjectState({ projectId });
				console.log(chalk.green("✓"), `Linked to project ${chalk.dim(projectId)}`);
			}
		});

	project
		.command("unlink")
		.description("Unlink current directory from a project")
		.action(() => {
			clearProjectState();
			console.log(chalk.green("✓"), "Project unlinked");
		});

	project
		.command("open")
		.description("Open project in browser")
		.action(async () => {
			const config = getConfig();
			const state = getProjectState();

			if (!config.instanceUrl) {
				console.log(chalk.red("Not configured."), "Run", chalk.cyan("bytesail login"), "first.");
				process.exit(1);
			}

			const projectId = state.projectId ?? config.defaultProject;
			if (!projectId) {
				console.log(
					chalk.red("No project linked."),
					"Run",
					chalk.cyan("bytesail project link"),
					"first.",
				);
				process.exit(1);
			}

			const url = `${config.instanceUrl}/projects/${projectId}`;
			console.log(`Opening ${chalk.cyan(url)}...`);
			await open(url);
		});

	project
		.command("delete")
		.argument("<name>", "Project name to delete")
		.description("Delete a project")
		.action(async (name: string) => {
			const client = getClient();
			const projects = await client.project.list.query();
			const match = projects.find((p) => p.name === name || p.slug === name);

			if (!match) {
				console.log(chalk.red(`Project "${name}" not found.`));
				process.exit(1);
			}

			if (!program.opts().yes) {
				const readline = await import("node:readline/promises");
				const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
				const confirm = await rl.question(`Type "${match.name}" to confirm deletion: `);
				rl.close();

				if (confirm !== match.name) {
					console.log(chalk.yellow("Cancelled."));
					return;
				}
			}

			const spinner = ora(`Deleting "${match.name}"...`).start();
			try {
				await client.project.delete.mutate({ id: match.id });
				spinner.succeed(`Project "${match.name}" deleted`);
			} catch (e) {
				spinner.fail("Failed to delete project");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});
}
