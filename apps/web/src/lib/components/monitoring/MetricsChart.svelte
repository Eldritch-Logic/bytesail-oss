<script lang="ts">
import type { Chart as ChartType } from "chart.js";
import { onMount } from "svelte";

type MetricPoint = { timestamp: number; value: number };

type Props = {
	title: string;
	unit: string;
	data: MetricPoint[];
	color?: string;
	loading?: boolean;
	formatValue?: (value: number) => string;
};

let { title, unit, data, color = "#14b8a6", loading = false, formatValue }: Props = $props();

let canvasEl: HTMLCanvasElement | undefined = $state();
let chart: ChartType | null = null;
let ChartCtor: typeof ChartType | null = null;

const defaultFormat = (v: number) => v.toFixed(2);
const fmt = $derived(formatValue ?? defaultFormat);

const currentValue = $derived(data.length > 0 ? fmt(data[data.length - 1].value) : "—");

function buildChart() {
	if (!canvasEl || !ChartCtor) return;
	if (chart) chart.destroy();

	const labels = data.map((p) => new Date(p.timestamp * 1000));
	const values = data.map((p) => (formatValue ? Number.parseFloat(fmt(p.value)) : p.value));

	chart = new ChartCtor(canvasEl, {
		type: "line",
		data: {
			labels,
			datasets: [
				{
					data: values,
					borderColor: color,
					backgroundColor: `${color}20`,
					fill: true,
					borderWidth: 1.5,
					pointRadius: 0,
					pointHitRadius: 10,
					tension: 0.3,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			interaction: {
				mode: "index",
				intersect: false,
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					backgroundColor: "hsl(240 10% 10%)",
					borderColor: "hsl(240 4% 20%)",
					borderWidth: 1,
					titleFont: { size: 11 },
					bodyFont: { size: 12, family: "JetBrains Mono, monospace" },
					padding: 8,
					displayColors: false,
					callbacks: {
						title: (items) => {
							if (!items[0]) return "";
							const d = items[0].label;
							return new Date(d).toLocaleTimeString("en-US", { hour12: false });
						},
						label: (item) => `${fmt(data[item.dataIndex]?.value ?? 0)} ${unit}`,
					},
				},
			},
			scales: {
				x: {
					type: "time",
					time: {
						tooltipFormat: "HH:mm:ss",
						displayFormats: { minute: "HH:mm", hour: "HH:mm" },
					},
					grid: { color: "hsl(240 4% 16%)" },
					ticks: {
						color: "hsl(240 5% 50%)",
						font: { size: 10 },
						maxTicksLimit: 8,
					},
					border: { display: false },
				},
				y: {
					beginAtZero: true,
					grid: { color: "hsl(240 4% 16%)" },
					ticks: {
						color: "hsl(240 5% 50%)",
						font: { size: 10 },
						maxTicksLimit: 5,
					},
					border: { display: false },
				},
			},
		},
	});
}

$effect(() => {
	if (data.length > 0 && canvasEl) {
		buildChart();
	}
});

onMount(async () => {
	const [{ Chart, registerables }, _adapter] = await Promise.all([
		import("chart.js"),
		import("chartjs-adapter-date-fns"),
	]);
	Chart.register(...registerables);
	ChartCtor = Chart;
	if (data.length > 0) buildChart();
	return () => chart?.destroy();
});
</script>

<div class="rounded-lg border border-border bg-card p-4">
	<div class="mb-3 flex items-center justify-between">
		<h3 class="text-sm font-medium text-muted-foreground">{title}</h3>
		<span class="font-mono text-sm font-semibold">
			{#if loading}
				<span class="text-muted-foreground">...</span>
			{:else}
				{currentValue} <span class="text-xs text-muted-foreground">{unit}</span>
			{/if}
		</span>
	</div>

	<div class="relative h-40">
		{#if loading && data.length === 0}
			<div class="flex h-full items-center justify-center">
				<div class="h-full w-full animate-pulse rounded bg-muted/30"></div>
			</div>
		{:else if data.length === 0}
			<div class="flex h-full items-center justify-center text-xs text-muted-foreground">
				No data available
			</div>
		{:else}
			<canvas bind:this={canvasEl}></canvas>
		{/if}
	</div>
</div>
