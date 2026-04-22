<script lang="ts">
import { page } from "$app/state";
import { cn } from "$lib/utils.js";

let { children } = $props();

const settingsNav = [
	{ href: "/settings", label: "General" },
	{ href: "/settings/git", label: "Git" },
	{ href: "/settings/domains", label: "Domains" },
	{ href: "/settings/notifications", label: "Notifications" },
	{ href: "/settings/organization", label: "Organization" },
	{ href: "/settings/nodes", label: "Nodes" },
	{ href: "/settings/backup", label: "Backup" },
	{ href: "/settings/updates", label: "Updates" },
	{ href: "/settings/api-keys", label: "API Keys" },
	{ href: "/settings/audit-log", label: "Audit Log" },
];

function isActive(href: string): boolean {
	if (href === "/settings") return page.url.pathname === "/settings";
	return page.url.pathname.startsWith(href);
}
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-semibold">Settings</h1>

	<!-- Mobile: horizontal scroll tabs, Desktop: vertical sidebar -->
	<div class="flex flex-col gap-6 md:flex-row md:gap-8">
		<nav class="flex gap-1 overflow-x-auto pb-1 md:w-48 md:shrink-0 md:flex-col md:space-y-1 md:overflow-visible md:pb-0">
			{#each settingsNav as item}
				<a
					href={item.href}
					class={cn(
						"shrink-0 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors",
						isActive(item.href)
							? "bg-muted font-medium text-foreground"
							: "text-muted-foreground hover:bg-muted hover:text-foreground",
					)}
				>
					{item.label}
				</a>
			{/each}
		</nav>

		<div class="min-w-0 flex-1">
			{@render children()}
		</div>
	</div>
</div>
