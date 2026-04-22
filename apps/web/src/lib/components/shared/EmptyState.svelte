<script lang="ts">
import type { Component, Snippet } from "svelte";
import { cn } from "$lib/utils.js";

type Props = {
	icon?: Component<{ class?: string }>;
	title: string;
	description?: string;
	action?: Snippet;
	class?: string;
};

let { icon: Icon, title, description, action, class: className }: Props = $props();
</script>

<div class={cn("flex flex-col items-center justify-center gap-4 py-16 text-center", className)}>
	{#if Icon}
		<div class="rounded-full bg-muted p-4">
			<Icon class="size-8 text-muted-foreground" />
		</div>
	{/if}
	<div class="space-y-1.5">
		<h3 class="text-lg font-medium">{title}</h3>
		{#if description}
			<p class="max-w-sm text-sm text-muted-foreground">{description}</p>
		{/if}
	</div>
	{#if action}
		{@render action()}
	{/if}
</div>
