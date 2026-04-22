<script lang="ts">
import { ArrowUpCircle, X } from "@lucide/svelte";
import TimeAgo from "$lib/components/shared/TimeAgo.svelte";
import { Button } from "$lib/components/ui/button/index.js";

type UpdateInfo = {
	currentVersion: string;
	latestVersion: string;
	releaseNotes: string;
	publishedAt: string;
	htmlUrl: string;
};

type Props = {
	update: UpdateInfo;
	onViewNotes?: () => void;
	onUpdateNow?: () => void;
	onDismiss?: () => void;
};

let { update, onViewNotes, onUpdateNow, onDismiss }: Props = $props();
</script>

<div
	class="flex items-center justify-between gap-4 border-b border-primary/20 bg-primary/5 px-4 py-2.5 animate-in slide-in-from-top-2"
>
	<div class="flex items-center gap-3">
		<ArrowUpCircle class="size-5 text-primary" />
		<div class="text-sm">
			<span class="font-medium">ByteSail v{update.latestVersion}</span>
			<span class="text-muted-foreground"> is available</span>
			<span class="text-muted-foreground">(current: v{update.currentVersion})</span>
			{#if update.publishedAt}
				<span class="text-muted-foreground">
					&middot; Released <TimeAgo date={update.publishedAt} />
				</span>
			{/if}
		</div>
	</div>

	<div class="flex items-center gap-2">
		<Button variant="ghost" size="sm" onclick={onViewNotes}>
			View Release Notes
		</Button>
		<Button size="sm" onclick={onUpdateNow}>
			Update Now
		</Button>
		<button
			type="button"
			onclick={onDismiss}
			class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			aria-label="Dismiss"
		>
			<X class="size-4" />
		</button>
	</div>
</div>
