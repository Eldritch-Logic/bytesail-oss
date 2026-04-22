import chalk from "chalk";
import type { Command } from "commander";
import ora from "ora";
import WebSocket from "ws";
import { getClient } from "../api/client.js";
import { getConfig, getProjectState } from "../config/store.js";

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

const LEVEL_COLORS: Record<string, (s: string) => string> = {
	debug: chalk.dim,
	info: chalk.white,
	warn: chalk.yellow,
	error: chalk.red,
	fatal: chalk.bgRed.white,
};

function formatLogLine(entry: {
	timestamp: string;
	level: string;
	pod: string;
	line: string;
}): string {
	const time = chalk.dim(new Date(entry.timestamp).toLocaleTimeString("en-US", { hour12: false }));
	const level = (LEVEL_COLORS[entry.level] ?? chalk.white)(entry.level.toUpperCase().padEnd(5));
	const pod = chalk.dim(entry.pod.slice(-12).padEnd(12));
	const line = (LEVEL_COLORS[entry.level] ?? chalk.white)(entry.line);
	return `${time} ${level} ${pod} ${line}`;
}

export function registerLogCommands(program: Command) {
	program
		.command("logs")
		.description("Stream service logs")
		.option("-s, --service <name>", "Service name")
		.option("-t, --tail <n>", "Number of recent lines to show", "100")
		.option("--no-follow", "Don't stream, just show recent logs")
		.action(async (opts) => {
			const client = getClient();
			const config = getConfig();
			const projectId = getProjectId(program);

			const services = await client.service.list.query({ projectId });
			let svc = opts.service
				? services.find((s) => s.name === opts.service || s.slug === opts.service)
				: services.length === 1
					? services[0]
					: null;

			if (!svc && !opts.service) {
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
				svc = services[idx];
			}

			if (!svc) {
				console.log(chalk.red(`Service "${opts.service}" not found.`));
				process.exit(1);
			}

			// Fetch recent logs from Loki
			const spinner = ora(`Loading logs for ${svc.name}...`).start();
			try {
				const logs = await client.monitoring.getLogs.query({
					serviceId: svc.id,
					limit: parseInt(opts.tail, 10),
					direction: "backward",
				});
				spinner.stop();

				const reversed = logs.reverse();
				for (const entry of reversed) {
					console.log(
						formatLogLine(entry as { timestamp: string; level: string; pod: string; line: string }),
					);
				}

				if (reversed.length > 0) {
					console.log(chalk.dim(`\n─── ${reversed.length} lines ───\n`));
				}
			} catch {
				spinner.stop();
				// Loki might not be available
			}

			if (!opts.follow) return;

			// Stream live logs via WebSocket
			if (!config.instanceUrl) {
				console.log(chalk.dim("Live streaming not available (no instance URL)"));
				return;
			}

			const wsUrl = config.instanceUrl.replace(/^http/, "ws") + "/ws";
			const projects = await client.project.list.query();
			const project = projects.find((p) => p.id === projectId);
			if (!project) return;

			const channel = `service:logs:${svc.slug}:${project.slug}`;

			console.log(chalk.dim(`Streaming logs for ${svc.name}... (Ctrl+C to stop)\n`));

			const ws = new WebSocket(wsUrl);

			ws.on("open", () => {
				ws.send(JSON.stringify({ type: "subscribe", channel }));
			});

			ws.on("message", (data) => {
				try {
					const msg = JSON.parse(data.toString());
					if (msg.channel === channel && msg.data?.type === "log:batch") {
						for (const entry of msg.data.entries) {
							console.log(formatLogLine(entry));
						}
					}
				} catch {
					// ignore
				}
			});

			ws.on("error", () => {
				console.log(chalk.dim("\nWebSocket disconnected. Reconnecting..."));
			});

			ws.on("close", () => {
				console.log(chalk.dim("\nLog stream ended."));
			});

			// Handle Ctrl+C
			process.on("SIGINT", () => {
				ws.send(JSON.stringify({ type: "unsubscribe", channel }));
				ws.close();
				process.exit(0);
			});

			// Keep process alive
			await new Promise(() => {});
		});
}
