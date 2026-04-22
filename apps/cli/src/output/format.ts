import chalk from "chalk";
import Table from "cli-table3";

type Column = {
	key: string;
	header: string;
	width?: number;
	color?: (value: string) => string;
};

export function formatTable(data: Record<string, unknown>[], columns: Column[]): string {
	const table = new Table({
		head: columns.map((c) => chalk.dim(c.header)),
		style: { head: [], border: ["dim"] },
		...(columns.some((c) => c.width) ? { colWidths: columns.map((c) => c.width) } : {}),
	});

	for (const row of data) {
		table.push(
			columns.map((col) => {
				const val = String(row[col.key] ?? "—");
				return col.color ? col.color(val) : val;
			}),
		);
	}

	return table.toString();
}

export function formatJson(data: unknown): string {
	return JSON.stringify(data, null, 2);
}

export function output(data: unknown, columns: Column[], jsonMode: boolean): void {
	if (jsonMode) {
		console.log(formatJson(data));
	} else if (Array.isArray(data)) {
		console.log(formatTable(data, columns));
	} else {
		console.log(formatJson(data));
	}
}

export { chalk };
