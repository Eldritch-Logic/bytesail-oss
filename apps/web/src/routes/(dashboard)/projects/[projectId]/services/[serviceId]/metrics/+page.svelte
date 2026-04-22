<script lang="ts">
import { ArrowLeft, RefreshCw } from "@lucide/svelte";
import { onDestroy, onMount } from "svelte";
import MetricsChart from "$lib/components/monitoring/MetricsChart.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { trpc } from "$lib/trpc.js";

let { data } = $props();

type MetricPoint = { timestamp: number; value: number };

const timeRanges = [
	{ label: "1h", seconds: 3600 },
	{ label: "6h", seconds: 21600 },
	{ label: "24h", seconds: 86400 },
	{ label: "7d", seconds: 604800 },
] as const;

const refreshOptions = [
	{ label: "Off", seconds: 0 },
	{ label: "15s", seconds: 15 },
	{ label: "30s", seconds: 30 },
	{ label: "1m", seconds: 60 },
] as const;

let selectedRange = $state(timeRanges[0]);
let selectedRefresh = $state(refreshOptions[0]);
let loading = $state(true);

let cpuData = $state<MetricPoint[]>([]);
let memoryData = $state<MetricPoint[]>([]);
let networkRxData = $state<MetricPoint[]>([]);
let networkTxData = $state<MetricPoint[]>([]);

let refreshInterval: ReturnType<typeof setInterval> | null = null;

function timeRange() {
	const now = Math.floor(Date.now() / 1000);
	const start = now - selectedRange.seconds;
	const step =
		selectedRange.seconds <= 3600 ? "15s" : selectedRange.seconds <= 86400 ? "60s" : "300s";
	return { start: String(start), end: String(now), step };
}

async function loadMetrics() {
	loading = true;
	const { start, end, step } = timeRange();
	const serviceId = data.service.id;

	try {
		const [cpu, mem, rx, tx] = await Promise.all([
			trpc.monitoring.getMetrics.query({ serviceId, metric: "cpu", start, end, step }),
			trpc.monitoring.getMetrics.query({ serviceId, metric: "memory", start, end, step }),
			trpc.monitoring.getMetrics.query({ serviceId, metric: "network_rx", start, end, step }),
			trpc.monitoring.getMetrics.query({ serviceId, metric: "network_tx", start, end, step }),
		]);
		cpuData = cpu;
		memoryData = mem;
		networkRxData = rx;
		networkTxData = tx;
	} catch (e) {
		console.error("Failed to load metrics:", e);
	} finally {
		loading = false;
	}
}

function setRefreshInterval() {
	if (refreshInterval) clearInterval(refreshInterval);
	if (selectedRefresh.seconds > 0) {
		refreshInterval = setInterval(loadMetrics, selectedRefresh.seconds * 1000);
	}
}

$effect(() => {
	loadMetrics();
	setRefreshInterval();
});

onMount(loadMetrics);
onDestroy(() => {
	if (refreshInterval) clearInterval(refreshInterval);
});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<a
				href="/projects/{data.service.projectId}"
				class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			>
				<ArrowLeft class="size-5" />
			</a>
			<h1 class="text-lg font-semibold">{data.service.name}</h1>
			<Badge variant="outline" class="text-xs">Metrics</Badge>
		</div>

		<div class="flex items-center gap-2">
			<!-- Time range -->
			<div class="flex rounded-md border border-input">
				{#each timeRanges as range}
					<button
						type="button"
						onclick={() => (selectedRange = range)}
						class="px-3 py-1 text-xs transition-colors first:rounded-l-md last:rounded-r-md {selectedRange === range
							? 'bg-primary text-primary-foreground'
							: 'hover:bg-muted'}"
					>
						{range.label}
					</button>
				{/each}
			</div>

			<!-- Refresh -->
			<select
				onchange={(e) => {
					const val = Number((e.target as HTMLSelectElement).value);
					selectedRefresh = refreshOptions.find((r) => r.seconds === val) ?? refreshOptions[0];
				}}
				class="h-8 rounded-md border border-input bg-background px-2 text-xs"
			>
				{#each refreshOptions as opt}
					<option value={opt.seconds} selected={opt === selectedRefresh}>
						{opt.label === "Off" ? "Auto-refresh: Off" : `Refresh: ${opt.label}`}
					</option>
				{/each}
			</select>

			<Button variant="outline" size="sm" onclick={loadMetrics} disabled={loading}>
				<RefreshCw class="mr-1.5 size-3.5 {loading ? 'animate-spin' : ''}" />
				Refresh
			</Button>
		</div>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		<MetricsChart
			title="CPU Usage"
			unit="cores"
			data={cpuData}
			color="#14b8a6"
			{loading}
		/>
		<MetricsChart
			title="Memory"
			unit="MB"
			data={memoryData}
			color="#3b82f6"
			{loading}
			formatValue={(v) => (v / 1024 / 1024).toFixed(1)}
		/>
		<MetricsChart
			title="Network In"
			unit="KB/s"
			data={networkRxData}
			color="#22c55e"
			{loading}
			formatValue={(v) => (v / 1024).toFixed(1)}
		/>
		<MetricsChart
			title="Network Out"
			unit="KB/s"
			data={networkTxData}
			color="#f59e0b"
			{loading}
			formatValue={(v) => (v / 1024).toFixed(1)}
		/>
	</div>
</div>
