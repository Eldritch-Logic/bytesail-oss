<script lang="ts">
import { GitFork, Lock, Star } from "@lucide/svelte";
import SearchInput from "$lib/components/shared/SearchInput.svelte";
import { Skeleton } from "$lib/components/ui/skeleton/index.js";
import { cn } from "$lib/utils.js";

type Repo = {
	id: number;
	full_name: string;
	name: string;
	owner: { login: string };
	stargazers_count: number;
	language: string | null;
	private: boolean;
};

type Props = {
	repos: Repo[];
	loading?: boolean;
	selected?: string | null;
	onSelect?: (repo: Repo) => void;
};

let { repos, loading = false, selected = null, onSelect }: Props = $props();

let search = $state("");

const filtered = $derived(
	search ? repos.filter((r) => r.full_name.toLowerCase().includes(search.toLowerCase())) : repos,
);
</script>

<div class="space-y-3">
	<SearchInput bind:value={search} placeholder="Search repositories..." />

	<div class="max-h-64 overflow-y-auto rounded-md border border-border">
		{#if loading}
			<div class="space-y-0 divide-y divide-border">
				{#each Array(4) as _}
					<div class="flex items-center gap-3 p-3">
						<Skeleton class="h-4 w-40" />
						<Skeleton class="ml-auto h-3 w-12" />
					</div>
				{/each}
			</div>
		{:else if filtered.length === 0}
			<div class="flex items-center justify-center py-8 text-sm text-muted-foreground">
				{search ? "No repos match your search" : "No repositories found"}
			</div>
		{:else}
			<div class="divide-y divide-border">
				{#each filtered as repo}
					<button
						type="button"
						onclick={() => onSelect?.(repo)}
						class={cn(
							"flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted",
							selected === repo.full_name && "bg-primary/10 border-l-2 border-l-primary",
						)}
					>
						<div class="flex min-w-0 flex-1 items-center gap-2">
							{#if repo.private}
								<Lock class="size-3.5 shrink-0 text-muted-foreground" />
							{/if}
							<span class="truncate font-medium">{repo.full_name}</span>
						</div>
						<div class="flex items-center gap-3 text-xs text-muted-foreground">
							{#if repo.language}
								<span>{repo.language}</span>
							{/if}
							<span class="flex items-center gap-1">
								<Star class="size-3" />
								{repo.stargazers_count}
							</span>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
