<script lang="ts">
import {
	FolderPlus,
	Layers,
	LayoutDashboard,
	Play,
	Plus,
	Rocket,
	RotateCcw,
	ScrollText,
	Search,
	Server,
	Settings,
} from "@lucide/svelte";
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import { trpc } from "$lib/trpc.js";

type PaletteItem = {
	id: string;
	label: string;
	description?: string;
	icon: typeof Search;
	section: string;
	action: () => void;
};

type Props = {
	projects?: Array<{ id: string; name: string }>;
};

let { projects = [] }: Props = $props();

let open = $state(false);
let query = $state("");
let selectedIdx = $state(0);
let inputEl: HTMLInputElement | undefined = $state();
let services = $state<Array<{ id: string; name: string; projectId: string; type: string }>>([]);

const staticItems: PaletteItem[] = [
	{
		id: "new-project",
		label: "New Project",
		description: "Create a new project",
		icon: FolderPlus,
		section: "Actions",
		action: () => goto("/projects"),
	},
	{
		id: "templates",
		label: "Browse Templates",
		description: "Deploy from template gallery",
		icon: Rocket,
		section: "Actions",
		action: () => goto("/templates"),
	},
	{
		id: "monitoring",
		label: "System Monitoring",
		description: "View cluster health",
		icon: LayoutDashboard,
		section: "Actions",
		action: () => goto("/monitoring"),
	},
	{
		id: "settings",
		label: "Settings",
		description: "Manage your instance",
		icon: Settings,
		section: "Actions",
		action: () => goto("/settings"),
	},
	{
		id: "notifications",
		label: "Notification Settings",
		description: "Configure alerts",
		icon: Settings,
		section: "Actions",
		action: () => goto("/settings/notifications"),
	},
];

const allItems = $derived(() => {
	const items: PaletteItem[] = [];

	for (const p of projects) {
		items.push({
			id: `project-${p.id}`,
			label: p.name,
			description: "Project",
			icon: Layers,
			section: "Projects",
			action: () => goto(`/projects/${p.id}`),
		});
	}

	for (const s of services) {
		const project = projects.find((p) => p.id === s.projectId);
		items.push({
			id: `service-${s.id}`,
			label: s.name,
			description: project ? `${project.name} · ${s.type}` : s.type,
			icon: Server,
			section: "Services",
			action: () => goto(`/projects/${s.projectId}`),
		});
	}

	items.push(...staticItems);
	return items;
});

const filtered = $derived(() => {
	const items = allItems();
	if (!query) return items;
	const q = query.toLowerCase();
	return items.filter(
		(item) =>
			item.label.toLowerCase().includes(q) ||
			(item.description?.toLowerCase().includes(q) ?? false),
	);
});

const grouped = $derived(() => {
	const items = filtered();
	const groups = new Map<string, PaletteItem[]>();
	for (const item of items) {
		const list = groups.get(item.section) ?? [];
		list.push(item);
		groups.set(item.section, list);
	}
	return groups;
});

function handleKeydown(e: KeyboardEvent) {
	if ((e.metaKey || e.ctrlKey) && e.key === "k") {
		e.preventDefault();
		toggle();
		return;
	}

	if (!open) return;

	const items = filtered();
	if (e.key === "ArrowDown") {
		e.preventDefault();
		selectedIdx = Math.min(selectedIdx + 1, items.length - 1);
	} else if (e.key === "ArrowUp") {
		e.preventDefault();
		selectedIdx = Math.max(selectedIdx - 1, 0);
	} else if (e.key === "Enter") {
		e.preventDefault();
		const item = items[selectedIdx];
		if (item) {
			close();
			item.action();
		}
	} else if (e.key === "Escape") {
		close();
	}
}

function toggle() {
	if (open) {
		close();
	} else {
		open = true;
		query = "";
		selectedIdx = 0;
		loadServices();
		requestAnimationFrame(() => inputEl?.focus());
	}
}

function close() {
	open = false;
	query = "";
}

async function loadServices() {
	try {
		const allServices: typeof services = [];
		for (const p of projects) {
			const svcs = await trpc.service.list.query({ projectId: p.id });
			allServices.push(
				...svcs.map((s) => ({ id: s.id, name: s.name, projectId: p.id, type: s.type })),
			);
		}
		services = allServices;
	} catch {
		// Ignore
	}
}

onMount(() => {
	document.addEventListener("keydown", handleKeydown);
	return () => document.removeEventListener("keydown", handleKeydown);
});
</script>

{#if open}
	<button type="button" class="fixed inset-0 z-[200] bg-black/50" onclick={close} aria-label="Close"></button>
	<div class="fixed left-1/2 top-[15%] z-[201] w-full max-w-xl -translate-x-1/2 rounded-xl border border-border bg-card shadow-2xl">
		<div class="flex items-center gap-3 border-b border-border px-4 py-3">
			<Search class="size-4 text-muted-foreground" />
			<input
				bind:this={inputEl}
				bind:value={query}
				placeholder="Search commands, projects, services..."
				class="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
			/>
			<kbd class="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">ESC</kbd>
		</div>

		<div class="max-h-80 overflow-y-auto p-2">
			{#each grouped() as [section, items]}
				<div class="mb-1">
					<p class="px-2 py-1 text-2xs font-medium uppercase tracking-wider text-muted-foreground">{section}</p>
					{#each items as item, i}
						{@const globalIdx = filtered().indexOf(item)}
						<button
							type="button"
							onclick={() => { close(); item.action(); }}
							onmouseenter={() => (selectedIdx = globalIdx)}
							class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors {globalIdx === selectedIdx ? 'bg-muted' : 'hover:bg-muted/50'}"
						>
							<item.icon class="size-4 shrink-0 text-muted-foreground" />
							<div class="flex-1 min-w-0">
								<span class="font-medium">{item.label}</span>
								{#if item.description}
									<span class="ml-2 text-xs text-muted-foreground">{item.description}</span>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			{/each}

			{#if filtered().length === 0}
				<p class="px-3 py-6 text-center text-sm text-muted-foreground">No results found</p>
			{/if}
		</div>
	</div>
{/if}
