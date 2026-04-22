import chalk from "chalk";
import type { Command } from "commander";

export function registerNodeCommands(program: Command) {
	const node = program.command("node").description("Manage cluster nodes");

	node
		.command("list")
		.alias("ls")
		.description("List cluster nodes")
		.action(async () => {
			console.log(chalk.yellow("Node management coming soon."));
		});

	node
		.command("add")
		.description("Add a node to the cluster")
		.action(async () => {
			console.log(chalk.yellow("Node management coming soon."));
		});

	node
		.command("remove")
		.argument("<name>", "Node name to remove")
		.description("Remove a node from the cluster")
		.action(async (_name: string) => {
			console.log(chalk.yellow("Node management coming soon."));
		});
}
