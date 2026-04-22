<script lang="ts">
import { Eye, EyeOff, Plus, Trash2 } from "@lucide/svelte";
import yaml from "js-yaml";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Input } from "$lib/components/ui/input/index.js";

type Props = {
	yamlContent?: string;
	envValue?: string;
	onYamlChange?: (yaml: string) => void;
	onEnvChange?: (env: string) => void;
};

let {
	yamlContent = $bindable(""),
	envValue = $bindable(""),
	onYamlChange,
	onEnvChange,
}: Props = $props();

type EnvRow = {
	key: string;
	value: string;
	services: string[];
	isRef: boolean;
	refVar?: string;
};

let extraKey = $state("");
let extraValue = $state("");
let revealedKeys = $state(new Set<string>());
let debouncedYaml = $state("");
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

$effect(() => {
	const current = yamlContent;
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		debouncedYaml = current;
	}, 500);
});

const rows = $derived(buildRows(debouncedYaml, envValue));

function buildRows(yamlStr: string, envStr: string): EnvRow[] {
	const envMap = parseEnvString(envStr);
	const rowMap = new Map<string, EnvRow>();

	try {
		const doc = yaml.load(yamlStr) as {
			services?: Record<string, { environment?: Record<string, unknown> | string[] }>;
		};
		if (!doc?.services) return [];

		for (const [svcName, svcConfig] of Object.entries(doc.services)) {
			const env = svcConfig.environment;
			if (!env) continue;

			const entries: Array<{ key: string; rawValue: string }> = [];
			if (Array.isArray(env)) {
				for (const entry of env) {
					const eqIdx = entry.indexOf("=");
					if (eqIdx > 0) {
						entries.push({ key: entry.slice(0, eqIdx), rawValue: entry.slice(eqIdx + 1) });
					}
				}
			} else {
				for (const [key, val] of Object.entries(env)) {
					entries.push({ key, rawValue: String(val ?? "") });
				}
			}

			for (const { key, rawValue } of entries) {
				const existing = rowMap.get(key);
				if (existing) {
					if (!existing.services.includes(svcName)) {
						existing.services.push(svcName);
					}
					continue;
				}

				const refMatch = rawValue.match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/);
				if (refMatch) {
					rowMap.set(key, {
						key,
						value: envMap.get(refMatch[1]) ?? "",
						services: [svcName],
						isRef: true,
						refVar: refMatch[1],
					});
				} else {
					rowMap.set(key, {
						key,
						value: rawValue,
						services: [svcName],
						isRef: false,
					});
				}
			}
		}
	} catch {
		// Invalid YAML
	}

	return Array.from(rowMap.values());
}

function parseEnvString(content: string): Map<string, string> {
	const map = new Map<string, string>();
	if (!content) return map;
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eqIdx = trimmed.indexOf("=");
		if (eqIdx === -1) continue;
		const key = trimmed.slice(0, eqIdx).trim();
		let value = trimmed.slice(eqIdx + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (key) map.set(key, value);
	}
	return map;
}

function updateValue(row: EnvRow, newValue: string) {
	if (row.isRef && row.refVar) {
		const envMap = parseEnvString(envValue);
		envMap.set(row.refVar, newValue);
		const lines = [...envMap.entries()].map(([k, v]) => `${k}=${v}`);
		envValue = lines.join("\n");
		onEnvChange?.(envValue);
	} else {
		updateYamlValue(row.services, row.key, newValue);
	}
}

function updateYamlValue(serviceNames: string[], key: string, newValue: string) {
	try {
		const doc = yaml.load(yamlContent) as Record<string, unknown>;
		const svcs = doc.services as Record<
			string,
			{ environment?: Record<string, unknown> | string[] }
		>;
		if (!svcs) return;

		for (const svcName of serviceNames) {
			const env = svcs[svcName]?.environment;
			if (!env) continue;

			if (Array.isArray(env)) {
				const idx = env.findIndex((e: string) => e.startsWith(`${key}=`));
				if (idx >= 0) {
					env[idx] = `${key}=${newValue}`;
				}
			} else {
				env[key] = newValue;
			}
		}

		const newYaml = yaml.dump(doc, { lineWidth: -1, quotingType: '"', forceQuotes: false });
		yamlContent = newYaml;
		onYamlChange?.(newYaml);
	} catch {
		// Parse error
	}
}

function addExtra() {
	if (!extraKey.trim()) return;
	const envMap = parseEnvString(envValue);
	envMap.set(extraKey.trim(), extraValue);
	const lines = [...envMap.entries()].map(([k, v]) => `${k}=${v}`);
	envValue = lines.join("\n");
	onEnvChange?.(envValue);
	extraKey = "";
	extraValue = "";
}

function toggleReveal(id: string) {
	const next = new Set(revealedKeys);
	if (next.has(id)) next.delete(id);
	else next.add(id);
	revealedKeys = next;
}
</script>

<div class="space-y-3">
	{#if rows.length === 0}
		<p class="text-sm text-muted-foreground">
			No variables detected. Add <code class="rounded bg-muted px-1 py-0.5 text-xs">environment:</code> to your services to see variables here.
		</p>
	{:else}
		<div class="rounded-md border border-border">
			<div class="grid grid-cols-[1fr_1fr_auto] gap-0 text-xs font-medium text-muted-foreground border-b border-border">
				<div class="px-3 py-2">Variable</div>
				<div class="px-3 py-2">Value</div>
				<div class="px-3 py-2 w-10"></div>
			</div>

			{#each rows as row}
				{@const rowId = row.key}
				<div class="grid grid-cols-[1fr_1fr_auto] gap-0 items-center border-b border-border last:border-0">
					<div class="px-3 py-2 flex items-center gap-2 flex-wrap">
						<code class="font-mono text-sm">{row.key}</code>
						{#each row.services as svc}
							<Badge variant="outline" class="text-2xs">{svc}</Badge>
						{/each}
						{#if row.isRef}
							<Badge variant="outline" class="text-2xs border-amber-500/50 text-amber-500">${"{" + (row.refVar ?? "") + "}"}</Badge>
						{/if}
					</div>
					<div class="px-2 py-1.5">
						<div class="flex items-center gap-1">
							<Input
								type={revealedKeys.has(rowId) ? "text" : "password"}
								value={row.value}
								oninput={(e) => updateValue(row, (e.target as HTMLInputElement).value)}
								placeholder={row.isRef ? "Set value..." : ""}
								class="h-8 font-mono text-sm {row.isRef && !row.value ? 'border-amber-500/50' : ''}"
							/>
							<button
								type="button"
								onclick={() => toggleReveal(rowId)}
								class="shrink-0 p-1.5 text-muted-foreground hover:text-foreground"
							>
								{#if revealedKeys.has(rowId)}
									<EyeOff class="size-3.5" />
								{:else}
									<Eye class="size-3.5" />
								{/if}
							</button>
						</div>
					</div>
					<div class="px-2 py-1.5 w-10"></div>
				</div>
			{/each}

			<div class="grid grid-cols-[1fr_1fr_auto] gap-0 items-center bg-muted/30">
				<div class="px-2 py-1.5">
					<Input
						bind:value={extraKey}
						placeholder="NEW_VARIABLE"
						class="h-8 font-mono text-sm uppercase"
					/>
				</div>
				<div class="px-2 py-1.5">
					<Input
						bind:value={extraValue}
						placeholder="value"
						class="h-8 font-mono text-sm"
					/>
				</div>
				<div class="px-2 py-1.5 w-10 flex justify-center">
					<Button variant="ghost" size="sm" onclick={addExtra} disabled={!extraKey.trim()}>
						<Plus class="size-4" />
					</Button>
				</div>
			</div>
		</div>
	{/if}
</div>
