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

async function resolveService(_program: Command, serviceName?: string) {
	const client = getClient();
	const projectId = getProjectId();
	const services = await client.service.list.query({ projectId });

	if (serviceName) {
		const svc = services.find((s) => s.name === serviceName || s.slug === serviceName);
		if (!svc) {
			console.log(chalk.red(`Service "${serviceName}" not found.`));
			process.exit(1);
		}
		return svc;
	}

	if (services.length === 1) return services[0];

	console.log(chalk.bold("Select a service:\n"));
	services.forEach((s, i) => {
		console.log(`  ${chalk.cyan(String(i + 1))}. ${s.name} ${chalk.dim(`(${s.type})`)}`);
	});
	console.log();

	const readline = await import("node:readline/promises");
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	const answer = await rl.question("Enter number: ");
	rl.close();

	const idx = parseInt(answer, 10) - 1;
	if (idx < 0 || idx >= services.length) {
		console.log(chalk.red("Invalid selection."));
		process.exit(1);
	}
	return services[idx];
}

export function registerVolumeCommands(program: Command) {
	const volume = program.command("volume").description("Manage persistent volumes");

	volume
		.command("list")
		.alias("ls")
		.option("-s, --service <name>", "Service name")
		.description("List volumes")
		.action(async (opts) => {
			const client = getClient();
			const svc = await resolveService(program, opts.service);
			const spinner = ora("Fetching volumes...").start();
			try {
				const volumes = await client.volume.list.query({ serviceId: svc.id });
				spinner.stop();

				if (volumes.length === 0) {
					console.log(chalk.dim("No volumes found."));
					return;
				}

				output(
					volumes.map((v) => ({
						name: v.name,
						mountPath: v.mountPath,
						size: `${v.sizeGb}GB`,
						status: v.status,
					})),
					[
						{ key: "name", header: "Name" },
						{ key: "mountPath", header: "Mount Path" },
						{ key: "size", header: "Size" },
						{
							key: "status",
							header: "Status",
							color: (v) =>
								v === "attached"
									? chalk.green(v)
									: v === "pending"
										? chalk.yellow(v)
										: chalk.dim(v),
						},
					],
					program.opts().json,
				);
			} catch (e) {
				spinner.fail("Failed to fetch volumes");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	volume
		.command("create")
		.argument("<name>", "Volume name")
		.requiredOption("--mount <path>", "Mount path inside container")
		.requiredOption("--size <gb>", "Size in GB")
		.option("-s, --service <name>", "Service name")
		.description("Create a volume")
		.action(async (_name: string, _opts) => {
			console.log(chalk.yellow("Volume management coming soon."));
		});

	volume
		.command("delete")
		.argument("<name>", "Volume name")
		.option("-s, --service <name>", "Service name")
		.description("Delete a volume")
		.action(async (_name: string, _opts) => {
			console.log(chalk.yellow("Volume management coming soon."));
		});
}
