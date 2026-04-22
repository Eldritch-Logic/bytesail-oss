<script lang="ts">
import { FolderKanban, Plus } from "@lucide/svelte";
import CreateProjectDialog from "$lib/components/projects/CreateProjectDialog.svelte";
import ProjectCard from "$lib/components/projects/ProjectCard.svelte";
import EmptyState from "$lib/components/shared/EmptyState.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import { Skeleton } from "$lib/components/ui/skeleton/index.js";

let { data } = $props();
let showCreateDialog = $state(false);
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold">Projects</h1>
		<Button onclick={() => (showCreateDialog = true)}>
			<Plus class="mr-2 size-4" />
			New Project
		</Button>
	</div>

	{#if data.loading}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array(3) as _}
				<div class="rounded-lg border border-border p-5 space-y-3">
					<Skeleton class="h-5 w-32" />
					<Skeleton class="h-4 w-24" />
					<div class="space-y-2">
						<Skeleton class="h-3 w-40" />
						<Skeleton class="h-3 w-36" />
					</div>
					<Skeleton class="h-3 w-20" />
				</div>
			{/each}
		</div>
	{:else if data.projects.length === 0}
		<EmptyState
			icon={FolderKanban}
			title="No projects yet"
			description="Create your first project to start deploying applications."
		>
			{#snippet action()}
				<Button onclick={() => (showCreateDialog = true)}>
					<Plus class="mr-2 size-4" />
					Create your first project
				</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.projects as project}
				<ProjectCard {project} />
			{/each}
		</div>
	{/if}
</div>

<CreateProjectDialog bind:open={showCreateDialog} />
