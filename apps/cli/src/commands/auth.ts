import { createServer } from "node:http";
import chalk from "chalk";
import type { Command } from "commander";
import open from "open";
import ora from "ora";
import {
	clearCredentials,
	getConfig,
	getCredentials,
	saveConfig,
	saveCredentials,
} from "../config/store.js";

export function registerAuthCommands(program: Command) {
	const auth = program.command("login").description("Authenticate with a ByteSail instance");

	auth
		.option("-t, --token <key>", "API key for direct authentication")
		.option("-u, --url <url>", "ByteSail instance URL")
		.action(async (opts) => {
			let instanceUrl = opts.url ?? getConfig().instanceUrl;

			if (!instanceUrl) {
				const readline = await import("node:readline/promises");
				const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
				instanceUrl = await rl.question("ByteSail instance URL: ");
				rl.close();
				instanceUrl = instanceUrl.replace(/\/+$/, "");
			}

			saveConfig({ ...getConfig(), instanceUrl });

			if (opts.token) {
				// Direct token auth
				const spinner = ora("Verifying API key...").start();
				try {
					const res = await fetch(`${instanceUrl}/api/auth/session`, {
						headers: { "x-api-key": opts.token },
					});
					if (!res.ok) {
						spinner.fail("Invalid API key");
						process.exit(1);
					}
					const session = (await res.json()) as { user?: { name?: string; email?: string } };
					saveCredentials({ apiKey: opts.token });
					spinner.succeed(
						`Authenticated as ${chalk.bold(session.user?.name ?? session.user?.email ?? "user")} at ${chalk.cyan(instanceUrl)}`,
					);
				} catch (e) {
					spinner.fail(`Failed to connect to ${instanceUrl}`);
					process.exit(1);
				}
				return;
			}

			// Browser-based auth
			const spinner = ora("Waiting for browser authentication...").start();

			const apiKey = await new Promise<string>((resolve, reject) => {
				const server = createServer((req, res) => {
					if (req.method === "POST" && req.url === "/callback") {
						let body = "";
						req.on("data", (chunk) => (body += chunk));
						req.on("end", () => {
							try {
								const data = JSON.parse(body) as { apiKey?: string };
								if (data.apiKey) {
									res.writeHead(200, {
										"Content-Type": "application/json",
										"Access-Control-Allow-Origin": "*",
									});
									res.end(JSON.stringify({ ok: true }));
									server.close();
									resolve(data.apiKey);
								} else {
									res.writeHead(400);
									res.end("Missing apiKey");
								}
							} catch {
								res.writeHead(400);
								res.end("Invalid JSON");
							}
						});
						return;
					}

					if (req.method === "OPTIONS") {
						res.writeHead(200, {
							"Access-Control-Allow-Origin": "*",
							"Access-Control-Allow-Methods": "POST",
							"Access-Control-Allow-Headers": "Content-Type",
						});
						res.end();
						return;
					}

					res.writeHead(404);
					res.end();
				});

				server.listen(0, "127.0.0.1", () => {
					const addr = server.address();
					if (!addr || typeof addr === "string") {
						reject(new Error("Failed to start local server"));
						return;
					}
					const callbackUrl = `http://127.0.0.1:${addr.port}/callback`;
					const authUrl = `${instanceUrl}/auth/cli?callback=${encodeURIComponent(callbackUrl)}`;
					open(authUrl);
				});

				setTimeout(() => {
					server.close();
					reject(new Error("Authentication timed out (60s)"));
				}, 60_000);
			});

			saveCredentials({ apiKey });

			// Verify the key
			try {
				const res = await fetch(`${instanceUrl}/api/auth/session`, {
					headers: { "x-api-key": apiKey },
				});
				const session = (await res.json()) as { user?: { name?: string; email?: string } };
				spinner.succeed(
					`Authenticated as ${chalk.bold(session.user?.name ?? session.user?.email ?? "user")} at ${chalk.cyan(instanceUrl)}`,
				);
			} catch {
				spinner.succeed(`Authenticated at ${chalk.cyan(instanceUrl)}`);
			}
		});

	program
		.command("logout")
		.description("Clear saved credentials")
		.action(() => {
			clearCredentials();
			console.log(chalk.green("✓"), "Logged out successfully");
		});

	program
		.command("whoami")
		.description("Show current authenticated user")
		.action(async () => {
			const config = getConfig();
			const credentials = getCredentials();

			if (!config.instanceUrl || !credentials.apiKey) {
				console.log(chalk.red("Not authenticated."), "Run", chalk.cyan("bytesail login"), "first.");
				process.exit(1);
			}

			const spinner = ora("Fetching user info...").start();
			try {
				const res = await fetch(`${config.instanceUrl}/api/auth/session`, {
					headers: { "x-api-key": credentials.apiKey },
				});
				if (!res.ok) {
					spinner.fail("Session expired or invalid. Run `bytesail login` again.");
					process.exit(1);
				}
				const session = (await res.json()) as { user?: { name?: string; email?: string } };
				spinner.stop();
				console.log(`  ${chalk.dim("Name:")}     ${session.user?.name ?? "—"}`);
				console.log(`  ${chalk.dim("Email:")}    ${session.user?.email ?? "—"}`);
				console.log(`  ${chalk.dim("Instance:")} ${config.instanceUrl}`);
			} catch {
				spinner.fail(`Cannot reach ${config.instanceUrl}`);
				process.exit(1);
			}
		});
}
