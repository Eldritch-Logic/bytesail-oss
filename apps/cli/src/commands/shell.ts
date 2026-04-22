import chalk from "chalk";
import type { Command } from "commander";
import ora from "ora";
import { getClient } from "../api/client.js";
import { getConfig, getProjectState } from "../config/store.js";

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

export function registerShellCommands(program: Command) {
	program
		.command("shell")
		.argument("<service>", "Service name")
		.description("Open a shell in a running service container")
		.action(async (serviceName: string) => {
			const client = getClient();
			const projectId = getProjectId();

			const spinner = ora("Resolving service...").start();
			try {
				const services = await client.service.list.query({ projectId });
				const svc = services.find((s) => s.name === serviceName || s.slug === serviceName);

				if (!svc) {
					spinner.fail(`Service "${serviceName}" not found.`);
					process.exit(1);
				}
				spinner.stop();

				console.log(chalk.yellow("Shell access coming soon — use kubectl exec for now.\n"));
				console.log(chalk.bold("Run this command to access the container:"));
				console.log();
				console.log(
					chalk.cyan(
						`  kubectl exec -it deploy/${svc.slug} -n project-${svc.projectSlug ?? projectId} -- /bin/sh`,
					),
				);
				console.log();
			} catch (e) {
				spinner.fail("Failed to resolve service");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});
}
