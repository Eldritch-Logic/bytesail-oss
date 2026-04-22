<script lang="ts">
type Props = {
	cpu?: number;
	memoryBytes?: number;
	cpuHistory?: number[];
	memoryHistory?: number[];
	class?: string;
};

let {
	cpu = 0,
	memoryBytes = 0,
	cpuHistory = [],
	memoryHistory = [],
	class: className,
}: Props = $props();

function formatCpu(v: number): string {
	return `${(v * 1000).toFixed(0)}m`;
}

function formatMem(bytes: number): string {
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
	return `${(bytes / 1024 / 1024).toFixed(0)}M`;
}

function sparklinePath(values: number[], w: number, h: number): string {
	if (values.length < 2) return "";
	const max = Math.max(...values, 0.001);
	const step = w / (values.length - 1);
	return values
		.map(
			(v, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(h - (v / max) * h).toFixed(1)}`,
		)
		.join(" ");
}
</script>

<div class="flex items-center gap-3 {className ?? ''}">
	<div class="flex items-center gap-1.5">
		{#if cpuHistory.length >= 2}
			<svg width="28" height="12">
				<path d={sparklinePath(cpuHistory, 28, 12)} fill="none" stroke="#14b8a6" stroke-width="1.5" />
			</svg>
		{/if}
		<span class="font-mono text-2xs text-muted-foreground">{formatCpu(cpu)}</span>
	</div>
	<div class="flex items-center gap-1.5">
		{#if memoryHistory.length >= 2}
			<svg width="28" height="12">
				<path d={sparklinePath(memoryHistory, 28, 12)} fill="none" stroke="#3b82f6" stroke-width="1.5" />
			</svg>
		{/if}
		<span class="font-mono text-2xs text-muted-foreground">{formatMem(memoryBytes)}</span>
	</div>
</div>
