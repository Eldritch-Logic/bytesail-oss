<script lang="ts">
import { GitBranch } from "@lucide/svelte";
import * as Select from "$lib/components/ui/select/index.js";

type Branch = {
	name: string;
};

type Props = {
	branches: Branch[];
	value?: string;
	onValueChange?: (value: string) => void;
	loading?: boolean;
};

let { branches, value = $bindable("main"), onValueChange, loading = false }: Props = $props();
</script>

<Select.Root type="single" bind:value onValueChange={(v) => onValueChange?.(v)}>
	<Select.Trigger class="w-full">
		<GitBranch class="mr-2 size-4 text-muted-foreground" />
		{value || "Select branch"}
	</Select.Trigger>
	<Select.Content>
		{#if loading}
			<Select.Item value="" disabled>Loading branches...</Select.Item>
		{:else if branches.length === 0}
			<Select.Item value="" disabled>No branches found</Select.Item>
		{:else}
			{#each branches as branch}
				<Select.Item value={branch.name}>{branch.name}</Select.Item>
			{/each}
		{/if}
	</Select.Content>
</Select.Root>
