<script lang="ts">
import { GitCommit } from "@lucide/svelte";
import CopyButton from "$lib/components/shared/CopyButton.svelte";
import TimeAgo from "$lib/components/shared/TimeAgo.svelte";

type Props = {
	sha: string;
	message: string;
	author?: string;
	date?: string | Date;
	class?: string;
};

let { sha, message, author, date, class: className }: Props = $props();
</script>

<div class="flex items-center gap-2 text-sm {className ?? ''}">
	<GitCommit class="size-3.5 shrink-0 text-muted-foreground" />
	<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{sha.slice(0, 7)}</code>
	<CopyButton value={sha} />
	<span class="min-w-0 truncate text-muted-foreground">{message}</span>
	{#if author}
		<span class="shrink-0 text-xs text-muted-foreground">{author}</span>
	{/if}
	{#if date}
		<TimeAgo {date} class="shrink-0 text-xs text-muted-foreground" />
	{/if}
</div>
