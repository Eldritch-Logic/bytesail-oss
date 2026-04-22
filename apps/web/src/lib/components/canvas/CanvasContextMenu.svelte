<script lang="ts">
import type { services } from "@bytesail/db/schema";
import {
	ChevronRight,
	FolderInput,
	FolderOutput,
	Group,
	Layers,
	Play,
	Plus,
	RefreshCw,
	ScrollText,
	Square,
	Trash2,
} from "@lucide/svelte";
import type { InferSelectModel } from "drizzle-orm";

type Service = InferSelectModel<typeof services>;

type GroupInfo = { id: string; name: string; color?: string };

type MenuAction =
	| { type: "addGroup" }
	| { type: "addService" }
	| { type: "fitView" }
	| { type: "deploy"; service: Service }
	| { type: "restart"; service: Service }
	| { type: "stop"; service: Service }
	| { type: "viewLogs"; service: Service }
	| { type: "delete"; service: Service }
	| { type: "moveToGroup"; serviceId: string; groupId: string }
	| { type: "removeFromGroup"; serviceId: string };

type Props = {
	x: number;
	y: number;
	show: boolean;
	service?: Service | null;
	currentGroupId?: string | null;
	groups?: GroupInfo[];
	onAction: (action: MenuAction) => void;
	onClose: () => void;
};

let {
	x,
	y,
	show,
	service = null,
	currentGroupId = null,
	groups = [],
	onAction,
	onClose,
}: Props = $props();

let showGroupSubmenu = $state(false);
let menuEl: HTMLDivElement | undefined = $state();
let adjustedX = $state(0);
let adjustedY = $state(0);

function handleAction(action: MenuAction) {
	onAction(action);
	onClose();
	showGroupSubmenu = false;
}

const availableGroups = $derived(groups.filter((g) => g.id !== currentGroupId));

$effect(() => {
	if (!show) {
		showGroupSubmenu = false;
		return;
	}
	adjustedX = x;
	adjustedY = y;
	requestAnimationFrame(() => {
		if (!menuEl) return;
		const rect = menuEl.getBoundingClientRect();
		const pad = 8;
		if (rect.right > window.innerWidth - pad) {
			adjustedX = window.innerWidth - rect.width - pad;
		}
		if (rect.bottom > window.innerHeight - pad) {
			adjustedY = window.innerHeight - rect.height - pad;
		}
		if (adjustedX < pad) adjustedX = pad;
		if (adjustedY < pad) adjustedY = pad;
	});
});
</script>

{#if show}
	<button
		type="button"
		class="fixed inset-0 z-50"
		onclick={onClose}
		oncontextmenu={(e) => { e.preventDefault(); onClose(); }}
		aria-label="Close menu"
	></button>

	<div
		bind:this={menuEl}
		class="fixed z-50 min-w-[200px] rounded-lg border border-border bg-card py-1 shadow-xl"
		style="left: {adjustedX}px; top: {adjustedY}px;"
	>
		{#if service}
			<div class="px-3 py-1.5 text-xs font-medium text-muted-foreground">{service.name}</div>
			<div class="mx-1 my-0.5 h-px bg-border"></div>
			<button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted" onclick={() => handleAction({ type: "deploy", service })}>
				<Play class="size-3.5" /> Deploy
			</button>
			<button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted" onclick={() => handleAction({ type: "restart", service })}>
				<RefreshCw class="size-3.5" /> Restart
			</button>
			{#if service.status === "running"}
				<button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted" onclick={() => handleAction({ type: "stop", service })}>
					<Square class="size-3.5" /> Stop
				</button>
			{/if}
			<button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted" onclick={() => handleAction({ type: "viewLogs", service })}>
				<ScrollText class="size-3.5" /> View Logs
			</button>

			{#if availableGroups.length > 0 || currentGroupId}
				<div class="mx-1 my-0.5 h-px bg-border"></div>

				{#if availableGroups.length > 0}
					<div class="relative">
						<button
							type="button"
							class="flex w-full items-center justify-between px-3 py-1.5 text-sm hover:bg-muted"
							onclick={() => (showGroupSubmenu = !showGroupSubmenu)}
						>
							<span class="flex items-center gap-2">
								<FolderInput class="size-3.5" /> Move to Group
							</span>
							<ChevronRight class="size-3" />
						</button>

						{#if showGroupSubmenu}
							<div class="absolute left-full top-0 ml-1 min-w-[160px] rounded-lg border border-border bg-card py-1 shadow-xl">
								{#each availableGroups as group}
									<button
										type="button"
										class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted"
										onclick={() => handleAction({ type: "moveToGroup", serviceId: service.id, groupId: group.id })}
									>
										<Group class="size-3.5" />
										{group.name}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				{#if currentGroupId}
					<button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted" onclick={() => handleAction({ type: "removeFromGroup", serviceId: service.id })}>
						<FolderOutput class="size-3.5" /> Remove from Group
					</button>
				{/if}
			{/if}

			<div class="mx-1 my-0.5 h-px bg-border"></div>
			<button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-muted" onclick={() => handleAction({ type: "delete", service })}>
				<Trash2 class="size-3.5" /> Delete
			</button>
		{:else}
			<button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted" onclick={() => handleAction({ type: "addService" })}>
				<Plus class="size-3.5" /> Add Service
			</button>
			<button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted" onclick={() => handleAction({ type: "addGroup" })}>
				<Group class="size-3.5" /> Add Group
			</button>
			<div class="mx-1 my-0.5 h-px bg-border"></div>
			<button type="button" class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted" onclick={() => handleAction({ type: "fitView" })}>
				<Layers class="size-3.5" /> Fit to View
			</button>
		{/if}
	</div>
{/if}
