<script lang="ts">
import type { Snippet } from "svelte";
import { updateStore } from "$lib/stores/update.js";
import CommandPalette from "./CommandPalette.svelte";
import ConnectionBanner from "./ConnectionBanner.svelte";
import Header from "./Header.svelte";
import Sidebar from "./Sidebar.svelte";
import UpdateBanner from "./UpdateBanner.svelte";
import UpdateConfirmDialog from "./UpdateConfirmDialog.svelte";
import UpdateNotesDialog from "./UpdateNotesDialog.svelte";

type Project = { id: string; name: string; slug: string };

type Props = {
	userName?: string;
	userEmail?: string;
	userImage?: string;
	projects?: Project[];
	children: Snippet;
};

let { userName, userEmail, userImage, projects = [], children }: Props = $props();
let collapsed = $state(false);
let mobileOpen = $state(false);
let showNotes = $state(false);
let showConfirm = $state(false);
</script>

<div class="flex h-screen overflow-hidden">
	<Sidebar bind:collapsed bind:mobileOpen />

	<div class="flex flex-1 flex-col overflow-hidden">
		<Header {userName} {userEmail} {userImage} {projects} onMobileMenuToggle={() => (mobileOpen = !mobileOpen)} />

		<ConnectionBanner />

		{#if $updateStore.updateAvailable && !$updateStore.dismissed}
			<UpdateBanner
				update={$updateStore.updateAvailable}
				onViewNotes={() => (showNotes = true)}
				onUpdateNow={() => (showConfirm = true)}
				onDismiss={() => updateStore.dismiss()}
			/>
		{/if}

		<main class="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
			{@render children()}
		</main>
	</div>
</div>

<CommandPalette {projects} />

{#if $updateStore.updateAvailable}
	<UpdateNotesDialog
		bind:open={showNotes}
		version={$updateStore.updateAvailable.latestVersion}
		publishedAt={$updateStore.updateAvailable.publishedAt}
		releaseNotes={$updateStore.updateAvailable.releaseNotes}
		htmlUrl={$updateStore.updateAvailable.htmlUrl}
		onUpdateNow={() => {
			showNotes = false;
			showConfirm = true;
		}}
	/>

	<UpdateConfirmDialog
		bind:open={showConfirm}
		currentVersion={$updateStore.updateAvailable.currentVersion}
		targetVersion={$updateStore.updateAvailable.latestVersion}
		releaseNotes={$updateStore.updateAvailable.releaseNotes}
	/>
{/if}
