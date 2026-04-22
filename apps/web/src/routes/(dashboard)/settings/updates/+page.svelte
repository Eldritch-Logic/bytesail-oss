<script lang="ts">
import { Check, Loader2, RefreshCw, X } from "@lucide/svelte";
import UpdateConfirmDialog from "$lib/components/layout/UpdateConfirmDialog.svelte";
import TimeAgo from "$lib/components/shared/TimeAgo.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import { trpc } from "$lib/trpc.js";

type UpdateHistoryEntry = {
	from: string;
	to: string;
	at: string;
	status: string;
	error?: string;
	duration?: number;
};

let { data } = $props();

let checking = $state(false);
let showConfirm = $state(false);

async function checkNow() {
	checking = true;
	try {
		await trpc.settings.checkForUpdates.mutate();
		window.location.reload();
	} finally {
		checking = false;
	}
}

const history = $derived((data.updateHistory ?? []) as UpdateHistoryEntry[]);
const updateAvailable = $derived(
	data.updateAvailable as {
		currentVersion: string;
		latestVersion: string;
		releaseNotes: string;
		publishedAt: string;
		htmlUrl: string;
	} | null,
);
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-semibold">Updates</h1>

	<Card.Root>
		<Card.Header>
			<Card.Title>Current Version</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<span class="font-mono text-lg">v{data.currentVersion}</span>
					{#if !updateAvailable}
						<Badge variant="outline" class="text-status-running border-status-running">
							Up to date
						</Badge>
					{/if}
				</div>
				<Button variant="outline" size="sm" onclick={checkNow} disabled={checking}>
					{#if checking}
						<Loader2 class="mr-2 size-4 animate-spin" />
					{:else}
						<RefreshCw class="mr-2 size-4" />
					{/if}
					Check for Updates
				</Button>
			</div>
		</Card.Content>
	</Card.Root>

	{#if updateAvailable}
		<Card.Root class="border-primary/30">
			<Card.Header>
				<Card.Title>Available Update</Card.Title>
				<Card.Description>
					v{updateAvailable.latestVersion} &middot; Released <TimeAgo date={updateAvailable.publishedAt} />
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<p class="whitespace-pre-wrap text-sm text-muted-foreground">
					{updateAvailable.releaseNotes?.slice(0, 500) || "No release notes."}
				</p>
				<Button onclick={() => (showConfirm = true)}>Update Now</Button>
			</Card.Content>
		</Card.Root>

		<UpdateConfirmDialog
			bind:open={showConfirm}
			currentVersion={updateAvailable.currentVersion}
			targetVersion={updateAvailable.latestVersion}
			releaseNotes={updateAvailable.releaseNotes}
		/>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title>Update History</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if history.length === 0}
				<p class="text-sm text-muted-foreground">No updates have been applied yet.</p>
			{:else}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>From</Table.Head>
							<Table.Head>To</Table.Head>
							<Table.Head>Date</Table.Head>
							<Table.Head>Status</Table.Head>
							<Table.Head>Duration</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each history as entry}
							<Table.Row>
								<Table.Cell class="font-mono text-xs">v{entry.from}</Table.Cell>
								<Table.Cell class="font-mono text-xs">v{entry.to}</Table.Cell>
								<Table.Cell>
									<TimeAgo date={entry.at} />
								</Table.Cell>
								<Table.Cell>
									{#if entry.status === "success"}
										<Badge variant="outline" class="text-status-running border-status-running">
											<Check class="mr-1 size-3" /> Success
										</Badge>
									{:else if entry.status === "failed"}
										<Badge variant="destructive">
											<X class="mr-1 size-3" /> Failed
										</Badge>
									{:else}
										<Badge variant="outline">
											<Loader2 class="mr-1 size-3 animate-spin" /> In Progress
										</Badge>
									{/if}
								</Table.Cell>
								<Table.Cell class="text-xs text-muted-foreground">
									{entry.duration ? `${entry.duration}s` : "—"}
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
