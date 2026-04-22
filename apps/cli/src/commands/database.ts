import chalk from "chalk";
import type { Command } from "commander";
import ora from "ora";
import { getClient } from "../api/client.js";
import { getConfig, getProjectState } from "../config/store.js";
import { output } from "../output/format.js";

function getProjectId(): string {
	const state = getProjectState();
	const config = getConfig();
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
	return projectId;
}

export function registerDatabaseCommands(program: Command) {
	const db = program.command("db").description("Manage databases");

	db.command("add")
		.description("Add a new database")
		.action(async () => {
			const client = getClient();
			const projectId = getProjectId();

			const dbTypes = [
				{ name: "PostgreSQL", value: "postgresql" },
				{ name: "MySQL", value: "mysql" },
				{ name: "Redis", value: "redis" },
				{ name: "MongoDB", value: "mongodb" },
			];

			console.log(chalk.bold("Select database type:\n"));
			dbTypes.forEach((t, i) => {
				console.log(`  ${chalk.cyan(String(i + 1))}. ${t.name}`);
			});
			console.log();

			const readline = await import("node:readline/promises");
			const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

			const typeAnswer = await rl.question("Enter number: ");
			const typeIdx = parseInt(typeAnswer, 10) - 1;
			if (typeIdx < 0 || typeIdx >= dbTypes.length) {
				rl.close();
				console.log(chalk.red("Invalid selection."));
				process.exit(1);
			}

			const dbName = await rl.question("Database name: ");
			rl.close();

			if (!dbName.trim()) {
				console.log(chalk.red("Name is required."));
				process.exit(1);
			}

			const spinner = ora(`Creating ${dbTypes[typeIdx].name} database...`).start();
			try {
				await client.database.create.mutate({
					projectId,
					name: dbName.trim(),
					type: dbTypes[typeIdx].value,
				});
				spinner.succeed(`Database created: ${chalk.bold(dbName.trim())}`);
			} catch (e) {
				spinner.fail("Failed to create database");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	db.command("list")
		.alias("ls")
		.description("List databases")
		.action(async () => {
			const client = getClient();
			const projectId = getProjectId();

			const spinner = ora("Fetching databases...").start();
			try {
				const databases = await client.database.list.query({ projectId });
				spinner.stop();

				if (databases.length === 0) {
					console.log(chalk.dim("No databases found."));
					return;
				}

				output(
					databases.map((d) => ({
						name: d.name,
						type: d.type,
						version: d.version,
						status: d.status,
					})),
					[
						{ key: "name", header: "Name" },
						{ key: "type", header: "Type" },
						{ key: "version", header: "Version" },
						{
							key: "status",
							header: "Status",
							color: (v) =>
								v === "running" ? chalk.green(v) : v === "failed" ? chalk.red(v) : chalk.yellow(v),
						},
					],
					program.opts().json,
				);
			} catch (e) {
				spinner.fail("Failed to fetch databases");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	db.command("connect")
		.argument("<name>", "Database name")
		.description("Get database connection URL")
		.action(async (name: string) => {
			const client = getClient();
			const projectId = getProjectId();

			const spinner = ora("Fetching connection info...").start();
			try {
				const connInfo = await client.database.connect.query({ projectId, name });
				spinner.stop();
				console.log(chalk.bold("Connection URL:"));
				console.log(connInfo.url);
			} catch (e) {
				spinner.fail("Failed to fetch connection info");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	db.command("backup")
		.argument("<name>", "Database name")
		.description("Trigger a manual backup")
		.action(async (_name: string) => {
			console.log(chalk.yellow("Database backup coming soon."));
		});
}
