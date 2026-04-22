<script lang="ts">
import { ArrowDown, ArrowUp, Cpu, HardDrive, Network, RotateCcw } from "@lucide/svelte";

type MetricCard = {
	label: string;
	value: string;
	unit: string;
	icon: typeof Cpu;
	color: string;
	sparkline: number[];
	trend?: "up" | "down" | "flat";
};

type Props = {
	cpu?: number;
	memoryBytes?: number;
	networkRxBytesPerSec?: number;
	networkTxBytesPerSec?: number;
	restarts?: number;
	cpuHistory?: number[];
	memoryHistory?: number[];
	loading?: boolean;
};

let {
	cpu = 0,
	memoryBytes = 0,
	networkRxBytesPerSec = 0,
	networkTxBytesPerSec = 0,
	restarts = 0,
	cpuHistory = [],
	memoryHistory = [],
	loading = false,
}: Props = $props();

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes.toFixed(0)}`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}`;
	return `${(bytes / 1024 / 1024).toFixed(1)}`;
}

function bytesUnit(bytes: number): string {
	if (bytes < 1024) return "B";
	if (bytes < 1024 * 1024) return "KB";
	return "MB";
}

function trend(values: number[]): "up" | "down" | "flat" {
	if (values.length < 2) return "flat";
	const recent = values.slice(-3);
	const older = values.slice(-6, -3);
	if (older.length === 0) return "flat";
	const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
	const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
	const diff = (avgRecent - avgOlder) / (avgOlder || 1);
	if (diff > 0.05) return "up";
	if (diff < -0.05) return "down";
	return "flat";
}

const cards = $derived<MetricCard[]>([
	{
		label: "CPU",
		value: (cpu * 1000).toFixed(0),
		unit: "m",
		icon: Cpu,
		color: "#14b8a6",
		sparkline: cpuHistory,
		trend: trend(cpuHistory),
	},
	{
		label: "Memory",
		value: formatBytes(memoryBytes),
		unit: bytesUnit(memoryBytes),
		icon: HardDrive,
		color: "#3b82f6",
		sparkline: memoryHistory,
		trend: trend(memoryHistory),
	},
	{
		label: "Network",
		value: formatBytes(networkRxBytesPerSec + networkTxBytesPerSec),
		unit: `${bytesUnit(networkRxBytesPerSec + networkTxBytesPerSec)}/s`,
		icon: Network,
		color: "#22c55e",
		sparkline: [],
		trend: "flat",
	},
	{
		label: "Restarts",
		value: String(restarts),
		unit: "",
		icon: RotateCcw,
		color: restarts > 0 ? "#ef4444" : "#6b7280",
		sparkline: [],
		trend: restarts > 0 ? "up" : "flat",
	},
]);

function sparklinePath(values: number[], width: number, height: number): string {
	if (values.length < 2) return "";
	const max = Math.max(...values, 0.001);
	const step = width / (values.length - 1);
	return values
		.map((v, i) => {
			const x = i * step;
			const y = height - (v / max) * height;
			return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
		})
		.join(" ");
}
</script>

<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
	{#each cards as card}
		<div class="rounded-lg border border-border bg-card p-3">
			{#if loading}
				<div class="space-y-2">
					<div class="h-3 w-12 animate-pulse rounded bg-muted"></div>
					<div class="h-5 w-16 animate-pulse rounded bg-muted"></div>
				</div>
			{:else}
				<div class="flex items-center justify-between">
					<span class="text-2xs font-medium text-muted-foreground">{card.label}</span>
					<svelte:component this={card.icon} class="size-3 text-muted-foreground/50" />
				</div>
				<div class="mt-1 flex items-end justify-between">
					<div class="flex items-baseline gap-0.5">
						<span class="text-lg font-semibold leading-none">{card.value}</span>
						<span class="text-2xs text-muted-foreground">{card.unit}</span>
					</div>
					<div class="flex items-center gap-1">
						{#if card.sparkline.length >= 2}
							<svg width="40" height="16" class="opacity-60">
								<path
									d={sparklinePath(card.sparkline, 40, 16)}
									fill="none"
									stroke={card.color}
									stroke-width="1.5"
								/>
							</svg>
						{/if}
						{#if card.trend === "up"}
							<ArrowUp class="size-3" style="color: {card.color};" />
						{:else if card.trend === "down"}
							<ArrowDown class="size-3" style="color: {card.color};" />
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/each}
</div>
