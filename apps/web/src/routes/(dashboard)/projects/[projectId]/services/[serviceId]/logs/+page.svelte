<script lang="ts">
import { ArrowLeft, Download, Pause, Play } from "@lucide/svelte";
import { onDestroy, onMount } from "svelte";
import LogSearch from "$lib/components/monitoring/LogSearch.svelte";
import LogViewer from "$lib/components/monitoring/LogViewer.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { trpc } from "$lib/trpc.js";

let { data } = $props();

type LogEntry = {
	timestamp: string;
	line: string;
	level: "debug" | "info" | "warn" | "error" | "fatal";
	pod: string;
	container?: string;
};

let logs = $state<LogEntry[]>([]);
let streaming = $state(true);
let searchQuery = $state("");
let levelFilter = $state<string>("all");
let loading = $state(true);
let currentMatchIdx = $state(0);

let ws: WebSocket | null = null;

const filteredLogs = $derived(
	logs.filter((entry) => {
		if (levelFilter !== "all" && entry.level !== levelFilter) return false;
		if (searchQuery && !entry.line.toLowerCase().includes(searchQuery.toLowerCase())) return false;
		return true;
	}),
);

const matchCount = $derived(
	searchQuery
		? filteredLogs.filter((l) => l.line.toLowerCase().includes(searchQuery.toLowerCase())).length
		: 0,
);

const levelCounts = $derived({
	debug: logs.filter((l) => l.level === "debug").length,
	info: logs.filter((l) => l.level === "info").length,
	warn: logs.filter((l) => l.level === "warn").length,
	error: logs.filter((l) => l.level === "error").length,
	fatal: logs.filter((l) => l.level === "fatal").length,
});

function nextMatch() {
	currentMatchIdx = matchCount > 0 ? (currentMatchIdx % matchCount) + 1 : 0;
}

function prevMatch() {
	currentMatchIdx = matchCount > 0 ? ((currentMatchIdx - 2 + matchCount) % matchCount) + 1 : 0;
}

function handleSearchChange(q: string) {
	searchQuery = q;
	currentMatchIdx = q ? 1 : 0;
}

async function loadInitialLogs() {
	loading = true;
	try {
		const result = await trpc.monitoring.getLogs.query({
			serviceId: data.service.id,
			limit: 500,
			direction: "backward",
		});
		logs = result.reverse();
	} catch (e) {
		console.error("Failed to load logs:", e);
	} finally {
		loading = false;
	}
}

function connectWebSocket() {
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

	ws.onopen = () => {
		ws?.send(JSON.stringify({ type: "subscribe", channel: data.wsChannel }));
	};

	ws.onmessage = (event) => {
		try {
			const msg = JSON.parse(event.data);
			if (msg.channel === data.wsChannel && msg.data?.type === "log:batch") {
				if (!streaming) return;
				const newEntries = msg.data.entries as LogEntry[];
				logs = [...logs, ...newEntries];

				if (logs.length > 5000) {
					logs = logs.slice(-5000);
				}

				if (autoScroll) {
					requestAnimationFrame(scrollToBottom);
				}
			}
		} catch {
			// ignore
		}
	};

	ws.onclose = () => {
		setTimeout(connectWebSocket, 3000);
	};
}

function toggleStreaming() {
	streaming = !streaming;
}

function downloadLogs() {
	const text = filteredLogs
		.map((l) => `${l.timestamp} [${l.level.toUpperCase()}] [${l.pod}] ${l.line}`)
		.join("\n");
	const blob = new Blob([text], { type: "text/plain" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${data.service.slug}-logs.txt`;
	a.click();
	URL.revokeObjectURL(url);
}

onMount(() => {
	loadInitialLogs();
	connectWebSocket();
});

onDestroy(() => {
	if (ws) {
		ws.send(JSON.stringify({ type: "unsubscribe", channel: data.wsChannel }));
		ws.close();
	}
});
</script>

<div class="flex h-[calc(100vh-8rem)] flex-col">
	<!-- Header -->
	<div class="flex items-center justify-between pb-3">
		<div class="flex items-center gap-3">
			<a
				href="/projects/{data.service.projectId}"
				class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			>
				<ArrowLeft class="size-5" />
			</a>
			<h1 class="text-lg font-semibold">{data.service.name}</h1>
			<Badge variant="outline" class="text-xs">Logs</Badge>
		</div>
		<div class="flex items-center gap-2">
			<Button variant="outline" size="sm" onclick={downloadLogs}>
				<Download class="mr-1.5 size-3.5" />
				Download
			</Button>
		</div>
	</div>

	<!-- Toolbar -->
	<div class="flex items-center gap-2 border-b border-border pb-3">
		<!-- Level filter -->
		<select
			bind:value={levelFilter}
			class="h-8 rounded-md border border-input bg-background px-2 text-xs"
		>
			<option value="all">All levels</option>
			<option value="debug">Debug ({levelCounts.debug})</option>
			<option value="info">Info ({levelCounts.info})</option>
			<option value="warn">Warn ({levelCounts.warn})</option>
			<option value="error">Error ({levelCounts.error})</option>
			<option value="fatal">Fatal ({levelCounts.fatal})</option>
		</select>

		<div class="flex-1 max-w-sm">
			<LogSearch
				bind:query={searchQuery}
				onQueryChange={handleSearchChange}
				totalMatches={matchCount}
				currentMatch={currentMatchIdx}
				onNext={nextMatch}
				onPrevious={prevMatch}
			/>
		</div>

		<div class="flex-1"></div>

		<!-- Stream controls -->
		<Button variant={streaming ? "outline" : "default"} size="sm" onclick={toggleStreaming}>
			{#if streaming}
				<Pause class="mr-1.5 size-3.5" /> Pause
			{:else}
				<Play class="mr-1.5 size-3.5" /> Resume
			{/if}
		</Button>

		<span class="text-xs text-muted-foreground">{filteredLogs.length} lines</span>
	</div>

	{#if loading}
		<div class="flex-1 space-y-1.5 p-4">
			{#each Array(12) as _}
				<div class="flex gap-3">
					<div class="h-4 w-36 animate-pulse rounded bg-muted/40"></div>
					<div class="h-4 flex-1 animate-pulse rounded bg-muted/30"></div>
				</div>
			{/each}
		</div>
	{:else}
		<LogViewer
			bind:this={logViewer}
			logs={filteredLogs}
			{streaming}
			{searchQuery}
			class="flex-1"
		/>
	{/if}
</div>
