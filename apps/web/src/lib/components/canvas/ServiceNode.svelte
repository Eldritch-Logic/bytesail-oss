<script lang="ts">
import type { services } from "@bytesail/db/schema";
import { AlertCircle, Container, Database, GitBranch, Loader2, Server } from "@lucide/svelte";
import { Handle, Position } from "@xyflow/svelte";
import type { InferSelectModel } from "drizzle-orm";
import StatusDot from "$lib/components/shared/StatusDot.svelte";
import TimeAgo from "$lib/components/shared/TimeAgo.svelte";

type Service = InferSelectModel<typeof services>;

type Props = {
	data: { service: Service };
};

let { data: nodeData }: Props = $props();
const service = $derived(nodeData.service);

const typeLabels: Record<string, string> = {
	app: "Application",
	database: "Database",
	redis: "Redis",
	worker: "Worker",
	cron: "Cron Job",
};

const typeIcons: Record<string, typeof Server> = {
	app: Server,
	database: Database,
	redis: Database,
	worker: Container,
	cron: Container,
};

function borderClass() {
	if (service.status === "failed") return "border-status-failed/50";
	if (service.status === "building") return "border-status-building/50";
	if (service.status === "deploying") return "border-status-deploying/50";
	return "border-border";
}

function opacityClass() {
	return service.status === "stopped" ? "opacity-60" : "";
}

const TypeIcon = $derived(typeIcons[service.type] ?? Server);
</script>

<div
	class="w-[240px] select-none rounded-lg border bg-card shadow-md {borderClass()} {opacityClass()}"
>
	<Handle id="s-top" type="source" position={Position.Top} class="!invisible" />
	<Handle id="s-right" type="source" position={Position.Right} class="!invisible" />
	<Handle id="s-bottom" type="source" position={Position.Bottom} class="!invisible" />
	<Handle id="s-left" type="source" position={Position.Left} class="!invisible" />

	<Handle id="t-top" type="target" position={Position.Top} class="!invisible" />
	<Handle id="t-right" type="target" position={Position.Right} class="!invisible" />
	<Handle id="t-bottom" type="target" position={Position.Bottom} class="!invisible" />
	<Handle id="t-left" type="target" position={Position.Left} class="!invisible" />

	<div class="flex items-center gap-2.5 border-b border-border/50 px-3.5 py-2.5">
		<StatusDot status={service.status ?? "stopped"} />
		<span class="flex-1 truncate text-sm font-medium">{service.name}</span>
		{#if service.status === "building"}
			<Loader2 class="size-3.5 animate-spin text-status-building" />
		{:else if service.status === "deploying"}
			<Loader2 class="size-3.5 animate-spin text-status-deploying" />
		{:else if service.status === "failed"}
			<AlertCircle class="size-3.5 text-status-failed" />
		{/if}
	</div>

	<div class="space-y-2 px-3.5 py-2.5">
		<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
			<TypeIcon class="size-3" />
			<span>{typeLabels[service.type] ?? service.type}</span>
		</div>

		{#if service.repoOwner && service.repoName}
			<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
				<GitBranch class="size-3" />
				<span class="truncate">{service.repoOwner}/{service.repoName}</span>
			</div>
		{:else if service.dockerImage}
			<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
				<Container class="size-3" />
				<span class="truncate">{service.dockerImage}:{service.dockerTag ?? "latest"}</span>
			</div>
		{/if}

		<div class="flex items-center justify-between text-2xs text-muted-foreground/70">
			<span>Updated <TimeAgo date={service.updatedAt} /></span>
		</div>
	</div>

	{#if service.status === "building" || service.status === "deploying"}
		<div class="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-lg">
			<div
				class="h-full w-1/3 rounded-full {service.status === 'building' ? 'bg-status-building' : 'bg-status-deploying'}"
				style="animation: slide 1.5s infinite linear;"
			></div>
		</div>
	{/if}
</div>

<style>
	@keyframes slide {
		0% { transform: translateX(-100%); }
		100% { transform: translateX(400%); }
	}
</style>
