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

export function registerRunCommands(program: Command) {
	program
		.command("run")
		.argument("<command...>", "Command to run")
		.option("-s, --service <name>", "Service name")
		.description("Run a command with service environment variables injected")
		.action(async (commandArgs: string[], opts) => {
			const client = getClient();
			const svc = await resolveService(program, opts.service);

			const spinner = ora("Fetching environment variables...").start();
			try {
				const vars = await client.variable.list.query({ serviceId: svc.id });
				spinner.stop();

				const injectedEnv: Record<string, string> = { ...process.env } as Record<string, string>;
				for (const v of vars) {
					if (v.isSecret) {
						const revealed = await client.variable.reveal.query({ id: v.id });
						injectedEnv[v.key] = revealed.value;
					} else {
						injectedEnv[v.key] = v.value;
					}
				}

				console.log(chalk.dim(`Injecting ${vars.length} variable(s) from ${svc.name}\n`));

				const { spawn } = await import("node:child_process");
				const [cmd, ...args] = commandArgs;
				const child = spawn(cmd, args, {
					env: injectedEnv,
					stdio: "inherit",
					shell: true,
				});

				child.on("close", (code) => {
					process.exit(code ?? 0);
				});

				child.on("error", (err) => {
					console.error(chalk.red(`Failed to run command: ${err.message}`));
					process.exit(1);
				});
			} catch (e) {
				spinner.fail("Failed to fetch environment variables");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});
}
