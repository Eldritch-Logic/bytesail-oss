<script lang="ts">
import { AlertTriangle } from "@lucide/svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";

type Props = {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	targetVersion: number;
	targetCommitHash?: string | null;
	currentVersion?: number;
	onConfirm?: () => void;
	loading?: boolean;
};

let {
	open = $bindable(false),
	onOpenChange,
	targetVersion,
	targetCommitHash,
	currentVersion,
	onConfirm,
	loading = false,
}: Props = $props();
</script>

<Dialog.Root bind:open {onOpenChange}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Rollback to v{targetVersion}</Dialog.Title>
			<Dialog.Description>
				This will redeploy version {targetVersion}
				{#if targetCommitHash}
					({targetCommitHash.slice(0, 7)})
				{/if}
				{#if currentVersion}
					, replacing the current v{currentVersion}
				{/if}.
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex items-start gap-2 rounded-md border border-border bg-muted/50 p-3">
			<AlertTriangle class="mt-0.5 size-4 shrink-0 text-yellow-500" />
			<p class="text-xs text-muted-foreground">
				Traffic will switch to the rolled-back version once the deployment is healthy.
				This does not affect your source code or git history.
			</p>
		</div>

		<Dialog.Footer>
			<Dialog.Close>
				<Button variant="outline">Cancel</Button>
			</Dialog.Close>
			<Button onclick={onConfirm} disabled={loading}>
				{loading ? "Rolling back..." : "Confirm Rollback"}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
