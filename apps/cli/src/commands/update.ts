import chalk from "chalk";
import type { Command } from "commander";
import ora from "ora";
import { getClient } from "../api/client.js";

export function registerUpdateCommands(program: Command) {
	const update = program.command("update").description("Manage ByteSail updates");

	update
		.command("check")
		.description("Check for available updates")
		.action(async () => {
			const client = getClient();
			const spinner = ora("Checking for updates...").start();

			try {
				const status = await client.settings.getUpdateStatus.query();
				spinner.stop();

				console.log(`  ${chalk.dim("Current version:")} ${chalk.bold(status.currentVersion)}`);

				if (status.updateAvailable && status.latestVersion) {
					console.log(
						`  ${chalk.dim("Available update:")} ${chalk.green.bold(status.latestVersion)}`,
					);
					if (status.releaseNotes) {
						console.log();
						console.log(chalk.dim("  Release notes:"));
						console.log(`  ${status.releaseNotes}`);
					}
					console.log();
					console.log(`  Run ${chalk.cyan("bytesail update apply")} to update.`);
				} else {
					console.log(chalk.green("\n  You are on the latest version."));
				}
			} catch (e) {
				spinner.fail("Failed to check for updates");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	update
		.command("apply")
		.description("Apply available update")
		.action(async () => {
			const client = getClient();

			// Check first
			const checkSpinner = ora("Checking for updates...").start();
			let status: {
				currentVersion: string;
				updateAvailable: boolean;
				latestVersion?: string;
				releaseNotes?: string;
			};

			try {
				status = await client.settings.getUpdateStatus.query();
				checkSpinner.stop();
			} catch (e) {
				checkSpinner.fail("Failed to check for updates");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
				return;
			}

			if (!status.updateAvailable || !status.latestVersion) {
				console.log(chalk.green("Already on the latest version."));
				return;
			}

			console.log(
				`  Update: ${chalk.dim(status.currentVersion)} → ${chalk.green.bold(status.latestVersion)}`,
			);
			console.log();

			// Confirm unless --yes
			if (!program.opts().yes) {
				const readline = await import("node:readline/promises");
				const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
				const answer = await rl.question("  Apply update? (y/N) ");
				rl.close();

				if (answer.toLowerCase() !== "y") {
					console.log(chalk.dim("  Update cancelled."));
					return;
				}
			}

			const spinner = ora("Applying update...").start();
			try {
				await client.settings.applyUpdate.mutate();
				spinner.succeed(`Updated to ${chalk.green.bold(status.latestVersion)} successfully.`);
			} catch (e) {
				spinner.fail("Update failed");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});

	update
		.command("status")
		.description("Show current version info")
		.action(async () => {
			const client = getClient();
			const spinner = ora("Fetching version info...").start();

			try {
				const status = await client.settings.getUpdateStatus.query();
				spinner.stop();

				console.log(chalk.bold("Version Info\n"));
				console.log(`  ${chalk.dim("Current version:")}  ${chalk.bold(status.currentVersion)}`);
				console.log(
					`  ${chalk.dim("Update available:")} ${status.updateAvailable ? chalk.green("Yes") : chalk.dim("No")}`,
				);
				if (status.latestVersion) {
					console.log(`  ${chalk.dim("Latest version:")}   ${chalk.bold(status.latestVersion)}`);
				}
			} catch (e) {
				spinner.fail("Failed to fetch version info");
				console.error(e instanceof Error ? e.message : e);
				process.exit(1);
			}
		});
}
