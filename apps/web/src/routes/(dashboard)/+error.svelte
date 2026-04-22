<script lang="ts">
import { ArrowLeft, CircleAlert, FolderKanban, RefreshCw, SearchX } from "@lucide/svelte";
import { page } from "$app/state";
import { Button } from "$lib/components/ui/button/index.js";

const is404 = $derived(page.status === 404);
</script>

<div class="flex flex-1 items-center justify-center p-6">
	<div class="flex max-w-md flex-col items-center gap-4 text-center">
		<div class="flex size-14 items-center justify-center rounded-full {is404 ? 'bg-muted' : 'bg-destructive/10'}">
			{#if is404}
				<SearchX class="size-7 text-muted-foreground" />
			{:else}
				<CircleAlert class="size-7 text-destructive" />
			{/if}
		</div>
		<div>
			<h2 class="text-xl font-semibold">
				{#if is404}
					Not Found
				{:else if page.status === 403}
					Access Denied
				{:else if page.status === 500}
					Server Error
				{:else}
					Error {page.status}
				{/if}
			</h2>
			<p class="mt-1.5 text-sm text-muted-foreground">
				{page.error?.message ?? "Something went wrong. Please try again."}
			</p>
			{#if is404}
				<p class="mt-1 text-xs text-muted-foreground/70">
					The project, service, or deployment you're looking for may have been deleted or never existed.
				</p>
			{/if}
		</div>
		<div class="flex gap-2 pt-2">
			{#if is404}
				<Button href="/projects">
					<FolderKanban class="mr-1.5 size-3.5" />
					All Projects
				</Button>
				<Button variant="outline" onclick={() => history.back()}>
					<ArrowLeft class="mr-1.5 size-3.5" />
					Go Back
				</Button>
			{:else}
				<Button onclick={() => location.reload()}>
					<RefreshCw class="mr-1.5 size-3.5" />
					Retry
				</Button>
				<Button variant="outline" onclick={() => history.back()}>
					<ArrowLeft class="mr-1.5 size-3.5" />
					Go Back
				</Button>
			{/if}
		</div>
	</div>
</div>
