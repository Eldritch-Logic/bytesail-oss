import chalk from "chalk";
import type { Command } from "commander";
import ora from "ora";
import { getClient } from "../api/client.js";
import { getConfig, getProjectState } from "../config/store.js";
import { output } from "../output/format.js";

function getProjectId(program: Command): string {
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

async function resolveService(program: Command, serviceName?: string) {
	const client = getClient();
	const projectId = getProjectId(program);
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

export function registerEnvCommands(program: Command) {
	const env = program.command("env").description("Manage environment variables");

	env
		.command("list")
		.alias("ls")
		.option("-s, --service <name>", "Service name")
		.description("List environment variables")
		.action(async (opts) => {
			const client = getClient();
			const svc = await resolveService(program, opts.service);
			const spinner = ora("Fetching variables...").start();
			try {
				const vars = await client.variable.list.query({ serviceId: svc.id });
				spinner.stop();

				if (vars.length === 0) {
					console.log(chalk.dim("No variables found."));
					return;
				}

				output(
					vars.map((v) => ({
						key: v.key,
						value: v.isSecret ? "••••••••" : v.value,
						secret: v.isSecret ? "yes" : "no",
					})),
					[
						{ key: "key", header: "Key" },
						{ key: "value", header: "Value" },
						{
							key: "secret",
							header: "Secret",
							color: (v) => (v === "yes" ? chalk.yellow(v) : chalk.dim(v)),
						},
					],
					program.opts().json,
				);
			} catch (e) {
				spinner.fail("Failed to fetch variables");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	env
		.command("set")
		.argument("<keyvalue>", "KEY=VALUE pair")
		.option("-s, --service <name>", "Service name")
		.option("--secret", "Mark as secret")
		.description("Set an environment variable")
		.action(async (keyvalue: string, opts) => {
			const eqIdx = keyvalue.indexOf("=");
			if (eqIdx <= 0) {
				console.log(chalk.red("Invalid format. Use KEY=VALUE"));
				process.exit(1);
			}

			const key = keyvalue.slice(0, eqIdx);
			const value = keyvalue.slice(eqIdx + 1);

			const client = getClient();
			const svc = await resolveService(program, opts.service);

			// Get default environment
			const envs = await client.environment.list.query({ projectId: svc.projectId });
			const defaultEnv = envs.find((e: { isDefault: boolean | null }) => e.isDefault);
			if (!defaultEnv) {
				console.log(chalk.red("No default environment found."));
				process.exit(1);
			}

			const spinner = ora(`Setting ${key}...`).start();
			try {
				await client.variable.set.mutate({
					serviceId: svc.id,
					environmentId: defaultEnv.id,
					key,
					value,
					isSecret: opts.secret ?? false,
				});
				spinner.succeed(`Variable set: ${chalk.bold(key)}`);
			} catch (e) {
				spinner.fail(`Failed to set ${key}`);
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	env
		.command("get")
		.argument("<key>", "Variable key")
		.option("-s, --service <name>", "Service name")
		.description("Get an environment variable value")
		.action(async (key: string, opts) => {
			const client = getClient();
			const svc = await resolveService(program, opts.service);
			try {
				const vars = await client.variable.list.query({ serviceId: svc.id });
				const variable = vars.find((v) => v.key === key);

				if (!variable) {
					console.log(chalk.red(`Variable "${key}" not found.`));
					process.exit(1);
				}

				if (variable.isSecret) {
					const revealed = await client.variable.reveal.query({ id: variable.id });
					console.log(revealed.value);
				} else {
					console.log(variable.value);
				}
			} catch (e) {
				console.error(chalk.red("Failed to get variable"));
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	env
		.command("delete")
		.argument("<key>", "Variable key")
		.option("-s, --service <name>", "Service name")
		.description("Delete an environment variable")
		.action(async (key: string, opts) => {
			const client = getClient();
			const svc = await resolveService(program, opts.service);

			const vars = await client.variable.list.query({ serviceId: svc.id });
			const variable = vars.find((v) => v.key === key);

			if (!variable) {
				console.log(chalk.red(`Variable "${key}" not found.`));
				process.exit(1);
			}

			if (!program.opts().yes) {
				const readline = await import("node:readline/promises");
				const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
				const confirm = await rl.question(`Delete ${key}? (y/N) `);
				rl.close();
				if (confirm.toLowerCase() !== "y") {
					console.log(chalk.yellow("Cancelled."));
					return;
				}
			}

			const spinner = ora(`Deleting ${key}...`).start();
			try {
				await client.variable.delete.mutate({ id: variable.id });
				spinner.succeed(`Variable deleted: ${chalk.bold(key)}`);
			} catch (e) {
				spinner.fail(`Failed to delete ${key}`);
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});
}
