<script lang="ts">
import { ExternalLink } from "@lucide/svelte";
import TimeAgo from "$lib/components/shared/TimeAgo.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";

type Props = {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	version: string;
	publishedAt: string;
	releaseNotes: string;
	htmlUrl: string;
	onUpdateNow?: () => void;
};

let {
	open = $bindable(false),
	onOpenChange,
	version,
	publishedAt,
	releaseNotes,
	htmlUrl,
	onUpdateNow,
}: Props = $props();
</script>

<Dialog.Root bind:open {onOpenChange}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Release Notes — v{version}</Dialog.Title>
			<Dialog.Description>
				Released <TimeAgo date={publishedAt} />
			</Dialog.Description>
		</Dialog.Header>

		<ScrollArea class="max-h-80">
			<div class="prose prose-sm prose-invert max-w-none whitespace-pre-wrap pr-4 text-sm text-foreground">
				{releaseNotes || "No release notes provided."}
			</div>
		</ScrollArea>

		<Dialog.Footer class="flex-row justify-between sm:justify-between">
			<a
				href={htmlUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
			>
				View on GitHub
				<ExternalLink class="size-3.5" />
			</a>
			<div class="flex gap-2">
				<Dialog.Close>
					<Button variant="outline">Close</Button>
				</Dialog.Close>
				<Button onclick={onUpdateNow}>Update Now</Button>
			</div>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
