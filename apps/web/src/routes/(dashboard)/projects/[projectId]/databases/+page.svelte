<script lang="ts">
import { ArrowLeft, Database, HardDrive, Plus } from "@lucide/svelte";
import { invalidateAll } from "$app/navigation";
import { toastError, toastSuccess } from "$lib/components/notifications/toast.js";
import CopyButton from "$lib/components/shared/CopyButton.svelte";
import StatusDot from "$lib/components/shared/StatusDot.svelte";
import TimeAgo from "$lib/components/shared/TimeAgo.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { trpc } from "$lib/trpc.js";

let { data } = $props();

let showCreate = $state(false);
let creating = $state(false);
let newName = $state("");
let newType = $state("");
let newStorage = $state(1);
let revealedUrls = $state(new Set<string>());

const typeOptions = [
	{ id: "postgresql", name: "PostgreSQL", version: "16", icon: "🐘" },
	{ id: "mysql", name: "MySQL", version: "8", icon: "🐬" },
	{ id: "mariadb", name: "MariaDB", version: "11", icon: "🦭" },
	{ id: "mongodb", name: "MongoDB", version: "7", icon: "🍃" },
	{ id: "redis", name: "Redis", version: "7", icon: "🔴" },
	{ id: "keydb", name: "KeyDB", version: "latest", icon: "🔑" },
];

async function handleCreate() {
	if (!newName.trim() || !newType) return;
	creating = true;
	try {
		await trpc.database.create.mutate({
			projectId: data.project.id,
			type: newType as "postgresql",
			name: newName.trim(),
			storageSizeGb: newStorage,
		});
		toastSuccess("Database created", `${newName} is being provisioned`);
		showCreate = false;
		newName = "";
		newType = "";
		newStorage = 1;
		invalidateAll();
	} catch (e) {
		toastError("Failed to create database", e instanceof Error ? e.message : "");
	} finally {
		creating = false;
	}
}

async function handleDelete(id: string, name: string) {
	if (!confirm(`Delete database "${name}"? This cannot be undone.`)) return;
	try {
		await trpc.database.delete.mutate({ id });
		toastSuccess("Database deleted");
		invalidateAll();
	} catch (e) {
		toastError("Failed to delete", e instanceof Error ? e.message : "");
	}
}

function toggleReveal(id: string) {
	const next = new Set(revealedUrls);
	if (next.has(id)) next.delete(id);
	else next.add(id);
	revealedUrls = next;
}

function maskUrl(url: string | null): string {
	if (!url) return "";
	return url.replace(/:[^@]+@/, ":••••••••@");
}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<a
				href="/projects/{data.project.id}"
				class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			>
				<ArrowLeft class="size-5" />
			</a>
			<h1 class="text-2xl font-semibold">Databases</h1>
		</div>
		<Button onclick={() => (showCreate = true)}>
			<Plus class="mr-2 size-4" />
			Add Database
		</Button>
	</div>

	{#if showCreate}
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-sm">New Database</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				{#if !newType}
					<div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
						{#each typeOptions as opt}
							<button
								type="button"
								onclick={() => (newType = opt.id)}
								class="flex flex-col items-center gap-1.5 rounded-lg border border-border p-3 text-center transition-colors hover:bg-muted"
							>
								<span class="text-2xl">{opt.icon}</span>
								<span class="text-xs font-medium">{opt.name}</span>
								<span class="text-2xs text-muted-foreground">v{opt.version}</span>
							</button>
						{/each}
					</div>
				{:else}
					{@const selected = typeOptions.find((t) => t.id === newType)}
					<div class="flex items-center gap-2">
						<span class="text-lg">{selected?.icon}</span>
						<Badge variant="outline">{selected?.name} {selected?.version}</Badge>
						<button type="button" class="text-xs text-muted-foreground hover:text-foreground" onclick={() => (newType = "")}>Change</button>
					</div>
					<div class="space-y-2">
						<label for="db-name" class="text-sm font-medium">Name</label>
						<Input id="db-name" bind:value={newName} placeholder="my-database" />
					</div>
					<div class="space-y-2">
						<label for="db-storage" class="text-sm font-medium">Storage (GB)</label>
						<div class="flex gap-2">
							{#each [1, 5, 10, 20] as size}
								<button
									type="button"
									onclick={() => (newStorage = size)}
									class="rounded-md border px-3 py-1 text-sm {newStorage === size ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}"
								>
									{size} GB
								</button>
							{/each}
						</div>
					</div>
					<div class="flex gap-2">
						<Button onclick={handleCreate} disabled={creating || !newName.trim()}>
							{creating ? "Creating..." : "Create Database"}
						</Button>
						<Button variant="ghost" onclick={() => { showCreate = false; newType = ""; }}>Cancel</Button>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}

	{#if data.databases.length === 0 && !showCreate}
		<Card.Root>
			<Card.Content class="flex flex-col items-center gap-3 py-12 text-center">
				<Database class="size-10 text-muted-foreground/50" />
				<p class="text-sm font-medium">No databases</p>
				<p class="text-xs text-muted-foreground">Add a managed database with automatic backups and connection management.</p>
				<Button variant="outline" onclick={() => (showCreate = true)}>
					<Plus class="mr-2 size-4" />
					Add Database
				</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.databases as db}
				{@const typeInfo = typeOptions.find((t) => t.id === db.type)}
				<Card.Root>
					<Card.Header class="pb-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span class="text-lg">{typeInfo?.icon ?? "🗄️"}</span>
								<Card.Title class="text-base">{db.service?.name ?? db.dbName}</Card.Title>
							</div>
							<div class="flex items-center gap-1.5">
								<StatusDot status={db.service?.status ?? "stopped"} />
								<Badge variant="outline" class="text-2xs capitalize">{db.type}</Badge>
							</div>
						</div>
					</Card.Header>
					<Card.Content class="space-y-3 text-xs">
						<div class="flex items-center justify-between text-muted-foreground">
							<span>Version</span>
							<span>{db.version}</span>
						</div>
						{#if db.connectionUrl}
							<div class="space-y-1">
								<span class="text-muted-foreground">Connection URL</span>
								<div class="flex items-center gap-1">
									<code class="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-2xs">
										{revealedUrls.has(db.id) ? db.connectionUrl : maskUrl(db.connectionUrl)}
									</code>
									<button type="button" onclick={() => toggleReveal(db.id)} class="shrink-0 text-2xs text-muted-foreground hover:text-foreground">
										{revealedUrls.has(db.id) ? "Hide" : "Show"}
									</button>
									<CopyButton value={db.connectionUrl} />
								</div>
							</div>
						{/if}
						{#if db.backupEnabled}
							<div class="flex items-center gap-1.5 text-muted-foreground">
								<HardDrive class="size-3" />
								<span>Backups: {db.backupSchedule ?? "daily"}</span>
							</div>
						{/if}
						<div class="flex items-center justify-between pt-1">
							<TimeAgo date={db.createdAt} class="text-muted-foreground" />
							<Button variant="ghost" size="sm" class="text-destructive" onclick={() => handleDelete(db.id, db.service?.name ?? db.dbName ?? "")}>
								Delete
							</Button>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>
