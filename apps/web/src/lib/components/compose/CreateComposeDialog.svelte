<script lang="ts">
import { goto } from "$app/navigation";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { Label } from "$lib/components/ui/label/index.js";
import { trpc } from "$lib/trpc.js";

type Props = {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	projectId: string;
};

let { open = $bindable(false), onOpenChange, projectId }: Props = $props();

let name = $state("");
let error = $state("");
let loading = $state(false);

async function handleCreate() {
	if (!name.trim()) {
		error = "Stack name is required";
		return;
	}

	error = "";
	loading = true;

	try {
		const defaultYaml = `services:\n  app:\n    image: nginx:latest\n    ports:\n      - "80:80"\n`;
		const stack = await trpc.compose.create.mutate({
			projectId,
			name: name.trim(),
			composeFile: defaultYaml,
		});

		open = false;
		onOpenChange?.(false);
		goto(`/projects/${projectId}/compose/${stack.id}`);
	} catch (e) {
		error = e instanceof Error ? e.message : "Failed to create stack";
	} finally {
		loading = false;
	}
}

function reset() {
	name = "";
	error = "";
	loading = false;
}
</script>

<Dialog.Root
	bind:open
	onOpenChange={(v) => {
		if (!v) reset();
		onOpenChange?.(v);
	}}
>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>New Compose Stack</Dialog.Title>
			<Dialog.Description>Give your stack a name to get started.</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4 py-4">
			{#if error}
				<Alert.Root variant="destructive">
					<Alert.Description>{error}</Alert.Description>
				</Alert.Root>
			{/if}
			<div class="space-y-2">
				<Label for="stack-name">Stack name</Label>
				<Input
					id="stack-name"
					bind:value={name}
					placeholder="my-stack"
					autofocus
					onkeydown={(e) => { if (e.key === "Enter") handleCreate(); }}
				/>
			</div>
		</div>
		<Dialog.Footer>
			<Dialog.Close>
				<Button variant="outline">Cancel</Button>
			</Dialog.Close>
			<Button onclick={handleCreate} disabled={loading || !name.trim()}>
				{loading ? "Creating..." : "Create"}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
