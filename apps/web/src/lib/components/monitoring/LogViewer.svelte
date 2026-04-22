<script lang="ts">
import { ArrowDown } from "@lucide/svelte";
import { onMount } from "svelte";
import { Button } from "$lib/components/ui/button/index.js";

export type LogEntry = {
	timestamp: string;
	line: string;
	level: "debug" | "info" | "warn" | "error" | "fatal";
	pod: string;
	container?: string;
};

type Props = {
	logs: LogEntry[];
	streaming?: boolean;
	searchQuery?: string;
	class?: string;
};

let { logs, streaming = true, searchQuery = "", class: className }: Props = $props();

let containerEl: HTMLDivElement | undefined = $state();
let autoScroll = $state(true);
let scrollTop = $state(0);

const ROW_HEIGHT = 20;
const BUFFER_ROWS = 20;

const visibleHeight = $derived(containerEl?.clientHeight ?? 600);
const totalHeight = $derived(logs.length * ROW_HEIGHT);
const startIdx = $derived(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS));
const endIdx = $derived(
	Math.min(logs.length, Math.ceil((scrollTop + visibleHeight) / ROW_HEIGHT) + BUFFER_ROWS),
);
const visibleLogs = $derived(logs.slice(startIdx, endIdx));

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequences use ESC control char
const ANSI_REGEX = /\x1b\[([0-9;]*)m/g;

type Span = { text: string; classes: string };

function parseAnsi(line: string): Span[] {
	const spans: Span[] = [];
	let lastIdx = 0;
	let currentClasses = "";

	for (const match of line.matchAll(ANSI_REGEX)) {
		if (match.index > lastIdx) {
			spans.push({ text: line.slice(lastIdx, match.index), classes: currentClasses });
		}
		currentClasses = ansiCodeToClass(match[1]);
		lastIdx = match.index + match[0].length;
	}

	if (lastIdx < line.length) {
		spans.push({ text: line.slice(lastIdx), classes: currentClasses });
	}

	if (spans.length === 0) {
		spans.push({ text: line, classes: "" });
	}

	return spans;
}

function ansiCodeToClass(code: string): string {
	const codes = code.split(";").map(Number);
	const classes: string[] = [];
	for (const c of codes) {
		switch (c) {
			case 0:
				return "";
			case 1:
				classes.push("font-bold");
				break;
			case 2:
				classes.push("opacity-60");
				break;
			case 3:
				classes.push("italic");
				break;
			case 30:
				classes.push("text-gray-900 dark:text-gray-300");
				break;
			case 31:
				classes.push("text-red-400");
				break;
			case 32:
				classes.push("text-green-400");
				break;
			case 33:
				classes.push("text-yellow-400");
				break;
			case 34:
				classes.push("text-blue-400");
				break;
			case 35:
				classes.push("text-purple-400");
				break;
			case 36:
				classes.push("text-cyan-400");
				break;
			case 37:
				classes.push("text-white");
				break;
			case 90:
				classes.push("text-gray-500");
				break;
			case 91:
				classes.push("text-red-300");
				break;
			case 92:
				classes.push("text-green-300");
				break;
			case 93:
				classes.push("text-yellow-300");
				break;
			case 94:
				classes.push("text-blue-300");
				break;
			case 95:
				classes.push("text-purple-300");
				break;
			case 96:
				classes.push("text-cyan-300");
				break;
		}
	}
	return classes.join(" ");
}

function isJson(line: string): boolean {
	const trimmed = line.trim();
	return (
		(trimmed.startsWith("{") && trimmed.endsWith("}")) ||
		(trimmed.startsWith("[") && trimmed.endsWith("]"))
	);
}

let expandedLines = $state(new Set<number>());

function toggleExpand(index: number) {
	const next = new Set(expandedLines);
	if (next.has(index)) {
		next.delete(index);
	} else {
		next.add(index);
	}
	expandedLines = next;
}

function prettyJson(line: string): string {
	try {
		return JSON.stringify(JSON.parse(line), null, 2);
	} catch {
		return line;
	}
}

function levelColor(level: string) {
	switch (level) {
		case "debug":
			return "text-muted-foreground";
		case "warn":
			return "text-amber-400";
		case "error":
			return "text-red-400";
		case "fatal":
			return "text-red-500 font-bold";
		default:
			return "text-foreground";
	}
}

function formatTime(ts: string) {
	try {
		return new Date(ts).toLocaleTimeString("en-US", { hour12: false, fractionalSecondDigits: 3 });
	} catch {
		return ts;
	}
}

function highlightSearch(text: string, query: string): string {
	if (!query) return escapeHtml(text);
	const escaped = escapeHtml(text);
	const escapedQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`(${escapedQuery})`, "gi");
	return escaped.replace(
		regex,
		'<mark class="bg-yellow-500/30 text-yellow-200 rounded px-0.5">$1</mark>',
	);
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function handleScroll() {
	if (!containerEl) return;
	scrollTop = containerEl.scrollTop;
	const { scrollHeight, clientHeight } = containerEl;
	autoScroll = scrollHeight - scrollTop - clientHeight < 50;
}

export function scrollToBottom() {
	if (containerEl) {
		containerEl.scrollTop = containerEl.scrollHeight;
		autoScroll = true;
	}
}

$effect(() => {
	if (streaming && autoScroll && logs.length > 0) {
		requestAnimationFrame(() => {
			if (containerEl) {
				containerEl.scrollTop = containerEl.scrollHeight;
			}
		});
	}
});

onMount(() => {
	requestAnimationFrame(scrollToBottom);
});
</script>

<div class="relative flex-1 {className ?? ''}">
	<div
		bind:this={containerEl}
		onscroll={handleScroll}
		class="h-full overflow-y-auto bg-black/30 font-mono text-xs"
	>
		<div style="height: {totalHeight}px; position: relative;">
			<div style="position: absolute; top: {startIdx * ROW_HEIGHT}px; left: 0; right: 0;">
				{#each visibleLogs as entry, vi}
					{@const globalIdx = startIdx + vi}
					{@const jsonLine = isJson(entry.line)}
					<div
						class="flex hover:bg-muted/30 {entry.level === 'error' || entry.level === 'fatal' ? 'bg-red-500/5' : ''}"
						style="height: {ROW_HEIGHT}px;"
					>
						<span class="inline-block w-[4ch] shrink-0 px-2 text-right text-muted-foreground/40 select-none">
							{globalIdx + 1}
						</span>
						<span class="inline-block w-[12ch] shrink-0 px-1 text-muted-foreground/60">
							{formatTime(entry.timestamp)}
						</span>
						<span class="inline-block w-[5ch] shrink-0 px-1 {levelColor(entry.level)}">
							{entry.level.toUpperCase()}
						</span>
						<span class="inline-block w-[16ch] shrink-0 truncate px-1 text-muted-foreground/40">
							{entry.pod}
						</span>
						<span class="flex-1 truncate px-1 {levelColor(entry.level)}">
							{#if jsonLine}
								<button
									type="button"
									class="text-left hover:underline"
									onclick={() => toggleExpand(globalIdx)}
								>
									{#if searchQuery}
										{@html highlightSearch(entry.line, searchQuery)}
									{:else}
										{#each parseAnsi(entry.line) as span}
											<span class={span.classes}>{span.text}</span>
										{/each}
									{/if}
								</button>
							{:else if searchQuery}
								{@html highlightSearch(entry.line, searchQuery)}
							{:else}
								{#each parseAnsi(entry.line) as span}
									<span class={span.classes}>{span.text}</span>
								{/each}
							{/if}
						</span>
					</div>
					{#if expandedLines.has(globalIdx)}
						<pre class="ml-[37ch] whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs text-foreground">{prettyJson(entry.line)}</pre>
					{/if}
				{/each}
			</div>
		</div>
	</div>

	{#if !autoScroll && logs.length > 0}
		<div class="absolute bottom-4 right-4">
			<Button size="sm" onclick={scrollToBottom} class="shadow-lg">
				<ArrowDown class="mr-1.5 size-3.5" /> Latest
			</Button>
		</div>
	{/if}
</div>
