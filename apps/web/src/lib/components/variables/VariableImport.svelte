<script lang="ts">
import { Upload } from "@lucide/svelte";
import { Button } from "$lib/components/ui/button/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { Label } from "$lib/components/ui/label/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import { Textarea } from "$lib/components/ui/textarea/index.js";

type Props = {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	onImport?: (
		vars: Array<{ key: string; value: string; isSecret: boolean }>,
		overwrite: boolean,
	) => void;
};

let { open = $bindable(false), onOpenChange, onImport }: Props = $props();

let envContent = $state("");
let overwrite = $state(false);

type ParsedVar = { key: string; value: string };

const parsed = $derived<ParsedVar[]>(parseEnv(envContent));

function parseEnv(content: string): ParsedVar[] {
	if (!content.trim()) return [];
	return content
		.split("\n")
		.filter((line) => line.trim() && !line.startsWith("#"))
		.map((line) => {
			const eqIndex = line.indexOf("=");
			if (eqIndex === -1) return null;
			const key = line.slice(0, eqIndex).trim();
			let value = line.slice(eqIndex + 1).trim();
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}
			return key ? { key, value } : null;
		})
		.filter((v): v is ParsedVar => v !== null);
}

function handleImport() {
	onImport?.(
		parsed.map((v) => ({ key: v.key, value: v.value, isSecret: false })),
		overwrite,
	);
	envContent = "";
	overwrite = false;
	open = false;
	onOpenChange?.(false);
}
</script>

<Dialog.Root bind:open {onOpenChange}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Import .env</Dialog.Title>
			<Dialog.Description>Paste your .env file content to import variables.</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			<Textarea
				bind:value={envContent}
				placeholder={"DATABASE_URL=postgres://...\nAPI_KEY=secret123\n# Comments are ignored"}
				rows={6}
				class="font-mono text-sm"
			/>

			{#if parsed.length > 0}
				<div class="rounded-md border border-border">
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head>Key</Table.Head>
								<Table.Head>Value</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each parsed as v}
								<Table.Row>
									<Table.Cell class="font-mono text-xs">{v.key}</Table.Cell>
									<Table.Cell class="truncate font-mono text-xs text-muted-foreground">{v.value.slice(0, 40)}{v.value.length > 40 ? "..." : ""}</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				</div>

				<div class="flex items-center gap-2">
					<Checkbox id="overwrite" bind:checked={overwrite} />
					<Label for="overwrite" class="text-sm font-normal">Overwrite existing variables</Label>
				</div>
			{/if}
		</div>

		<Dialog.Footer>
			<Dialog.Close>
				<Button variant="outline">Cancel</Button>
			</Dialog.Close>
			<Button onclick={handleImport} disabled={parsed.length === 0}>
				<Upload class="mr-2 size-4" />
				Import {parsed.length} variable{parsed.length !== 1 ? "s" : ""}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
