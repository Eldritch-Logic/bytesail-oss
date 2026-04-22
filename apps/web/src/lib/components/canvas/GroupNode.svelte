<script lang="ts">
import { ChevronRight, EllipsisVertical, Pencil, Trash2 } from "@lucide/svelte";
import { onDestroy } from "svelte";

type Props = {
	data: {
		name: string;
		color?: string;
		onRename?: (name: string) => void;
		onDelete?: () => void;
		onColorChange?: (color: string) => void;
	};
};

let { data: nodeData }: Props = $props();

let editing = $state(false);
let editName = $state(nodeData.name);
let showMenu = $state(false);
let showColors = $state(false);
let menuX = $state(0);
let menuY = $state(0);

let menuEl: HTMLDivElement | null = null;
let backdropEl: HTMLButtonElement | null = null;

const colorOptions = [
	{ name: "Gray", value: "gray", hex: "#6b7280" },
	{ name: "Teal", value: "teal", hex: "#14b8a6" },
	{ name: "Green", value: "green", hex: "#22c55e" },
	{ name: "Amber", value: "amber", hex: "#f59e0b" },
	{ name: "Red", value: "red", hex: "#ef4444" },
	{ name: "Blue", value: "blue", hex: "#3b82f6" },
	{ name: "Purple", value: "purple", hex: "#a855f7" },
];

const colorHex = $derived(colorOptions.find((c) => c.value === nodeData.color)?.hex ?? "#6b7280");

function finishEdit() {
	editing = false;
	if (editName.trim() && editName !== nodeData.name) {
		nodeData.onRename?.(editName.trim());
	}
}

function closeMenu() {
	showMenu = false;
	showColors = false;
	menuEl?.remove();
	backdropEl?.remove();
	menuEl = null;
	backdropEl = null;
}

function openMenu(e: MouseEvent) {
	e.stopPropagation();
	if (showMenu) {
		closeMenu();
		return;
	}

	const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
	menuX = rect.right + 4;
	menuY = rect.top;
	showMenu = true;
	showColors = false;

	renderMenu();
}

function getThemeColors() {
	const root = document.documentElement;
	const style = getComputedStyle(root);
	const get = (v: string) => {
		const val = style.getPropertyValue(v).trim();
		return val ? `hsl(${val})` : "";
	};
	return {
		card: get("--card") || "#1c1c1c",
		border: get("--border") || "#2e2e2e",
		foreground: get("--foreground") || "#fafafa",
		muted: get("--muted") || "#262626",
		destructive: get("--destructive") || "#ef4444",
	};
}

function renderMenu() {
	closePortalElements();

	const t = getThemeColors();
	const menuStyle = `position:fixed; z-index:9999; min-width:160px; border-radius:8px; border:1px solid ${t.border}; background-color:${t.card}; padding:4px 0; box-shadow:0 10px 25px -5px rgba(0,0,0,.5);`;
	const btnStyle = `display:flex; align-items:center; gap:8px; width:100%; padding:6px 12px; font-size:14px; color:${t.foreground}; background:transparent; border:none; cursor:pointer; text-align:left;`;
	const dangerBtnStyle = btnStyle.replace(t.foreground, t.destructive);

	backdropEl = document.createElement("button");
	backdropEl.style.cssText =
		"position:fixed; inset:0; z-index:9998; background:transparent; border:none; cursor:default;";
	backdropEl.onclick = closeMenu;
	document.body.appendChild(backdropEl);

	menuEl = document.createElement("div");
	menuEl.style.cssText = `${menuStyle} left:${menuX}px; top:${menuY}px;`;

	menuEl.innerHTML = `
		<button data-action="rename" style="${btnStyle}">
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>
			Rename
		</button>
		<div style="position:relative;" data-color-wrapper>
			<button data-action="toggle-colors" style="${btnStyle} justify-content:space-between;">
				<span style="display:flex; align-items:center; gap:8px;">
					<span style="display:inline-block; width:14px; height:14px; border-radius:50%; background-color:${colorHex};"></span>
					Colour
				</span>
				<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
			</button>
		</div>
		<div style="height:1px; margin:2px 4px; background:${t.border};"></div>
		<button data-action="delete" style="${dangerBtnStyle}">
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
			Remove Group
		</button>
	`;

	for (const btn of menuEl.querySelectorAll("button")) {
		btn.addEventListener("mouseenter", () => {
			btn.style.background = t.muted;
		});
		btn.addEventListener("mouseleave", () => {
			btn.style.background = "transparent";
		});
	}

	menuEl.querySelector("[data-action=rename]")?.addEventListener("click", (ev) => {
		ev.stopPropagation();
		closeMenu();
		editing = true;
		editName = nodeData.name;
	});

	menuEl.querySelector("[data-action=toggle-colors]")?.addEventListener("click", (ev) => {
		ev.stopPropagation();
		const wrapper = menuEl?.querySelector("[data-color-wrapper]");
		const existing = wrapper?.querySelector("[data-color-submenu]");
		if (existing) {
			existing.remove();
			return;
		}

		const sub = document.createElement("div");
		sub.setAttribute("data-color-submenu", "");
		sub.style.cssText = `position:absolute; left:100%; top:0; margin-left:4px; min-width:140px; border-radius:8px; border:1px solid ${t.border}; background-color:${t.card}; padding:4px 0; box-shadow:0 10px 25px -5px rgba(0,0,0,.5);`;

		for (const c of colorOptions) {
			const btn = document.createElement("button");
			btn.style.cssText = `display:flex; align-items:center; gap:10px; width:100%; padding:6px 12px; font-size:14px; color:${t.foreground}; background:transparent; border:none; cursor:pointer; text-align:left;`;
			btn.innerHTML = `<span style="display:inline-block; width:12px; height:12px; border-radius:50%; background-color:${c.hex};"></span>${c.name}`;
			btn.addEventListener("mouseenter", () => {
				btn.style.background = t.muted;
			});
			btn.addEventListener("mouseleave", () => {
				btn.style.background = "transparent";
			});
			btn.addEventListener("click", (ev) => {
				ev.stopPropagation();
				nodeData.onColorChange?.(c.value);
				closeMenu();
			});
			sub.appendChild(btn);
		}

		wrapper?.appendChild(sub);
	});

	menuEl.querySelector("[data-action=delete]")?.addEventListener("click", (ev) => {
		ev.stopPropagation();
		closeMenu();
		nodeData.onDelete?.();
	});

	document.body.appendChild(menuEl);
}

function closePortalElements() {
	menuEl?.remove();
	backdropEl?.remove();
	menuEl = null;
	backdropEl = null;
}

onDestroy(closePortalElements);
</script>

<div
	class="flex h-full w-full flex-col rounded-2xl border-2 border-dashed px-4 pb-4 pt-3"
	style="border-color: {colorHex}; background: {colorHex}18;"
>
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			{#if editing}
				<input
					type="text"
					bind:value={editName}
					onblur={finishEdit}
					onkeydown={(e) => { if (e.key === "Enter") finishEdit(); if (e.key === "Escape") { editing = false; editName = nodeData.name; } }}
					class="h-7 w-40 rounded-md border border-border bg-background px-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
				/>
			{:else}
				<span class="text-sm font-semibold" style="color: {colorHex};">{nodeData.name}</span>
			{/if}
		</div>

		<button
			type="button"
			onclick={openMenu}
			class="rounded-md p-1 hover:bg-muted/50"
			style="color: {colorHex};"
		>
			<EllipsisVertical class="size-4" />
		</button>
	</div>
</div>
