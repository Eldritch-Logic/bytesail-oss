<script lang="ts">
import { ChevronDown, ChevronRight, FileText, RefreshCw } from "@lucide/svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import { trpc } from "$lib/trpc.js";

type AuditLog = {
	id: string;
	userId: string | null;
	organizationId: string | null;
	action: string;
	resourceType: string;
	resourceId: string | null;
	metadata: unknown;
	ipAddress: string | null;
	userAgent: string | null;
	createdAt: string;
};

let { data } = $props();

let logs = $state<AuditLog[]>((data.logs ?? []) as AuditLog[]);
let loading = $state(false);
let expandedId = $state<string | null>(null);
let actionFilter = $state("");
let currentPage = $state(0);
const pageSize = 50;
let hasMore = $state(logs.length === pageSize);

// Collect unique actions for filter dropdown
let uniqueActions = $derived([...new Set(logs.map((l) => l.action))].sort());

async function loadLogs(reset = false) {
	loading = true;
	if (reset) currentPage = 0;
	try {
		const rows = (await trpc.settings.getAuditLogs.query({
			limit: pageSize,
			offset: currentPage * pageSize,
			action: actionFilter || undefined,
		})) as AuditLog[];
		if (reset) {
			logs = rows;
		} else {
			logs = [...logs, ...rows];
		}
		hasMore = rows.length === pageSize;
	} catch (e) {
		console.error("Failed to load audit logs:", e);
	} finally {
		loading = false;
	}
}

function nextPage() {
	currentPage++;
	loadLogs();
}

function handleFilterChange(value: string) {
	actionFilter = value;
	loadLogs(true);
}

function toggleExpand(id: string) {
	expandedId = expandedId === id ? null : id;
}

function formatDate(date: string) {
	return new Date(date).toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

function humanizeAction(action: string) {
	return action
		.replace(/\./g, " → ")
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (s) => s.toUpperCase());
}

function actionColor(action: string): string {
	if (action.includes("delete") || action.includes("remove")) return "text-red-400";
	if (action.includes("create") || action.includes("deploy")) return "text-green-400";
	if (action.includes("update") || action.includes("set")) return "text-amber-400";
	return "text-muted-foreground";
}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-lg font-semibold">Audit Log</h2>
			<p class="mt-1 text-sm text-muted-foreground">Track all mutations performed across the system.</p>
		</div>
		<Button variant="outline" size="sm" onclick={() => loadLogs(true)} disabled={loading}>
			<RefreshCw class="mr-1.5 size-3.5 {loading ? 'animate-spin' : ''}" />
			Refresh
		</Button>
	</div>

	<div class="flex gap-3">
		<select
			class="flex h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
			value={actionFilter}
			onchange={(e) => handleFilterChange((e.target as HTMLSelectElement).value)}
		>
			<option value="">All actions</option>
			{#each uniqueActions as action}
				<option value={action}>{action}</option>
			{/each}
		</select>
	</div>

	{#if loading && logs.length === 0}
		<div class="space-y-2">
			{#each Array(5) as _}
				<div class="h-14 animate-pulse rounded-lg border border-border bg-muted/30"></div>
			{/each}
		</div>
	{:else if logs.length === 0}
		<Card.Root>
			<Card.Content class="flex flex-col items-center gap-3 py-12 text-center">
				<FileText class="size-10 text-muted-foreground/50" />
				<p class="text-sm font-medium">No audit logs</p>
				<p class="text-xs text-muted-foreground">
					{actionFilter ? "No logs match the selected filter." : "Audit entries will appear here as mutations are performed."}
				</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="overflow-x-auto rounded-lg border border-border">
			<table class="w-full min-w-[640px] text-sm">
				<thead>
					<tr class="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
						<th class="w-8 px-3 py-2.5"></th>
						<th class="px-3 py-2.5">Timestamp</th>
						<th class="px-3 py-2.5">Action</th>
						<th class="px-3 py-2.5">Resource</th>
						<th class="px-3 py-2.5">User</th>
						<th class="px-3 py-2.5">IP Address</th>
					</tr>
				</thead>
				<tbody>
					{#each logs as log}
						<tr
							class="border-b border-border last:border-0 transition-colors hover:bg-muted/20 cursor-pointer"
							onclick={() => toggleExpand(log.id)}
						>
							<td class="px-3 py-2.5">
								{#if expandedId === log.id}
									<ChevronDown class="size-3.5 text-muted-foreground" />
								{:else}
									<ChevronRight class="size-3.5 text-muted-foreground" />
								{/if}
							</td>
							<td class="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
								{formatDate(log.createdAt)}
							</td>
							<td class="px-3 py-2.5">
								<span class="text-xs font-medium {actionColor(log.action)}">
									{humanizeAction(log.action)}
								</span>
							</td>
							<td class="px-3 py-2.5">
								<div class="flex items-center gap-1.5">
									<Badge variant="outline" class="text-2xs capitalize">{log.resourceType}</Badge>
									{#if log.resourceId}
										<span class="text-2xs text-muted-foreground font-mono">{log.resourceId.slice(0, 8)}</span>
									{/if}
								</div>
							</td>
							<td class="px-3 py-2.5">
								{#if log.userId}
									<span class="text-xs font-mono text-muted-foreground">{log.userId.slice(0, 8)}...</span>
								{:else}
									<span class="text-xs text-muted-foreground/50">System</span>
								{/if}
							</td>
							<td class="px-3 py-2.5 text-xs text-muted-foreground font-mono">
								{log.ipAddress ?? "—"}
							</td>
						</tr>
						{#if expandedId === log.id}
							<tr class="bg-muted/10">
								<td colspan="6" class="px-6 py-4">
									<div class="space-y-3 text-xs">
										<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
											<div>
												<span class="font-medium text-muted-foreground">Full User ID</span>
												<p class="mt-0.5 font-mono">{log.userId ?? "N/A"}</p>
											</div>
											<div>
												<span class="font-medium text-muted-foreground">Organization ID</span>
												<p class="mt-0.5 font-mono">{log.organizationId ?? "N/A"}</p>
											</div>
											<div>
												<span class="font-medium text-muted-foreground">Resource ID</span>
												<p class="mt-0.5 font-mono">{log.resourceId ?? "N/A"}</p>
											</div>
											<div>
												<span class="font-medium text-muted-foreground">User Agent</span>
												<p class="mt-0.5 truncate">{log.userAgent ?? "N/A"}</p>
											</div>
										</div>
										{#if log.metadata}
											<div>
												<span class="font-medium text-muted-foreground">Metadata</span>
												<pre class="mt-1 max-h-48 overflow-auto rounded-md border border-border bg-background p-3 font-mono text-2xs">{JSON.stringify(log.metadata, null, 2)}</pre>
											</div>
										{/if}
									</div>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>

		<div class="flex items-center justify-between">
			<p class="text-xs text-muted-foreground">
				Showing {logs.length} entries
			</p>
			{#if hasMore}
				<Button variant="outline" size="sm" onclick={nextPage} disabled={loading}>
					{loading ? "Loading..." : "Load more"}
				</Button>
			{/if}
		</div>
	{/if}
</div>
