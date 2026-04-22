<script lang="ts">
import { ArrowLeft, Play, Square, Trash2 } from "@lucide/svelte";
import { goto, invalidateAll } from "$app/navigation";
import ComposeEditor from "$lib/components/compose/ComposeEditor.svelte";
import ComposeEnvEditor from "$lib/components/compose/ComposeEnvEditor.svelte";
import ComposeTopology from "$lib/components/compose/ComposeTopology.svelte";
import StatusDot from "$lib/components/shared/StatusDot.svelte";
import TimeAgo from "$lib/components/shared/TimeAgo.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { trpc } from "$lib/trpc.js";

let { data } = $props();

let yamlValue = $state(data.stack.composeFile);
let envValue = $state(data.stack.envFile ?? "");
let hasChanges = $derived(
	yamlValue !== data.stack.composeFile || envValue !== (data.stack.envFile ?? ""),
);
let saving = $state(false);
let showDelete = $state(false);

function stackStatus() {
	const s = data.stack.status;
	if (s === "running") return "running" as const;
	if (s === "failed") return "failed" as const;
	if (s === "deploying") return "deploying" as const;
	return "stopped" as const;
}

async function handleSave() {
	saving = true;
	try {
		await trpc.compose.update.mutate({
			id: data.stack.id,
			composeFile: yamlValue,
			envFile: envValue || undefined,
		});
		invalidateAll();
	} catch (e) {
		console.error("Save failed:", e);
	} finally {
		saving = false;
	}
}

async function handleDeploy() {
	try {
		if (hasChanges) await handleSave();
		await trpc.compose.deploy.mutate({ id: data.stack.id });
		invalidateAll();
	} catch (e) {
		console.error("Deploy failed:", e);
	}
}

async function handleStop() {
	try {
		await trpc.compose.stop.mutate({ id: data.stack.id });
		invalidateAll();
	} catch (e) {
		console.error("Stop failed:", e);
	}
}

async function handleDelete() {
	try {
		await trpc.compose.delete.mutate({ id: data.stack.id });
		goto(`/projects/${data.projectId}/compose`);
	} catch (e) {
		console.error("Delete failed:", e);
	}
}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<a
				href="/projects/{data.projectId}"
				class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			>
				<ArrowLeft class="size-5" />
			</a>
			<div class="flex items-center gap-3">
				<StatusDot status={stackStatus()} />
				<h1 class="text-2xl font-semibold">{data.stack.name}</h1>
				<Badge variant="outline" class="text-xs capitalize">{data.stack.status ?? "stopped"}</Badge>
			</div>
		</div>

		<div class="flex items-center gap-2">
			{#if data.stack.status === "running"}
				<Button variant="outline" onclick={handleStop}>
					<Square class="mr-2 size-4" />
					Stop
				</Button>
			{/if}
			<Button onclick={handleDeploy}>
				<Play class="mr-2 size-4" />
				{hasChanges ? "Save & Deploy" : "Redeploy"}
			</Button>
			<Button variant="ghost" size="icon" onclick={() => (showDelete = true)}>
				<Trash2 class="size-4 text-destructive" />
			</Button>
		</div>
	</div>

	<div class="grid gap-6 lg:grid-cols-5">
		<div class="lg:col-span-3 space-y-4">
			<Card.Root>
				<Card.Header>
					<div class="flex items-center justify-between">
						<Card.Title class="text-sm">docker-compose.yml</Card.Title>
						{#if hasChanges}
							<Badge variant="outline" class="text-2xs text-yellow-500 border-yellow-500">Unsaved</Badge>
						{/if}
					</div>
				</Card.Header>
				<Card.Content>
					<ComposeEditor bind:value={yamlValue} />
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title class="text-sm">Environment Variables</Card.Title>
					<p class="text-xs text-muted-foreground">
						All environment variables from your compose file. Edit values here or in the service sidebar.
					</p>
				</Card.Header>
				<Card.Content>
					<ComposeEnvEditor
						bind:yamlContent={yamlValue}
						bind:envValue
						onYamlChange={(v) => (yamlValue = v)}
						onEnvChange={(v) => (envValue = v)}
					/>
				</Card.Content>
			</Card.Root>

			{#if hasChanges}
				<div class="flex items-center gap-3">
					<Button onclick={handleSave} disabled={saving}>
						{saving ? "Saving..." : "Save Changes"}
					</Button>
					<span class="text-xs text-muted-foreground">Unsaved changes</span>
				</div>
			{/if}
		</div>

		<div class="lg:col-span-2 space-y-4">
			<ComposeTopology yamlContent={yamlValue} />

			<Card.Root>
				<Card.Header>
					<Card.Title class="text-sm">Info</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-muted-foreground">Status</span>
						<span class="capitalize">{data.stack.status ?? "stopped"}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-muted-foreground">Source</span>
						<span class="capitalize">{data.stack.sourceType}</span>
					</div>
					{#if data.stack.lastDeployedAt}
						<div class="flex justify-between">
							<span class="text-muted-foreground">Last deployed</span>
							<TimeAgo date={data.stack.lastDeployedAt} />
						</div>
					{/if}
					<div class="flex justify-between">
						<span class="text-muted-foreground">Updated</span>
						<TimeAgo date={data.stack.updatedAt} />
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>

<Dialog.Root bind:open={showDelete}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Delete Stack</Dialog.Title>
			<Dialog.Description>
				This will delete the compose stack and all associated resources. This action cannot be undone.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Dialog.Close>
				<Button variant="outline">Cancel</Button>
			</Dialog.Close>
			<Button variant="destructive" onclick={handleDelete}>Delete</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
