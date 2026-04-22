<script lang="ts">
import { Check, Copy } from "@lucide/svelte";
import { cn } from "$lib/utils.js";

type Props = {
	value: string;
	class?: string;
};

let { value, class: className }: Props = $props();
let copied = $state(false);

async function copy() {
	await navigator.clipboard.writeText(value);
	copied = true;
	setTimeout(() => (copied = false), 2000);
}
</script>

<button
	type="button"
	onclick={copy}
	class={cn(
		"inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
		className,
	)}
	aria-label={copied ? "Copied" : "Copy to clipboard"}
>
	{#if copied}
		<Check class="size-3.5 text-status-running" />
	{:else}
		<Copy class="size-3.5" />
	{/if}
</button>
