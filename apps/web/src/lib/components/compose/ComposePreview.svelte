<script lang="ts">
import { AlertTriangle, Container, Database, HardDrive, Network } from "@lucide/svelte";
import { Badge } from "$lib/components/ui/badge/index.js";

type Service = {
	name: string;
	image?: string;
	build?: unknown;
	ports?: Array<string | number>;
	volumes?: string[];
	environment?: Record<string, string> | string[];
	depends_on?: string[] | Record<string, unknown>;
};

type Props = {
	services: Service[];
	warnings?: string[];
};

let { services, warnings = [] }: Props = $props();

function envCount(env: Record<string, string> | string[] | undefined): number {
	if (!env) return 0;
	return Array.isArray(env) ? env.length : Object.keys(env).length;
}
</script>

<div class="space-y-3">
	{#if warnings.length > 0}
		<div class="space-y-1">
			{#each warnings as warning}
				<div class="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-500">
					<AlertTriangle class="size-3.5 shrink-0" />
					{warning}
				</div>
			{/each}
		</div>
	{/if}

	{#each services as svc}
		<div class="rounded-md border border-border p-3 space-y-2">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<Container class="size-4 text-muted-foreground" />
					<span class="font-medium text-sm">{svc.name}</span>
				</div>
				<div class="flex items-center gap-1.5">
					{#if svc.image}
						<Badge variant="outline" class="text-2xs">image</Badge>
					{/if}
					{#if svc.build}
						<Badge variant="outline" class="text-2xs">build</Badge>
					{/if}
				</div>
			</div>

			<div class="flex flex-wrap gap-3 text-xs text-muted-foreground">
				{#if svc.image}
					<span class="font-mono">{svc.image}</span>
				{/if}
				{#if svc.ports && svc.ports.length > 0}
					<span class="flex items-center gap-1">
						<Network class="size-3" />
						{svc.ports.join(", ")}
					</span>
				{/if}
				{#if svc.volumes && svc.volumes.length > 0}
					<span class="flex items-center gap-1">
						<HardDrive class="size-3" />
						{svc.volumes.length} volume{svc.volumes.length !== 1 ? "s" : ""}
					</span>
				{/if}
				{#if envCount(svc.environment) > 0}
					<span class="flex items-center gap-1">
						<Database class="size-3" />
						{envCount(svc.environment)} env var{envCount(svc.environment) !== 1 ? "s" : ""}
					</span>
				{/if}
			</div>

			{#if svc.depends_on}
				<div class="text-2xs text-muted-foreground">
					depends on: {Array.isArray(svc.depends_on) ? svc.depends_on.join(", ") : Object.keys(svc.depends_on).join(", ")}
				</div>
			{/if}
		</div>
	{/each}
</div>
