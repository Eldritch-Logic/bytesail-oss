<script lang="ts">
import { Activity, Cpu, HardDrive, Server } from "@lucide/svelte";
import { onDestroy, onMount } from "svelte";
import StatusDot from "$lib/components/shared/StatusDot.svelte";
import TimeAgo from "$lib/components/shared/TimeAgo.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import { trpc } from "$lib/trpc.js";

let { data } = $props();

type SystemMetrics = {
	nodeCount: number;
	cpuUsagePercent: number;
	cpuCores: number;
	memoryUsedBytes: number;
	memoryTotalBytes: number;
	storageUsedBytes: number;
	storageTotalBytes: number;
};

let system = $state<SystemMetrics | null>(null);
let loading = $state(true);

function formatBytes(bytes: number): string {
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
	return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function pct(used: number, total: number): number {
	if (total === 0) return 0;
	return Math.min(100, (used / total) * 100);
}

function barColor(percent: number): string {
	if (percent > 90) return "bg-red-500";
	if (percent > 70) return "bg-amber-500";
	return "bg-primary";
}

async function loadSystem() {
	loading = true;
	try {
		system = await trpc.monitoring.getSystemOverview.query();
	} catch (e) {
		console.error("Failed to load system metrics:", e);
	} finally {
		loading = false;
	}
}

function projectName(projectId: string): string {
	return data.projects.find((p: { id: string; name: string }) => p.id === projectId)?.name ?? "—";
}

const interval = setInterval(loadSystem, 30_000);

onMount(loadSystem);
onDestroy(() => clearInterval(interval));
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold">System Monitoring</h1>
		<Badge variant="outline" class="text-xs">
			{loading ? "Refreshing..." : "Live"}
		</Badge>
	</div>

	<!-- Cluster overview -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card.Root>
			<Card.Content class="pt-4">
				<div class="flex items-center justify-between">
					<span class="text-xs text-muted-foreground">Nodes</span>
					<Server class="size-4 text-muted-foreground/50" />
				</div>
				<p class="mt-1 text-2xl font-semibold">{system?.nodeCount ?? "—"}</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="pt-4">
				<div class="flex items-center justify-between">
					<span class="text-xs text-muted-foreground">CPU</span>
					<Cpu class="size-4 text-muted-foreground/50" />
				</div>
				<p class="mt-1 text-2xl font-semibold">{system ? `${system.cpuUsagePercent.toFixed(1)}%` : "—"}</p>
				{#if system}
					<div class="mt-2 h-1.5 w-full rounded-full bg-muted">
						<div
							class="h-full rounded-full transition-all {barColor(system.cpuUsagePercent)}"
							style="width: {system.cpuUsagePercent.toFixed(1)}%"
						></div>
					</div>
					<p class="mt-1 text-2xs text-muted-foreground">{system.cpuCores} cores</p>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="pt-4">
				<div class="flex items-center justify-between">
					<span class="text-xs text-muted-foreground">Memory</span>
					<Activity class="size-4 text-muted-foreground/50" />
				</div>
				{#if system}
					{@const memPct = pct(system.memoryUsedBytes, system.memoryTotalBytes)}
					<p class="mt-1 text-2xl font-semibold">{memPct.toFixed(1)}%</p>
					<div class="mt-2 h-1.5 w-full rounded-full bg-muted">
						<div
							class="h-full rounded-full transition-all {barColor(memPct)}"
							style="width: {memPct.toFixed(1)}%"
						></div>
					</div>
					<p class="mt-1 text-2xs text-muted-foreground">{formatBytes(system.memoryUsedBytes)} / {formatBytes(system.memoryTotalBytes)}</p>
				{:else}
					<p class="mt-1 text-2xl font-semibold">—</p>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Content class="pt-4">
				<div class="flex items-center justify-between">
					<span class="text-xs text-muted-foreground">Storage</span>
					<HardDrive class="size-4 text-muted-foreground/50" />
				</div>
				{#if system}
					{@const storagePct = pct(system.storageUsedBytes, system.storageTotalBytes)}
					<p class="mt-1 text-2xl font-semibold">{storagePct.toFixed(1)}%</p>
					<div class="mt-2 h-1.5 w-full rounded-full bg-muted">
						<div
							class="h-full rounded-full transition-all {barColor(storagePct)}"
							style="width: {storagePct.toFixed(1)}%"
						></div>
					</div>
					<p class="mt-1 text-2xs text-muted-foreground">{formatBytes(system.storageUsedBytes)} / {formatBytes(system.storageTotalBytes)}</p>
				{:else}
					<p class="mt-1 text-2xl font-semibold">—</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Services table -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-sm">Services</Card.Title>
			<Card.Description>{data.services.length} services across {data.projects.length} projects</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if data.services.length === 0}
				<p class="text-sm text-muted-foreground">No services deployed yet.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-border text-left text-xs text-muted-foreground">
								<th class="pb-2 pr-4 font-medium">Service</th>
								<th class="pb-2 pr-4 font-medium">Project</th>
								<th class="pb-2 pr-4 font-medium">Status</th>
								<th class="pb-2 pr-4 font-medium">Type</th>
								<th class="pb-2 pr-4 font-medium">Replicas</th>
								<th class="pb-2 font-medium">Updated</th>
							</tr>
						</thead>
						<tbody>
							{#each data.services as service}
								<tr class="border-b border-border/50 hover:bg-muted/30">
									<td class="py-2.5 pr-4">
										<a href="/projects/{service.projectId}/services/{service.id}" class="font-medium hover:text-primary">
											{service.name}
										</a>
									</td>
									<td class="py-2.5 pr-4 text-muted-foreground">
										<a href="/projects/{service.projectId}" class="hover:text-foreground">
											{projectName(service.projectId)}
										</a>
									</td>
									<td class="py-2.5 pr-4">
										<div class="flex items-center gap-1.5">
											<StatusDot status={service.status ?? "stopped"} />
											<span class="capitalize text-xs">{service.status ?? "stopped"}</span>
										</div>
									</td>
									<td class="py-2.5 pr-4">
										<Badge variant="outline" class="text-2xs capitalize">{service.type}</Badge>
									</td>
									<td class="py-2.5 pr-4 text-muted-foreground">{service.replicas ?? 1}</td>
									<td class="py-2.5 text-muted-foreground">
										<TimeAgo date={service.updatedAt} />
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
