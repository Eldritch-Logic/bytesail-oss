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

export function registerServiceCommands(program: Command) {
	const service = program.command("service").description("Manage services");

	service
		.command("list")
		.alias("ls")
		.description("List services in linked project")
		.action(async () => {
			const client = getClient();
			const projectId = getProjectId(program);
			const spinner = ora("Fetching services...").start();
			try {
				const services = await client.service.list.query({ projectId });
				spinner.stop();

				if (services.length === 0) {
					console.log(chalk.dim("No services found."));
					return;
				}

				output(
					services.map((s) => ({
						name: s.name,
						type: s.type,
						status: s.status ?? "stopped",
						replicas: s.replicas ?? 1,
						image: s.dockerImage
							? `${s.dockerImage}:${s.dockerTag ?? "latest"}`
							: s.repoOwner
								? `${s.repoOwner}/${s.repoName}`
								: "—",
						updated: new Date(s.updatedAt).toLocaleDateString(),
					})),
					[
						{ key: "name", header: "Name" },
						{ key: "type", header: "Type" },
						{
							key: "status",
							header: "Status",
							color: (v) =>
								v === "running"
									? chalk.green(v)
									: v === "failed"
										? chalk.red(v)
										: v === "building"
											? chalk.yellow(v)
											: chalk.dim(v),
						},
						{ key: "replicas", header: "Replicas" },
						{ key: "image", header: "Source" },
						{ key: "updated", header: "Updated" },
					],
					program.opts().json,
				);
			} catch (e) {
				spinner.fail("Failed to fetch services");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	service
		.command("info")
		.argument("<name>", "Service name")
		.description("Show detailed service info")
		.action(async (name: string) => {
			const client = getClient();
			const projectId = getProjectId(program);
			const spinner = ora("Fetching service...").start();
			try {
				const services = await client.service.list.query({ projectId });
				const svc = services.find((s) => s.name === name || s.slug === name);
				if (!svc) {
					spinner.fail(`Service "${name}" not found`);
					process.exit(1);
				}
				spinner.stop();

				if (program.opts().json) {
					console.log(JSON.stringify(svc, null, 2));
					return;
				}

				console.log(`\n  ${chalk.bold(svc.name)}`);
				console.log(
					`  ${chalk.dim("Status:")}      ${svc.status === "running" ? chalk.green(svc.status) : svc.status === "failed" ? chalk.red(svc.status) : svc.status}`,
				);
				console.log(`  ${chalk.dim("Type:")}        ${svc.type}`);
				console.log(`  ${chalk.dim("Replicas:")}    ${svc.replicas ?? 1}`);
				if (svc.dockerImage) {
					console.log(
						`  ${chalk.dim("Image:")}       ${svc.dockerImage}:${svc.dockerTag ?? "latest"}`,
					);
				}
				if (svc.repoOwner) {
					console.log(`  ${chalk.dim("Repo:")}        ${svc.repoOwner}/${svc.repoName}`);
					console.log(`  ${chalk.dim("Branch:")}      ${svc.repoBranch ?? "main"}`);
				}
				console.log(`  ${chalk.dim("Build:")}       ${svc.buildType ?? "railpacks"}`);
				console.log(`  ${chalk.dim("Source:")}      ${svc.sourceType}`);
				if (svc.cpuLimit) console.log(`  ${chalk.dim("CPU:")}         ${svc.cpuLimit}`);
				if (svc.memoryLimit) console.log(`  ${chalk.dim("Memory:")}      ${svc.memoryLimit}`);
				console.log(`  ${chalk.dim("Port:")}        ${svc.port ?? 3000}`);
				console.log(`  ${chalk.dim("Updated:")}     ${new Date(svc.updatedAt).toLocaleString()}`);
				console.log();
			} catch (e) {
				spinner.fail("Failed to fetch service");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	service
		.command("restart")
		.argument("<name>", "Service name")
		.description("Restart a service")
		.action(async (name: string) => {
			const client = getClient();
			const projectId = getProjectId(program);
			const spinner = ora(`Restarting ${name}...`).start();
			try {
				const services = await client.service.list.query({ projectId });
				const svc = services.find((s) => s.name === name || s.slug === name);
				if (!svc) {
					spinner.fail(`Service "${name}" not found`);
					process.exit(1);
				}
				await client.service.restart.mutate({ id: svc.id });
				spinner.succeed(`${name} restarted`);
			} catch (e) {
				spinner.fail(`Failed to restart ${name}`);
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	service
		.command("scale")
		.argument("<name>", "Service name")
		.requiredOption("-r, --replicas <n>", "Number of replicas", parseInt)
		.description("Scale a service")
		.action(async (name: string, opts: { replicas: number }) => {
			const client = getClient();
			const projectId = getProjectId(program);

			if (!program.opts().yes) {
				const readline = await import("node:readline/promises");
				const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
				const confirm = await rl.question(`Scale ${name} to ${opts.replicas} replicas? (y/N) `);
				rl.close();
				if (confirm.toLowerCase() !== "y") {
					console.log(chalk.yellow("Cancelled."));
					return;
				}
			}

			const spinner = ora(`Scaling ${name} to ${opts.replicas} replicas...`).start();
			try {
				const services = await client.service.list.query({ projectId });
				const svc = services.find((s) => s.name === name || s.slug === name);
				if (!svc) {
					spinner.fail(`Service "${name}" not found`);
					process.exit(1);
				}
				await client.service.scale.mutate({ id: svc.id, replicas: opts.replicas });
				spinner.succeed(`${name} scaled to ${opts.replicas} replicas`);
			} catch (e) {
				spinner.fail(`Failed to scale ${name}`);
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	service
		.command("delete")
		.argument("<name>", "Service name")
		.description("Delete a service")
		.action(async (name: string) => {
			const client = getClient();
			const projectId = getProjectId(program);

			const services = await client.service.list.query({ projectId });
			const svc = services.find((s) => s.name === name || s.slug === name);
			if (!svc) {
				console.log(chalk.red(`Service "${name}" not found.`));
				process.exit(1);
			}

			if (!program.opts().yes) {
				const readline = await import("node:readline/promises");
				const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
				const confirm = await rl.question(`Type "${svc.name}" to confirm deletion: `);
				rl.close();
				if (confirm !== svc.name) {
					console.log(chalk.yellow("Cancelled."));
					return;
				}
			}

			const spinner = ora(`Deleting ${svc.name}...`).start();
			try {
				await client.service.delete.mutate({ id: svc.id });
				spinner.succeed(`${svc.name} deleted`);
			} catch (e) {
				spinner.fail(`Failed to delete ${svc.name}`);
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});
}
