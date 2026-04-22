<script lang="ts">
import { AlertTriangle, Check, Loader2, X } from "@lucide/svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { trpc } from "$lib/trpc.js";

type Props = {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	currentVersion: string;
	targetVersion: string;
	releaseNotes: string;
};

let {
	open = $bindable(false),
	onOpenChange,
	currentVersion,
	targetVersion,
	releaseNotes,
}: Props = $props();

type UpdateStep = "idle" | "updating" | "success" | "failed";

let step = $state<UpdateStep>("idle");
let errorMessage = $state("");

const steps = [
	{ label: "Pulling new image" },
	{ label: "Running migrations" },
	{ label: "Rolling update" },
	{ label: "Health check" },
];

let activeStep = $state(0);
let stepInterval: ReturnType<typeof setInterval> | undefined;

async function handleUpdate() {
	step = "updating";
	activeStep = 0;

	stepInterval = setInterval(() => {
		if (activeStep < steps.length - 1) {
			activeStep++;
		}
	}, 3000);

	try {
		await trpc.settings.applyUpdate.mutate({ targetVersion });

		// Poll until the new version is live or timeout after 180s
		const deadline = Date.now() + 180_000;
		let updated = false;

		while (Date.now() < deadline) {
			await new Promise((r) => setTimeout(r, 5000));
			try {
				const status = await trpc.settings.getUpdateStatus.query();
				if (status.currentVersion === targetVersion) {
					updated = true;
					break;
				}
			} catch {
				// API may be temporarily unavailable during pod restart — keep polling
			}
		}

		clearInterval(stepInterval);
		activeStep = steps.length - 1;

		if (updated) {
			step = "success";
			setTimeout(() => {
				window.location.reload();
			}, 2000);
		} else {
			step = "failed";
			errorMessage = "Update timed out. Check the cluster status and try again.";
		}
	} catch (e) {
		clearInterval(stepInterval);
		step = "failed";
		errorMessage = e instanceof Error ? e.message : "Update failed";
	}
}

function reset() {
	step = "idle";
	errorMessage = "";
	activeStep = 0;
	clearInterval(stepInterval);
}

function firstParagraph(text: string): string {
	return text.split("\n\n")[0]?.slice(0, 200) ?? "";
}
</script>

<Dialog.Root
	bind:open
	onOpenChange={(v) => {
		if (!v) reset();
		onOpenChange?.(v);
	}}
>
	<Dialog.Content class="sm:max-w-md" interactOutside={(e) => { if (step === "updating") e.preventDefault(); }}>
		{#if step === "idle"}
			<Dialog.Header>
				<Dialog.Title>Update ByteSail</Dialog.Title>
				<Dialog.Description>
					v{currentVersion} &rarr; v{targetVersion}
				</Dialog.Description>
			</Dialog.Header>

			<div class="space-y-4 py-4">
				{#if releaseNotes}
					<p class="text-sm text-muted-foreground">{firstParagraph(releaseNotes)}</p>
				{/if}

				<div class="flex items-start gap-2 rounded-md border border-border bg-muted/50 p-3">
					<AlertTriangle class="mt-0.5 size-4 shrink-0 text-yellow-500" />
					<p class="text-xs text-muted-foreground">
						The dashboard will briefly restart during the update. Active deployments will not be
						affected.
					</p>
				</div>
			</div>

			<Dialog.Footer>
				<Dialog.Close>
					<Button variant="outline">Cancel</Button>
				</Dialog.Close>
				<Button onclick={handleUpdate}>Update Now</Button>
			</Dialog.Footer>
		{:else if step === "updating"}
			<Dialog.Header>
				<Dialog.Title>Updating...</Dialog.Title>
				<Dialog.Description>
					v{currentVersion} &rarr; v{targetVersion}
				</Dialog.Description>
			</Dialog.Header>

			<div class="space-y-3 py-4">
				{#each steps as s, i}
					<div class="flex items-center gap-3 text-sm">
						{#if i < activeStep}
							<Check class="size-4 text-status-running" />
						{:else if i === activeStep}
							<Loader2 class="size-4 animate-spin text-primary" />
						{:else}
							<div class="size-4 rounded-full border border-border"></div>
						{/if}
						<span class:text-muted-foreground={i > activeStep}>{s.label}</span>
					</div>
				{/each}
			</div>
		{:else if step === "success"}
			<Dialog.Header>
				<Dialog.Title>Update Complete</Dialog.Title>
				<Dialog.Description>ByteSail has been updated to v{targetVersion}</Dialog.Description>
			</Dialog.Header>

			<div class="flex items-center gap-3 py-4">
				<Check class="size-5 text-status-running" />
				<p class="text-sm">Reloading...</p>
			</div>
		{:else}
			<Dialog.Header>
				<Dialog.Title>Update Failed</Dialog.Title>
				<Dialog.Description>
					The instance has been rolled back to v{currentVersion}
				</Dialog.Description>
			</Dialog.Header>

			<div class="space-y-4 py-4">
				<div class="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3">
					<X class="mt-0.5 size-4 shrink-0 text-destructive" />
					<p class="text-xs text-destructive">{errorMessage}</p>
				</div>
			</div>

			<Dialog.Footer>
				<Dialog.Close>
					<Button variant="outline">Close</Button>
				</Dialog.Close>
				<Button onclick={handleUpdate}>Retry</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
