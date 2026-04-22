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

export function registerStatusCommands(program: Command) {
	program
		.command("status")
		.description("Show system and project status overview")
		.action(async () => {
			const client = getClient();
			const projectId = getProjectId();

			const spinner = ora("Fetching system status...").start();
			try {
				const overview = await client.monitoring.getSystemOverview.query();
				spinner.stop();

				console.log(chalk.bold("System Overview\n"));
				console.log(`  Nodes:    ${chalk.cyan(String(overview.nodeCount))}`);
				console.log(`  CPU:      ${formatPercent(overview.cpuPercent)}`);
				console.log(`  Memory:   ${formatPercent(overview.memoryPercent)}`);
				console.log(`  Storage:  ${formatPercent(overview.storagePercent)}`);
				console.log();

				// Fetch services for current project
				const services = await client.service.list.query({ projectId });

				if (services.length === 0) {
					console.log(chalk.dim("No services in this project."));
					return;
				}

				console.log(chalk.bold("Services\n"));
				output(
					services.map((s) => ({
						name: s.name,
						type: s.type,
						status: s.status,
					})),
					[
						{ key: "name", header: "Name" },
						{ key: "type", header: "Type" },
						{
							key: "status",
							header: "Status",
							color: (v) => {
								if (v === "running") return chalk.green(v);
								if (v === "building") return chalk.yellow(v);
								if (v === "failed") return chalk.red(v);
								if (v === "stopped") return chalk.dim(v);
								if (v === "queued") return chalk.blue(v);
								return v;
							},
						},
					],
					program.opts().json,
				);
			} catch (e) {
				spinner.fail("Failed to fetch status");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});
}

function formatPercent(value: number): string {
	const pct = `${value.toFixed(1)}%`;
	if (value > 90) return chalk.red(pct);
	if (value > 70) return chalk.yellow(pct);
	return chalk.green(pct);
}
