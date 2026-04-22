<script lang="ts">
import { ArrowLeft, HardDrive, Plus, Trash2, TriangleAlert } from "@lucide/svelte";
import { toastError, toastSuccess } from "$lib/components/notifications/toast.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { trpc } from "$lib/trpc.js";

type Volume = {
	id: string;
	serviceId: string;
	name: string;
	mountPath: string;
	sizeGb: number | null;
	storageClass: string | null;
	k8sPvcName: string | null;
	createdAt: string;
};

let { data } = $props();

const serviceId = data.serviceId;
const projectId = data.projectId;

let volumes = $state<Volume[]>((data.volumes ?? []) as Volume[]);
let loading = $state(false);

// Add volume form
let showAdd = $state(false);
let newName = $state("");
let newMountPath = $state("");
let newSizeGb = $state(1);
let creating = $state(false);

// Delete confirm
let deleteConfirmId = $state<string | null>(null);

function formatDate(date: string): string {
	return new Date(date).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function usagePercent(): number {
	// Placeholder — real usage would come from K8s metrics
	return 0;
}

async function loadVolumes() {
	loading = true;
	try {
		volumes = (await trpc.volume.list.query({ serviceId })) as Volume[];
	} catch (e) {
		toastError("Failed to load volumes");
	} finally {
		loading = false;
	}
}

async function handleCreate() {
	if (!newName.trim() || !newMountPath.trim()) return;
	creating = true;
	try {
		await trpc.volume.create.mutate({
			serviceId,
			name: newName
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9-]/g, "-"),
			mountPath: newMountPath.trim(),
			sizeGb: newSizeGb,
		});
		toastSuccess("Volume created", "Redeploy the service to mount the volume.");
		showAdd = false;
		newName = "";
		newMountPath = "";
		newSizeGb = 1;
		await loadVolumes();
	} catch (e) {
		toastError("Failed to create volume", e instanceof Error ? e.message : "");
	} finally {
		creating = false;
	}
}

async function handleDelete(id: string) {
	try {
		await trpc.volume.delete.mutate({ id });
		deleteConfirmId = null;
		toastSuccess("Volume deleted");
		await loadVolumes();
	} catch (e) {
		toastError("Failed to delete volume", e instanceof Error ? e.message : "");
	}
}
</script>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<a
			href="/projects/{projectId}/services/{serviceId}"
			class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
		>
			<ArrowLeft class="size-4" />
		</a>
		<div class="flex-1">
			<h2 class="text-lg font-semibold">Storage</h2>
			<p class="text-sm text-muted-foreground">Manage persistent volumes attached to this service.</p>
		</div>
		<Button onclick={() => (showAdd = true)}>
			<Plus class="mr-2 size-4" />
			Add Volume
		</Button>
	</div>

	<!-- Add Volume Dialog -->
	{#if showAdd}
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-sm">New Volume</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<div class="space-y-2">
						<label for="vol-name" class="text-sm font-medium">Name</label>
						<Input id="vol-name" bind:value={newName} placeholder="data" />
						<p class="text-2xs text-muted-foreground">Lowercase, alphanumeric and dashes only.</p>
					</div>
					<div class="space-y-2">
						<label for="vol-mount" class="text-sm font-medium">Mount Path</label>
						<Input id="vol-mount" bind:value={newMountPath} placeholder="/var/lib/data" />
					</div>
					<div class="space-y-2">
						<label for="vol-size" class="text-sm font-medium">Size (GB)</label>
						<Input id="vol-size" type="number" bind:value={newSizeGb} min={1} max={100} />
					</div>
				</div>

				<div class="flex gap-2">
					<Button onclick={handleCreate} disabled={creating || !newName.trim() || !newMountPath.trim()}>
						{creating ? "Creating..." : "Create Volume"}
					</Button>
					<Button
						variant="ghost"
						onclick={() => {
							showAdd = false;
							newName = "";
							newMountPath = "";
							newSizeGb = 1;
						}}>Cancel</Button
					>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Volume List -->
	{#if loading}
		<div class="space-y-3">
			{#each Array(2) as _}
				<div class="h-24 animate-pulse rounded-lg border border-border bg-muted/30"></div>
			{/each}
		</div>
	{:else if volumes.length === 0 && !showAdd}
		<Card.Root>
			<Card.Content class="flex flex-col items-center gap-3 py-12 text-center">
				<HardDrive class="size-10 text-muted-foreground/50" />
				<p class="text-sm font-medium">No volumes attached</p>
				<p class="text-xs text-muted-foreground">Add a persistent volume to store data that survives container restarts.</p>
				<Button variant="outline" onclick={() => (showAdd = true)}>
					<Plus class="mr-2 size-4" />
					Add Volume
				</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="space-y-3">
			{#each volumes as vol}
				<div class="rounded-lg border border-border p-4">
					<div class="flex items-start justify-between">
						<div class="flex items-center gap-3">
							<div class="flex size-10 items-center justify-center rounded-lg border border-border bg-muted/30">
								<HardDrive class="size-5 text-muted-foreground" />
							</div>
							<div>
								<div class="flex items-center gap-2">
									<p class="text-sm font-medium">{vol.name}</p>
									<Badge variant="outline" class="text-2xs">{vol.storageClass ?? "longhorn"}</Badge>
								</div>
								<div class="mt-0.5 flex gap-3 text-2xs text-muted-foreground">
									<span class="font-mono">{vol.mountPath}</span>
									<span>{vol.sizeGb ?? 1} GB</span>
									<span>Created {formatDate(vol.createdAt)}</span>
								</div>
								{#if vol.k8sPvcName}
									<p class="mt-0.5 text-2xs text-muted-foreground/70 font-mono">PVC: {vol.k8sPvcName}</p>
								{/if}
							</div>
						</div>
						<div>
							{#if deleteConfirmId === vol.id}
								<div class="flex items-center gap-2">
									<div class="flex items-center gap-1.5 text-xs text-amber-400">
										<TriangleAlert class="size-3.5" />
										<span>Data will be lost</span>
									</div>
									<Button variant="destructive" size="sm" onclick={() => handleDelete(vol.id)}>
										Delete
									</Button>
									<Button variant="ghost" size="sm" onclick={() => (deleteConfirmId = null)}>
										Cancel
									</Button>
								</div>
							{:else}
								<Button variant="ghost" size="sm" onclick={() => (deleteConfirmId = vol.id)}>
									<Trash2 class="size-3.5 text-destructive" />
								</Button>
							{/if}
						</div>
					</div>

					<!-- Usage bar -->
					<div class="mt-3">
						<div class="flex items-center justify-between text-2xs text-muted-foreground">
							<span>Usage</span>
							<span>{usagePercent()}% of {vol.sizeGb ?? 1} GB</span>
						</div>
						<div class="mt-1 h-1.5 w-full rounded-full bg-muted">
							<div
								class="h-full rounded-full bg-primary transition-all"
								style="width: {usagePercent()}%"
							></div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
