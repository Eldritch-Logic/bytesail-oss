<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";

type Props = {
	logs: string;
	streaming?: boolean;
	class?: string;
};

let { logs, streaming = false, class: className }: Props = $props();

let container: HTMLPreElement | undefined = $state();
let autoScroll = $state(true);
let copied = $state(false);

function scrollToBottom() {
	if (container) {
		container.scrollTop = container.scrollHeight;
	}
}

function handleScroll() {
	if (!container) return;
	const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 40;
	autoScroll = atBottom;
}

$effect(() => {
	if (logs && autoScroll) {
		scrollToBottom();
	}
});

async function copyAll() {
	await navigator.clipboard.writeText(logs);
	copied = true;
	setTimeout(() => (copied = false), 2000);
}

const ESC = String.fromCharCode(27);

const ansiMap: [RegExp, string][] = [
	[new RegExp(`${ESC}\\[0m`, "g"), "</span>"],
	[new RegExp(`${ESC}\\[1m`, "g"), '<span class="font-bold">'],
	[new RegExp(`${ESC}\\[2m`, "g"), '<span class="opacity-60">'],
	[new RegExp(`${ESC}\\[31m`, "g"), '<span class="text-red-400">'],
	[new RegExp(`${ESC}\\[32m`, "g"), '<span class="text-green-400">'],
	[new RegExp(`${ESC}\\[33m`, "g"), '<span class="text-yellow-400">'],
	[new RegExp(`${ESC}\\[34m`, "g"), '<span class="text-blue-400">'],
	[new RegExp(`${ESC}\\[35m`, "g"), '<span class="text-purple-400">'],
	[new RegExp(`${ESC}\\[36m`, "g"), '<span class="text-cyan-400">'],
	[new RegExp(`${ESC}\\[37m`, "g"), '<span class="text-gray-300">'],
	[new RegExp(`${ESC}\\[90m`, "g"), '<span class="text-gray-500">'],
	[new RegExp(`${ESC}\\[91m`, "g"), '<span class="text-red-300">'],
	[new RegExp(`${ESC}\\[92m`, "g"), '<span class="text-green-300">'],
	[new RegExp(`${ESC}\\[93m`, "g"), '<span class="text-yellow-300">'],
	[new RegExp(`${ESC}\\[94m`, "g"), '<span class="text-blue-300">'],
	[new RegExp(`${ESC}\\[95m`, "g"), '<span class="text-purple-300">'],
	[new RegExp(`${ESC}\\[96m`, "g"), '<span class="text-cyan-300">'],
	[new RegExp(`${ESC}\\[\\d+(?:;\\d+)*m`, "g"), ""],
];

function ansiToHtml(text: string): string {
	let result = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	for (const [pattern, replacement] of ansiMap) {
		result = result.replace(pattern, replacement);
	}
	return result;
}
</script>

<div class="relative rounded-lg border border-border bg-black {className ?? ''}">
	<div class="absolute right-2 top-2 z-10 flex items-center gap-1">
		<Button variant="ghost" size="sm" class="h-7 text-xs text-gray-400 hover:text-white" onclick={copyAll}>
			{copied ? "Copied" : "Copy"}
		</Button>
	</div>

	<pre
		bind:this={container}
		onscroll={handleScroll}
		class="max-h-96 overflow-y-auto p-4 font-mono text-xs leading-5 text-gray-300"
	>{@html ansiToHtml(logs || "Waiting for logs...")}</pre>

	{#if !autoScroll && streaming}
		<button
			type="button"
			onclick={() => { autoScroll = true; scrollToBottom(); }}
			class="absolute bottom-3 right-3 flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/80"
		>
			Jump to bottom
		</button>
	{/if}
</div>
