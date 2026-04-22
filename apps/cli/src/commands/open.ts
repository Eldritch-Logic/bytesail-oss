import chalk from "chalk";
import type { Command } from "commander";
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

export function registerOpenCommands(program: Command) {
	program
		.command("open")
		.argument("[service]", "Service name (opens service page)")
		.description("Open project dashboard or service page in browser")
		.action(async (serviceName?: string) => {
			const config = getConfig();
			const projectId = getProjectId();
			const baseUrl = config.serverUrl ?? "http://localhost:5173";

			let url: string;

			if (serviceName) {
				const client = getClient();
				const services = await client.service.list.query({ projectId });
				const svc = services.find((s) => s.name === serviceName || s.slug === serviceName);
				if (!svc) {
					console.log(chalk.red(`Service "${serviceName}" not found.`));
					process.exit(1);
				}
				url = `${baseUrl}/project/${projectId}/service/${svc.id}`;
			} else {
				url = `${baseUrl}/project/${projectId}`;
			}

			const { exec } = await import("node:child_process");
			const platform = process.platform;
			const openCmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";

			exec(`${openCmd} ${url}`, (err) => {
				if (err) {
					console.log(chalk.yellow("Could not open browser. Visit:"));
					console.log(chalk.cyan(url));
				} else {
					console.log(chalk.green(`Opened ${chalk.bold(url)}`));
				}
			});
		});
}
