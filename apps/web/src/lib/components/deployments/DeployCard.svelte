<script lang="ts">
import { ChevronDown, ChevronUp, Clock, Hammer, RotateCcw } from "@lucide/svelte";
import CopyButton from "$lib/components/shared/CopyButton.svelte";
import StatusDot from "$lib/components/shared/StatusDot.svelte";
import TimeAgo from "$lib/components/shared/TimeAgo.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { trpc } from "$lib/trpc.js";

type Deployment = {
	id: string;
	version: number;
	status: string;
	trigger: string;
	commitHash: string | null;
	commitMessage: string | null;
	commitAuthor: string | null;
	branch: string | null;
	buildDuration: number | null;
	deployDuration: number | null;
	errorMessage: string | null;
	createdAt: Date | string;
};

type Props = {
	deployment: Deployment;
	isCurrent?: boolean;
	onRollback?: (id: string) => void;
	onViewLogs?: (id: string) => void;
};

let { deployment, isCurrent = false, onRollback, onViewLogs }: Props = $props();

let showBuildLogs = $state(false);
let buildLogs = $state<string | null>(null);
let loadingLogs = $state(false);

async function toggleBuildLogs() {
	if (showBuildLogs) {
		showBuildLogs = false;
		return;
	}
	if (buildLogs === null) {
		loadingLogs = true;
		try {
			const result = await trpc.deployment.getBuildLogs.query({ id: deployment.id });
			buildLogs = result.logs;
		} catch {
			buildLogs = "Failed to load build logs";
		} finally {
			loadingLogs = false;
		}
	}
	showBuildLogs = true;
}

function displayStatus(status: string) {
	if (status === "running" && !isCurrent) return "completed";
	return status;
}

function statusToServiceStatus(status: string) {
	const display = displayStatus(status);
	if (display === "running") return "running" as const;
	if (display === "failed" || display === "cancelled") return "failed" as const;
	if (display === "building" || display === "pushing") return "building" as const;
	if (display === "deploying") return "deploying" as const;
	if (display === "queued") return "queued" as const;
	return "stopped" as const;
}

function formatDuration(seconds: number | null): string {
	if (!seconds) return "—";
	if (seconds < 60) return `${seconds}s`;
	return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
</script>

<div class="rounded-lg border p-4 space-y-3 {isCurrent ? 'border-status-running/50' : 'border-border'}">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<StatusDot status={statusToServiceStatus(deployment.status)} />
			<span class="font-medium">v{deployment.version}</span>
			<Badge variant="outline" class="text-xs capitalize">{displayStatus(deployment.status)}</Badge>
		</div>
		<TimeAgo date={deployment.createdAt} class="text-xs text-muted-foreground" />
	</div>

	{#if deployment.commitHash}
		<div class="flex items-center gap-2 text-sm">
			<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{deployment.commitHash.slice(0, 7)}</code>
			<CopyButton value={deployment.commitHash} />
			{#if deployment.commitMessage}
				<span class="truncate text-muted-foreground">{deployment.commitMessage}</span>
			{/if}
			{#if deployment.commitAuthor}
				<span class="shrink-0 text-xs text-muted-foreground">by {deployment.commitAuthor}</span>
			{/if}
		</div>
	{/if}

	<div class="flex items-center gap-4 text-xs text-muted-foreground">
		{#if deployment.buildDuration}
			<span class="flex items-center gap-1">
				<Clock class="size-3" />
				Build: {formatDuration(deployment.buildDuration)}
			</span>
		{/if}
		{#if deployment.deployDuration}
			<span class="flex items-center gap-1">
				<Clock class="size-3" />
				Deploy: {formatDuration(deployment.deployDuration)}
			</span>
		{/if}
		<Badge variant="outline" class="text-2xs capitalize">{deployment.trigger.replace("_", " ")}</Badge>
		{#if deployment.trigger === "pr_preview"}
			<Badge variant="outline" class="text-2xs border-purple-400 text-purple-400">Preview</Badge>
		{/if}
	</div>

	{#if deployment.status === "failed" && deployment.errorMessage}
		<Alert.Root variant="destructive">
			<Alert.Description class="text-xs">{deployment.errorMessage.slice(0, 200)}</Alert.Description>
		</Alert.Root>
	{/if}

	<div class="flex items-center gap-2">
		<Button variant="ghost" size="sm" onclick={() => onViewLogs?.(deployment.id)}>
			View Logs
		</Button>
		<Button variant="ghost" size="sm" onclick={toggleBuildLogs} disabled={loadingLogs}>
			<Hammer class="mr-1.5 size-3" />
			{loadingLogs ? "Loading..." : "Build Logs"}
			{#if showBuildLogs}
				<ChevronUp class="ml-1 size-3" />
			{:else}
				<ChevronDown class="ml-1 size-3" />
			{/if}
		</Button>
		{#if deployment.status === "running" || deployment.status === "failed"}
			<Button variant="ghost" size="sm" onclick={() => onRollback?.(deployment.id)}>
				<RotateCcw class="mr-1.5 size-3" />
				Rollback to this
			</Button>
		{/if}
	</div>

	{#if showBuildLogs && buildLogs !== null}
		<div class="mt-2 max-h-64 overflow-y-auto rounded-md bg-black/40 p-3 font-mono text-xs">
			{#if buildLogs}
				<pre class="whitespace-pre-wrap break-all text-muted-foreground">{buildLogs}</pre>
			{:else}
				<p class="text-muted-foreground">No build logs available for this deployment.</p>
			{/if}
		</div>
	{/if}
</div>
