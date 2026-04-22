<script lang="ts">
import { ArrowDown, ArrowUp, Regex, Search, X } from "@lucide/svelte";
import { Button } from "$lib/components/ui/button/index.js";
import { Input } from "$lib/components/ui/input/index.js";

type Props = {
	query?: string;
	onQueryChange: (query: string) => void;
	totalMatches?: number;
	currentMatch?: number;
	onNext?: () => void;
	onPrevious?: () => void;
};

let {
	query = $bindable(""),
	onQueryChange,
	totalMatches = 0,
	currentMatch = 0,
	onNext,
	onPrevious,
}: Props = $props();

let useRegex = $state(false);
let regexError = $state("");

function handleInput(value: string) {
	query = value;
	regexError = "";

	if (useRegex && value) {
		try {
			new RegExp(value, "gi");
		} catch (e) {
			regexError = e instanceof Error ? e.message : "Invalid regex";
			return;
		}
	}

	onQueryChange(value);
}

function toggleRegex() {
	useRegex = !useRegex;
	if (query) handleInput(query);
}

function clear() {
	query = "";
	regexError = "";
	onQueryChange("");
}
</script>

<div class="flex items-center gap-1.5">
	<div class="relative flex-1">
		<Search class="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
		<Input
			value={query}
			oninput={(e) => handleInput((e.target as HTMLInputElement).value)}
			placeholder={useRegex ? "Regex pattern..." : "Search logs..."}
			class="h-8 pl-8 pr-20 text-xs font-mono {regexError ? 'border-destructive' : ''}"
		/>
		<div class="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
			{#if query && totalMatches > 0}
				<span class="text-2xs text-muted-foreground">{currentMatch}/{totalMatches}</span>
			{:else if query && totalMatches === 0}
				<span class="text-2xs text-destructive">0</span>
			{/if}
			{#if query}
				<button
					type="button"
					onclick={clear}
					class="p-0.5 text-muted-foreground hover:text-foreground"
				>
					<X class="size-3" />
				</button>
			{/if}
		</div>
	</div>

	<Button
		variant={useRegex ? "default" : "outline"}
		size="icon"
		class="size-8"
		onclick={toggleRegex}
		title="Toggle regex"
	>
		<Regex class="size-3.5" />
	</Button>

	{#if totalMatches > 1}
		<Button variant="outline" size="icon" class="size-8" onclick={onPrevious} title="Previous match">
			<ArrowUp class="size-3.5" />
		</Button>
		<Button variant="outline" size="icon" class="size-8" onclick={onNext} title="Next match">
			<ArrowDown class="size-3.5" />
		</Button>
	{/if}
</div>

{#if regexError}
	<p class="mt-1 text-2xs text-destructive">{regexError}</p>
{/if}
