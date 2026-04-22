<script lang="ts">
import { Check, Copy, Eye, EyeOff, Key, Plus, Trash2, TriangleAlert } from "@lucide/svelte";
import { toastError, toastSuccess } from "$lib/components/notifications/toast.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import { trpc } from "$lib/trpc.js";

type ApiKey = {
	id: string;
	name: string | null;
	prefix: string | null;
	start: string | null;
	enabled: boolean | null;
	rateLimitEnabled: boolean | null;
	rateLimitMax: number | null;
	rateLimitTimeWindow: number | null;
	lastRequest: string | null;
	expiresAt: string | null;
	createdAt: string;
	permissions: string | null;
};

type Permissions = {
	project: string[];
	service: string[];
	deploy: string[];
	settings: string[];
};

let { data } = $props();

let keys = $state<ApiKey[]>((data.keys ?? []) as ApiKey[]);
let loading = $state(false);
let showCreate = $state(false);
let creating = $state(false);
let deleteConfirmId = $state<string | null>(null);

// Created key display
let createdKey = $state<string | null>(null);
let copied = $state(false);
let showKey = $state(false);

// Create form
let newName = $state("");
let newExpiry = $state<string>("never");
let newCustomDate = $state("");
let newRateLimit = $state(false);
let newRateLimitMax = $state(100);
let newRateLimitWindow = $state(60);

// Permissions
let permProject = $state<string[]>(["read", "write", "delete"]);
let permService = $state<string[]>(["read", "write", "delete"]);
let permDeploy = $state<string[]>(["read", "write"]);
let permSettings = $state<string[]>(["read", "write"]);

const permissionGroups = [
	{ key: "project", label: "Projects", options: ["read", "write", "delete"] },
	{ key: "service", label: "Services", options: ["read", "write", "delete"] },
	{ key: "deploy", label: "Deployments", options: ["read", "write"] },
	{ key: "settings", label: "Settings", options: ["read", "write"] },
] as const;

function getPermState(group: string): string[] {
	if (group === "project") return permProject;
	if (group === "service") return permService;
	if (group === "deploy") return permDeploy;
	return permSettings;
}

function togglePerm(group: string, perm: string) {
	const toggle = (arr: string[]) =>
		arr.includes(perm) ? arr.filter((p) => p !== perm) : [...arr, perm];
	if (group === "project") permProject = toggle(permProject);
	else if (group === "service") permService = toggle(permService);
	else if (group === "deploy") permDeploy = toggle(permDeploy);
	else permSettings = toggle(permSettings);
}

function parsePermissions(raw: string | null): Permissions | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as Permissions;
	} catch {
		return null;
	}
}

function permissionSummary(raw: string | null): string {
	const perms = parsePermissions(raw);
	if (!perms) return "Full access";
	const parts: string[] = [];
	for (const [resource, actions] of Object.entries(perms)) {
		if (actions.length > 0) parts.push(`${resource}: ${actions.join(", ")}`);
	}
	return parts.length > 0 ? parts.join(" | ") : "No permissions";
}

function isExpired(expiresAt: string | null): boolean {
	if (!expiresAt) return false;
	return new Date(expiresAt) < new Date();
}

function formatDate(date: string | null): string {
	if (!date) return "Never";
	return new Date(date).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

async function loadKeys() {
	loading = true;
	try {
		keys = (await trpc.apikey.list.query()) as ApiKey[];
	} catch (e) {
		toastError("Failed to load API keys");
	} finally {
		loading = false;
	}
}

async function handleCreate() {
	if (!newName.trim()) return;
	creating = true;
	try {
		const result = await trpc.apikey.create.mutate({
			name: newName.trim(),
			expiresIn: newExpiry as "never" | "30d" | "90d" | "1y" | "custom",
			customExpiry:
				newExpiry === "custom" && newCustomDate ? new Date(newCustomDate).toISOString() : undefined,
			permissions: {
				project: permProject as ("read" | "write" | "delete")[],
				service: permService as ("read" | "write" | "delete")[],
				deploy: permDeploy as ("read" | "write")[],
				settings: permSettings as ("read" | "write")[],
			},
			rateLimitEnabled: newRateLimit,
			rateLimitMax: newRateLimit ? newRateLimitMax : undefined,
			rateLimitTimeWindow: newRateLimit ? newRateLimitWindow : undefined,
		});
		createdKey = result.key;
		showCreate = false;
		resetForm();
		await loadKeys();
	} catch (e) {
		toastError("Failed to create API key", e instanceof Error ? e.message : "");
	} finally {
		creating = false;
	}
}

async function handleToggle(id: string, enabled: boolean) {
	try {
		await trpc.apikey.toggle.mutate({ id, enabled });
		await loadKeys();
	} catch (e) {
		toastError("Failed to update API key");
	}
}

async function handleDelete(id: string) {
	try {
		await trpc.apikey.delete.mutate({ id });
		deleteConfirmId = null;
		toastSuccess("API key deleted");
		await loadKeys();
	} catch (e) {
		toastError("Failed to delete API key");
	}
}

function copyKey() {
	if (!createdKey) return;
	navigator.clipboard.writeText(createdKey);
	copied = true;
	setTimeout(() => (copied = false), 2000);
}

function resetForm() {
	newName = "";
	newExpiry = "never";
	newCustomDate = "";
	newRateLimit = false;
	newRateLimitMax = 100;
	newRateLimitWindow = 60;
	permProject = ["read", "write", "delete"];
	permService = ["read", "write", "delete"];
	permDeploy = ["read", "write"];
	permSettings = ["read", "write"];
}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-lg font-semibold">API Keys</h2>
			<p class="mt-1 text-sm text-muted-foreground">Manage API keys for programmatic access to ByteSail.</p>
		</div>
		<Button onclick={() => (showCreate = true)}>
			<Plus class="mr-2 size-4" />
			Create API Key
		</Button>
	</div>

	<!-- Created key banner -->
	{#if createdKey}
		<Card.Root class="border-amber-500/50 bg-amber-500/5">
			<Card.Content class="py-4">
				<div class="flex items-start gap-3">
					<TriangleAlert class="mt-0.5 size-5 shrink-0 text-amber-500" />
					<div class="flex-1 space-y-2">
						<p class="text-sm font-medium text-amber-200">Copy your API key now</p>
						<p class="text-xs text-muted-foreground">This key won't be shown again. Store it securely.</p>
						<div class="flex items-center gap-2">
							<div class="relative flex-1">
								<Input
									value={showKey ? createdKey : createdKey.slice(0, 12) + "•".repeat(40)}
									readonly
									class="pr-20 font-mono text-xs"
								/>
								<div class="absolute right-1 top-1/2 flex -translate-y-1/2 gap-1">
									<button
										type="button"
										class="rounded p-1 hover:bg-muted"
										onclick={() => (showKey = !showKey)}
									>
										{#if showKey}
											<EyeOff class="size-3.5 text-muted-foreground" />
										{:else}
											<Eye class="size-3.5 text-muted-foreground" />
										{/if}
									</button>
									<button type="button" class="rounded p-1 hover:bg-muted" onclick={copyKey}>
										{#if copied}
											<Check class="size-3.5 text-green-400" />
										{:else}
											<Copy class="size-3.5 text-muted-foreground" />
										{/if}
									</button>
								</div>
							</div>
							<Button variant="ghost" size="sm" onclick={() => (createdKey = null)}>Dismiss</Button>
						</div>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Create form -->
	{#if showCreate}
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-sm">New API Key</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<label for="key-name" class="text-sm font-medium">Name</label>
					<Input id="key-name" bind:value={newName} placeholder="Production API Key" />
				</div>

				<div class="space-y-2">
					<label for="key-expiry" class="text-sm font-medium">Expiration</label>
					<select
						id="key-expiry"
						bind:value={newExpiry}
						class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
					>
						<option value="never">Never</option>
						<option value="30d">30 days</option>
						<option value="90d">90 days</option>
						<option value="1y">1 year</option>
						<option value="custom">Custom date</option>
					</select>
					{#if newExpiry === "custom"}
						<Input type="date" bind:value={newCustomDate} />
					{/if}
				</div>

				<Separator />

				<div class="space-y-3">
					<label class="text-sm font-medium">Permissions</label>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						{#each permissionGroups as group}
							<div class="space-y-1.5 rounded-md border border-border p-3">
								<p class="text-xs font-medium">{group.label}</p>
								<div class="flex flex-wrap gap-1.5">
									{#each group.options as perm}
										<button
											type="button"
											onclick={() => togglePerm(group.key, perm)}
											class="rounded-full border px-2.5 py-0.5 text-2xs capitalize transition-colors {getPermState(group.key).includes(perm)
												? 'border-primary bg-primary/10 text-primary'
												: 'border-border text-muted-foreground hover:text-foreground'}"
										>
											{perm}
										</button>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>

				<Separator />

				<div class="space-y-3">
					<div class="flex items-center gap-2">
						<input
							type="checkbox"
							id="rate-limit"
							bind:checked={newRateLimit}
							class="rounded border-border"
						/>
						<label for="rate-limit" class="text-sm font-medium">Enable rate limiting</label>
					</div>
					{#if newRateLimit}
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div class="space-y-1.5">
								<label for="rl-max" class="text-xs font-medium">Max requests</label>
								<Input id="rl-max" type="number" bind:value={newRateLimitMax} min={1} max={10000} />
							</div>
							<div class="space-y-1.5">
								<label for="rl-window" class="text-xs font-medium">Per window (seconds)</label>
								<Input id="rl-window" type="number" bind:value={newRateLimitWindow} min={1} max={3600} />
							</div>
						</div>
					{/if}
				</div>

				<div class="flex gap-2 pt-2">
					<Button onclick={handleCreate} disabled={creating || !newName.trim()}>
						{creating ? "Creating..." : "Create Key"}
					</Button>
					<Button
						variant="ghost"
						onclick={() => {
							showCreate = false;
							resetForm();
						}}>Cancel</Button
					>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Keys list -->
	{#if loading}
		<div class="space-y-2">
			{#each Array(3) as _}
				<div class="h-16 animate-pulse rounded-lg border border-border bg-muted/30"></div>
			{/each}
		</div>
	{:else if keys.length === 0 && !showCreate}
		<Card.Root>
			<Card.Content class="flex flex-col items-center gap-3 py-12 text-center">
				<Key class="size-10 text-muted-foreground/50" />
				<p class="text-sm font-medium">No API keys</p>
				<p class="text-xs text-muted-foreground">Create an API key to access ByteSail programmatically.</p>
				<Button variant="outline" onclick={() => (showCreate = true)}>
					<Plus class="mr-2 size-4" />
					Create API Key
				</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="space-y-3">
			{#each keys as key}
				<div class="flex items-center justify-between rounded-lg border border-border p-4">
					<div class="flex items-center gap-3">
						<div
							class="flex size-9 items-center justify-center rounded-lg border border-border {key.enabled
								? ''
								: 'opacity-40'}"
						>
							<Key class="size-4 text-muted-foreground" />
						</div>
						<div>
							<div class="flex items-center gap-2">
								<p class="text-sm font-medium">{key.name ?? "Unnamed"}</p>
								<Badge variant="outline" class="font-mono text-2xs">{key.start ?? key.prefix}...</Badge>
								{#if !key.enabled}
									<Badge variant="outline" class="text-2xs text-muted-foreground">Disabled</Badge>
								{/if}
								{#if isExpired(key.expiresAt)}
									<Badge variant="outline" class="text-2xs text-red-400">Expired</Badge>
								{/if}
							</div>
							<div class="mt-0.5 flex gap-3 text-2xs text-muted-foreground">
								<span>Created {formatDate(key.createdAt)}</span>
								<span>Last used {key.lastRequest ? formatDate(key.lastRequest) : "never"}</span>
								<span>Expires {formatDate(key.expiresAt)}</span>
								{#if key.rateLimitEnabled}
									<span>{key.rateLimitMax}/{key.rateLimitTimeWindow}s</span>
								{/if}
							</div>
							<p class="mt-0.5 text-2xs text-muted-foreground/70">{permissionSummary(key.permissions)}</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							onclick={() => handleToggle(key.id, !key.enabled)}
						>
							{key.enabled ? "Disable" : "Enable"}
						</Button>
						{#if deleteConfirmId === key.id}
							<Button variant="destructive" size="sm" onclick={() => handleDelete(key.id)}>
								Confirm
							</Button>
							<Button variant="ghost" size="sm" onclick={() => (deleteConfirmId = null)}>
								Cancel
							</Button>
						{:else}
							<Button variant="ghost" size="sm" onclick={() => (deleteConfirmId = key.id)}>
								<Trash2 class="size-3.5 text-destructive" />
							</Button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
