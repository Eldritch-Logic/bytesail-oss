<script lang="ts">
import { ArrowLeft, Layers, Plus } from "@lucide/svelte";
import CreateComposeDialog from "$lib/components/compose/CreateComposeDialog.svelte";
import EmptyState from "$lib/components/shared/EmptyState.svelte";
import StatusDot from "$lib/components/shared/StatusDot.svelte";
import TimeAgo from "$lib/components/shared/TimeAgo.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";

let { data } = $props();
let showCreate = $state(false);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<a
				href="/projects/{data.projectId}"
				class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			>
				<ArrowLeft class="size-5" />
			</a>
			<h1 class="text-2xl font-semibold">Compose Stacks</h1>
		</div>
		<Button onclick={() => (showCreate = true)}>
			<Plus class="mr-2 size-4" />
			New Stack
		</Button>
	</div>

	{#if data.stacks.length === 0}
		<EmptyState
			icon={Layers}
			title="No compose stacks"
			description="Deploy multi-service applications from docker-compose.yml files."
		>
			{#snippet action()}
				<Button onclick={() => (showCreate = true)}>
					<Plus class="mr-2 size-4" />
					Create Stack
				</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.stacks as stack}
				<a href="/projects/{data.projectId}/compose/{stack.id}">
				<Card.Root class="transition-colors hover:border-primary/50">
					<Card.Header class="pb-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<StatusDot status={stack.status === "running" ? "running" : stack.status === "failed" ? "failed" : stack.status === "deploying" ? "deploying" : "stopped"} />
								<Card.Title class="text-base">{stack.name}</Card.Title>
							</div>
							<Badge variant="outline" class="text-xs capitalize">{stack.sourceType}</Badge>
						</div>
					</Card.Header>
					<Card.Content class="space-y-1 text-xs text-muted-foreground">
						<div class="flex justify-between">
							<span>Status</span>
							<span class="capitalize">{stack.status ?? "stopped"}</span>
						</div>
						{#if stack.lastDeployedAt}
							<div class="flex justify-between">
								<span>Last deployed</span>
								<TimeAgo date={stack.lastDeployedAt} />
							</div>
						{/if}
						<div class="pt-1">
							<span>Updated <TimeAgo date={stack.updatedAt} /></span>
						</div>
					</Card.Content>
				</Card.Root>
				</a>
			{/each}
		</div>
	{/if}
</div>

<CreateComposeDialog bind:open={showCreate} projectId={data.projectId} />
