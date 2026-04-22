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
		console.log(chalk.red("No project linked."));
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
	for (let i = 0; i < services.length; i++) {
		console.log(`  ${chalk.cyan(String(i + 1))}. ${services[i].name}`);
	}
	const readline = await import("node:readline/promises");
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	const idx = parseInt(await rl.question("\nEnter number: "), 10) - 1;
	rl.close();
	if (idx < 0 || idx >= services.length) {
		console.log(chalk.red("Invalid."));
		process.exit(1);
	}
	return services[idx];
}

export function registerDomainCommands(program: Command) {
	const domain = program.command("domain").description("Manage domains");

	domain
		.command("list")
		.alias("ls")
		.option("-s, --service <name>", "Service")
		.description("List domains")
		.action(async (opts) => {
			const client = getClient();
			const svc = await resolveService(program, opts.service);
			const domains = await client.domain.list.query({ serviceId: svc.id });
			if (domains.length === 0) {
				console.log(chalk.dim("No domains."));
				return;
			}
			output(
				domains.map((d) => ({
					hostname: d.hostname,
					port: d.port,
					tls: d.tlsEnabled ? "yes" : "no",
					generated: d.isGenerated ? "yes" : "no",
				})),
				[
					{ key: "hostname", header: "Hostname" },
					{ key: "port", header: "Port" },
					{
						key: "tls",
						header: "TLS",
						color: (v) => (v === "yes" ? chalk.green(v) : chalk.dim(v)),
					},
					{ key: "generated", header: "Generated" },
				],
				program.opts().json,
			);
		});

	domain
		.command("add")
		.argument("<hostname>", "Domain hostname")
		.option("-s, --service <name>", "Service")
		.option("--no-tls", "Disable TLS")
		.description("Add a domain")
		.action(async (hostname: string, opts) => {
			const client = getClient();
			const svc = await resolveService(program, opts.service);
			const envs = await client.environment.list.query({ projectId: svc.projectId });
			const defaultEnv = envs.find((e: { isDefault: boolean | null }) => e.isDefault);
			if (!defaultEnv) {
				console.log(chalk.red("No default environment."));
				process.exit(1);
			}
			const spinner = ora(`Adding ${hostname}...`).start();
			try {
				await client.domain.add.mutate({
					serviceId: svc.id,
					environmentId: defaultEnv.id,
					hostname,
					port: svc.port ?? 3000,
					tlsEnabled: opts.tls !== false,
				});
				spinner.succeed(`Domain added: ${chalk.bold(hostname)}`);
			} catch (e) {
				spinner.fail("Failed");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	domain
		.command("remove")
		.argument("<hostname>", "Domain hostname")
		.option("-s, --service <name>", "Service")
		.description("Remove a domain")
		.action(async (hostname: string, opts) => {
			const client = getClient();
			const svc = await resolveService(program, opts.service);
			const domains = await client.domain.list.query({ serviceId: svc.id });
			const match = domains.find((d) => d.hostname === hostname);
			if (!match) {
				console.log(chalk.red(`Domain "${hostname}" not found.`));
				process.exit(1);
			}
			const spinner = ora(`Removing ${hostname}...`).start();
			try {
				await client.domain.remove.mutate({ id: match.id });
				spinner.succeed(`Domain removed: ${chalk.bold(hostname)}`);
			} catch (e) {
				spinner.fail("Failed");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});
}
