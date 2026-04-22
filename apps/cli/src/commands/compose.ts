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

export function registerComposeCommands(program: Command) {
	const compose = program.command("compose").description("Manage compose stacks");

	compose
		.command("up")
		.option("-f, --file <path>", "Compose file path", "docker-compose.yml")
		.description("Deploy a compose stack")
		.action(async (opts) => {
			const client = getClient();
			const projectId = getProjectId();

			const fs = await import("node:fs");
			const path = await import("node:path");
			const filePath = path.resolve(opts.file);

			if (!fs.existsSync(filePath)) {
				console.log(chalk.red(`Compose file not found: ${filePath}`));
				process.exit(1);
			}

			const content = fs.readFileSync(filePath, "utf-8");
			const spinner = ora("Deploying compose stack...").start();
			try {
				const result = await client.compose.create.mutate({
					projectId,
					composeFile: content,
				});
				spinner.succeed(`Compose stack deployed: ${chalk.bold(result.name)}`);
			} catch (e) {
				spinner.fail("Failed to deploy compose stack");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	compose
		.command("down")
		.description("Stop a compose stack")
		.action(async () => {
			const client = getClient();
			const projectId = getProjectId();

			const spinner = ora("Stopping compose stack...").start();
			try {
				await client.compose.stop.mutate({ projectId });
				spinner.succeed("Compose stack stopped.");
			} catch (e) {
				spinner.fail("Failed to stop compose stack");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	compose
		.command("status")
		.description("Show compose stack status")
		.action(async () => {
			const client = getClient();
			const projectId = getProjectId();

			const spinner = ora("Fetching stack status...").start();
			try {
				const stack = await client.compose.status.query({ projectId });
				spinner.stop();

				if (!stack || stack.services.length === 0) {
					console.log(chalk.dim("No compose stack found."));
					return;
				}

				console.log(chalk.bold(`Stack: ${stack.name}\n`));
				output(
					stack.services.map((s) => ({
						name: s.name,
						image: s.image,
						status: s.status,
						replicas: `${s.readyReplicas}/${s.replicas}`,
					})),
					[
						{ key: "name", header: "Service" },
						{ key: "image", header: "Image" },
						{
							key: "status",
							header: "Status",
							color: (v) =>
								v === "running" ? chalk.green(v) : v === "failed" ? chalk.red(v) : chalk.yellow(v),
						},
						{ key: "replicas", header: "Replicas" },
					],
					program.opts().json,
				);
			} catch (e) {
				spinner.fail("Failed to fetch stack status");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});
}
