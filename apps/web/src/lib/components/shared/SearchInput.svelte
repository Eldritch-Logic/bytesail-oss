<script lang="ts">
import { Search } from "@lucide/svelte";
import { cn } from "$lib/utils.js";

type Props = {
	value?: string;
	placeholder?: string;
	shortcut?: string;
	class?: string;
	oninput?: (e: Event) => void;
};

let {
	value = $bindable(""),
	placeholder = "Search...",
	shortcut,
	class: className,
	oninput,
}: Props = $props();
</script>

<div class={cn("relative", className)}>
	<Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
	<input
		type="text"
		bind:value
		{placeholder}
		{oninput}
		class="h-9 w-full rounded-md border border-input bg-background pl-9 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
	/>
	{#if shortcut}
		<kbd
			class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground"
		>
			{shortcut}
		</kbd>
	{/if}
</div>
