<script lang="ts">
import { Eye, EyeOff, Plus, Trash2 } from "@lucide/svelte";
import { Button } from "$lib/components/ui/button/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import { trpc } from "$lib/trpc.js";

type Variable = {
	id: string;
	key: string;
	value: string;
	isSecret: boolean | null;
};

type Props = {
	variables: Variable[];
	onSave?: (vars: Array<{ key: string; value: string; isSecret: boolean }>) => void;
	onDelete?: (id: string) => void;
	saving?: boolean;
};

let { variables: initialVars, onSave, onDelete, saving = false }: Props = $props();

let rows = $state<
	Array<{ id: string; key: string; value: string; isSecret: boolean; revealed: boolean }>
>(initialVars.map((v) => ({ ...v, isSecret: v.isSecret ?? false, revealed: false })));
let newKey = $state("");
let newValue = $state("");
let newIsSecret = $state(false);
let hasChanges = $state(false);

function addRow() {
	if (!newKey.trim()) return;
	rows = [
		...rows,
		{
			id: `new-${Date.now()}`,
			key: newKey,
			value: newValue,
			isSecret: newIsSecret,
			revealed: false,
		},
	];
	newKey = "";
	newValue = "";
	newIsSecret = false;
	hasChanges = true;
}

function removeRow(id: string) {
	if (id.startsWith("new-")) {
		rows = rows.filter((r) => r.id !== id);
	} else {
		onDelete?.(id);
	}
	hasChanges = true;
}

function handleSave() {
	onSave?.(rows.map((r) => ({ key: r.key, value: r.value, isSecret: r.isSecret })));
	hasChanges = false;
}

async function toggleReveal(index: number) {
	const row = rows[index];
	if (row.revealed) {
		rows[index].revealed = false;
		return;
	}
	if (row.value !== "••••••••") {
		rows[index].revealed = true;
		return;
	}
	try {
		const result = await trpc.variable.reveal.query({ id: row.id });
		rows[index].value = result.value;
		rows[index].revealed = true;
	} catch {
		console.error("Failed to reveal variable");
	}
}

function markChanged() {
	hasChanges = true;
}
</script>

<div class="space-y-4">
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head class="w-1/3">Key</Table.Head>
				<Table.Head>Value</Table.Head>
				<Table.Head class="w-16">Secret</Table.Head>
				<Table.Head class="w-20"></Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each rows as row, i}
				<Table.Row>
					<Table.Cell>
						<code class="font-mono text-sm">{row.key}</code>
					</Table.Cell>
					<Table.Cell>
						<div class="flex items-center gap-2">
							{#if row.isSecret && !row.revealed}
								<span class="font-mono text-sm text-muted-foreground">••••••••</span>
							{:else}
								<Input
									value={row.value}
									oninput={(e) => { row.value = (e.target as HTMLInputElement).value; markChanged(); }}
									class="h-8 font-mono text-sm"
								/>
							{/if}
							{#if row.isSecret}
								<button type="button" onclick={() => toggleReveal(i)} class="p-1 text-muted-foreground hover:text-foreground">
									{#if row.revealed}
										<EyeOff class="size-4" />
									{:else}
										<Eye class="size-4" />
									{/if}
								</button>
							{/if}
						</div>
					</Table.Cell>
					<Table.Cell>
						<Checkbox checked={row.isSecret} onCheckedChange={(v) => { row.isSecret = !!v; markChanged(); }} />
					</Table.Cell>
					<Table.Cell>
						<button type="button" onclick={() => removeRow(row.id)} class="p-1 text-muted-foreground hover:text-destructive">
							<Trash2 class="size-4" />
						</button>
					</Table.Cell>
				</Table.Row>
			{/each}
			<Table.Row>
				<Table.Cell>
					<Input bind:value={newKey} placeholder="KEY" class="h-8 font-mono text-sm" />
				</Table.Cell>
				<Table.Cell>
					<Input bind:value={newValue} placeholder="value" class="h-8 font-mono text-sm" />
				</Table.Cell>
				<Table.Cell>
					<Checkbox bind:checked={newIsSecret} />
				</Table.Cell>
				<Table.Cell>
					<Button variant="ghost" size="sm" onclick={addRow} disabled={!newKey.trim()}>
						<Plus class="size-4" />
					</Button>
				</Table.Cell>
			</Table.Row>
		</Table.Body>
	</Table.Root>

	<div class="flex items-center gap-3">
		<Button onclick={handleSave} disabled={saving || !hasChanges}>
			{saving ? "Saving..." : "Save Changes"}
		</Button>
		{#if hasChanges}
			<span class="text-xs text-muted-foreground">Unsaved changes</span>
		{/if}
	</div>
</div>
