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

export function registerDeployCommands(program: Command) {
	program
		.command("up")
		.description("Deploy a service")
		.option("-s, --service <name>", "Service to deploy")
		.option("-d, --detach", "Trigger and return immediately")
		.action(async (opts) => {
			const client = getClient();
			const projectId = getProjectId(program);

			const services = await client.service.list.query({ projectId });
			if (services.length === 0) {
				console.log(chalk.dim("No services found in this project."));
				process.exit(1);
			}

			let targetService = opts.service
				? services.find((s) => s.name === opts.service || s.slug === opts.service)
				: services.length === 1
					? services[0]
					: null;

			if (!targetService && !opts.service) {
				console.log(chalk.bold("Select a service to deploy:\n"));
				services.forEach((s, i) => {
					const status =
						s.status === "running"
							? chalk.green("●")
							: s.status === "failed"
								? chalk.red("●")
								: chalk.dim("●");
					console.log(
						`  ${chalk.cyan(String(i + 1))}. ${status} ${s.name} ${chalk.dim(`(${s.type})`)}`,
					);
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
				targetService = services[idx];
			}

			if (!targetService) {
				console.log(chalk.red(`Service "${opts.service}" not found.`));
				process.exit(1);
			}

			const spinner = ora(`Deploying ${targetService.name}...`).start();
			try {
				const result = await client.deployment.deploy.mutate({
					serviceId: targetService.id,
				});

				if (opts.detach) {
					spinner.succeed(`Deployment triggered: ${chalk.dim(result.deploymentId)}`);
					return;
				}

				spinner.text = `Building ${targetService.name}...`;

				// Poll deployment status
				let lastStatus = "";
				for (let i = 0; i < 120; i++) {
					await new Promise((r) => setTimeout(r, 5000));
					const dep = await client.deployment.getById.query({ id: result.deploymentId });

					if (dep.status !== lastStatus) {
						lastStatus = dep.status;
						if (dep.status === "building") spinner.text = `Building ${targetService.name}...`;
						else if (dep.status === "deploying")
							spinner.text = `Deploying ${targetService.name}...`;
						else if (dep.status === "running") {
							spinner.succeed(
								`${targetService.name} deployed successfully ${chalk.dim(`(v${dep.version})`)}`,
							);
							return;
						} else if (dep.status === "failed") {
							spinner.fail(`Deployment failed: ${dep.errorMessage ?? "unknown error"}`);
							process.exit(1);
						} else if (dep.status === "cancelled") {
							spinner.warn("Deployment cancelled");
							return;
						}
					}
				}

				spinner.warn("Deployment timed out (10 min). Check dashboard for status.");
			} catch (e) {
				spinner.fail("Deployment failed");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	const deploy = program.command("deploy").description("Deployment management");

	deploy
		.command("list")
		.alias("ls")
		.option("-s, --service <name>", "Filter by service")
		.description("List recent deployments")
		.action(async (opts) => {
			const client = getClient();
			const projectId = getProjectId(program);
			const spinner = ora("Fetching deployments...").start();
			try {
				const services = await client.service.list.query({ projectId });
				let targetServices = services;

				if (opts.service) {
					const match = services.find((s) => s.name === opts.service || s.slug === opts.service);
					if (!match) {
						spinner.fail(`Service "${opts.service}" not found`);
						process.exit(1);
					}
					targetServices = [match];
				}

				const allDeps = [];
				for (const svc of targetServices) {
					const deps = await client.deployment.list.query({ serviceId: svc.id, limit: 5 });
					allDeps.push(...deps.map((d) => ({ ...d, serviceName: svc.name })));
				}

				allDeps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
				spinner.stop();

				if (allDeps.length === 0) {
					console.log(chalk.dim("No deployments found."));
					return;
				}

				output(
					allDeps.slice(0, 20).map((d) => ({
						service: d.serviceName,
						version: `v${d.version}`,
						status: d.status,
						trigger: d.trigger,
						commit: d.commitHash?.slice(0, 7) ?? "—",
						time: new Date(d.createdAt).toLocaleString(),
					})),
					[
						{ key: "service", header: "Service" },
						{ key: "version", header: "Version" },
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
						{ key: "trigger", header: "Trigger" },
						{ key: "commit", header: "Commit" },
						{ key: "time", header: "Time" },
					],
					program.opts().json,
				);
			} catch (e) {
				spinner.fail("Failed to fetch deployments");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	deploy
		.command("info")
		.argument("<id>", "Deployment ID")
		.description("Show deployment details")
		.action(async (id: string) => {
			const client = getClient();
			const spinner = ora("Fetching deployment...").start();
			try {
				const dep = await client.deployment.getById.query({ id });
				spinner.stop();

				if (program.opts().json) {
					console.log(JSON.stringify(dep, null, 2));
					return;
				}

				console.log(`\n  ${chalk.bold(`v${dep.version}`)} ${chalk.dim(dep.id)}`);
				console.log(
					`  ${chalk.dim("Status:")}   ${dep.status === "running" ? chalk.green(dep.status) : dep.status === "failed" ? chalk.red(dep.status) : dep.status}`,
				);
				console.log(`  ${chalk.dim("Trigger:")}  ${dep.trigger}`);
				if (dep.commitHash) console.log(`  ${chalk.dim("Commit:")}   ${dep.commitHash}`);
				if (dep.commitMessage) console.log(`  ${chalk.dim("Message:")}  ${dep.commitMessage}`);
				if (dep.buildDuration) console.log(`  ${chalk.dim("Build:")}    ${dep.buildDuration}s`);
				if (dep.deployDuration) console.log(`  ${chalk.dim("Deploy:")}   ${dep.deployDuration}s`);
				if (dep.errorMessage)
					console.log(`  ${chalk.dim("Error:")}    ${chalk.red(dep.errorMessage)}`);
				console.log(`  ${chalk.dim("Created:")}  ${new Date(dep.createdAt).toLocaleString()}`);

				if (dep.buildLogs) {
					console.log(`\n${chalk.dim("─── Build Logs ───")}\n`);
					console.log(dep.buildLogs);
				}
				console.log();
			} catch (e) {
				spinner.fail("Failed to fetch deployment");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	deploy
		.command("rollback")
		.argument("<id>", "Deployment ID to rollback to")
		.option("-s, --service <name>", "Service name")
		.description("Rollback to a previous deployment")
		.action(async (id: string, opts) => {
			const client = getClient();
			const projectId = getProjectId(program);

			if (!program.opts().yes) {
				const readline = await import("node:readline/promises");
				const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
				const confirm = await rl.question("Rollback to this deployment? (y/N) ");
				rl.close();
				if (confirm.toLowerCase() !== "y") {
					console.log(chalk.yellow("Cancelled."));
					return;
				}
			}

			const spinner = ora("Triggering rollback...").start();
			try {
				const dep = await client.deployment.getById.query({ id });
				await client.deployment.rollback.mutate({
					serviceId: dep.serviceId,
					targetDeploymentId: id,
				});
				spinner.succeed("Rollback triggered");
			} catch (e) {
				spinner.fail("Rollback failed");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	deploy
		.command("cancel")
		.argument("<id>", "Deployment ID to cancel")
		.description("Cancel an in-progress deployment")
		.action(async (id: string) => {
			const client = getClient();
			const spinner = ora("Cancelling deployment...").start();
			try {
				await client.deployment.cancel.mutate({ id });
				spinner.succeed("Deployment cancelled");
			} catch (e) {
				spinner.fail("Failed to cancel deployment");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});
}
