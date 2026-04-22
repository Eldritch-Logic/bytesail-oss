<script lang="ts">
import {
	Activity,
	FolderKanban,
	LayoutTemplate,
	PanelLeftClose,
	PanelLeftOpen,
	Settings,
	Ship,
	X,
} from "@lucide/svelte";
import { page } from "$app/state";
import { cn } from "$lib/utils.js";

type Props = {
	collapsed?: boolean;
	mobileOpen?: boolean;
	onToggle?: () => void;
	onMobileClose?: () => void;
};

let {
	collapsed = $bindable(false),
	mobileOpen = $bindable(false),
	onToggle,
	onMobileClose,
}: Props = $props();

const navItems = [
	{ href: "/projects", label: "Projects", icon: FolderKanban },
	{ href: "/monitoring", label: "Monitoring", icon: Activity },
	{ href: "/templates", label: "Templates", icon: LayoutTemplate },
	{ href: "/settings", label: "Settings", icon: Settings },
];

function isActive(href: string): boolean {
	return page.url.pathname.startsWith(href);
}

function toggle() {
	collapsed = !collapsed;
	onToggle?.();
}

function handleNavClick() {
	if (mobileOpen) {
		mobileOpen = false;
		onMobileClose?.();
	}
}
</script>

<!-- Mobile overlay -->
{#if mobileOpen}
	<button
		type="button"
		class="fixed inset-0 z-40 bg-black/50 md:hidden"
		onclick={() => {
			mobileOpen = false;
			onMobileClose?.();
		}}
		aria-label="Close sidebar"
	></button>
{/if}

<aside
	class={cn(
		"flex h-screen flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-200",
		/* Mobile: hidden by default, slide in when open */
		"fixed inset-y-0 left-0 z-50 w-60 -translate-x-full md:relative md:translate-x-0",
		mobileOpen && "translate-x-0",
		/* Tablet (md-lg): icon-only collapsed */
		!mobileOpen && "md:w-16 lg:w-60",
		/* Desktop: respect manual collapse */
		collapsed ? "lg:w-16" : "lg:w-60",
	)}
>
	<div
		class={cn(
			"flex h-14 items-center border-b border-border px-4",
			!mobileOpen && "md:justify-center md:px-0 lg:justify-start lg:px-4",
			collapsed && "lg:justify-center lg:px-0",
		)}
	>
		<Ship class="size-6 shrink-0 text-primary" />
		<span
			class={cn(
				"ml-2 text-lg font-semibold",
				!mobileOpen && "md:hidden lg:inline",
				collapsed && "lg:hidden",
			)}
		>
			ByteSail
		</span>

		<!-- Mobile close button -->
		<button
			type="button"
			class="ml-auto rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent md:hidden"
			onclick={() => {
				mobileOpen = false;
				onMobileClose?.();
			}}
			aria-label="Close sidebar"
		>
			<X class="size-5" />
		</button>
	</div>

	<nav class="flex-1 space-y-1 p-2">
		{#each navItems as item}
			<a
				href={item.href}
				onclick={handleNavClick}
				class={cn(
					"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
					isActive(item.href)
						? "bg-sidebar-accent text-sidebar-accent-foreground"
						: "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
					!mobileOpen && "md:justify-center md:px-0 lg:justify-start lg:px-3",
					collapsed && "lg:justify-center lg:px-0",
				)}
				title={(!mobileOpen || collapsed) ? item.label : undefined}
			>
				<item.icon class="size-5 shrink-0" />
				<span
					class={cn(
						!mobileOpen && "md:hidden lg:inline",
						collapsed && "lg:hidden",
					)}
				>
					{item.label}
				</span>
			</a>
		{/each}
	</nav>

	<div class="border-t border-border p-2 hidden lg:block">
		<button
			type="button"
			onclick={toggle}
			class="flex w-full items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
			aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
		>
			{#if collapsed}
				<PanelLeftOpen class="size-5" />
			{:else}
				<PanelLeftClose class="size-5" />
			{/if}
		</button>
	</div>
</aside>
