<script lang="ts">
import { Menu, Moon, Search, Sun } from "@lucide/svelte";
import { mode, toggleMode } from "mode-watcher";
import * as Avatar from "$lib/components/ui/avatar/index.js";
import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
import Breadcrumbs from "./Breadcrumbs.svelte";

type Project = { id: string; name: string; slug: string };

type Props = {
	userName?: string;
	userEmail?: string;
	userImage?: string;
	projects?: Project[];
	onCommandPalette?: () => void;
	onMobileMenuToggle?: () => void;
};

let {
	userName = "",
	userEmail = "",
	userImage,
	projects = [],
	onCommandPalette,
	onMobileMenuToggle,
}: Props = $props();

function initials(name: string): string {
	return name
		.split(" ")
		.map((p) => p[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}
</script>

<header class="flex h-14 items-center justify-between border-b border-border bg-background px-4">
	<div class="flex items-center gap-2">
		<button
			type="button"
			onclick={onMobileMenuToggle}
			class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
			aria-label="Toggle menu"
		>
			<Menu class="size-5" />
		</button>
		<Breadcrumbs {projects} />
	</div>

	<div class="flex items-center gap-2">
		<button
			type="button"
			onclick={onCommandPalette}
			class="flex items-center gap-2 rounded-md border border-input bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
		>
			<Search class="size-4" />
			<span class="hidden sm:inline">Search...</span>
			<kbd class="hidden rounded border border-border bg-background px-1.5 py-0.5 font-mono text-2xs sm:inline">
				⌘K
			</kbd>
		</button>

		<button
			type="button"
			onclick={toggleMode}
			class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			aria-label="Toggle theme"
		>
			{#if mode.current === "dark"}
				<Sun class="size-4" />
			{:else}
				<Moon class="size-4" />
			{/if}
		</button>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				<Avatar.Root class="size-8 cursor-pointer">
					{#if userImage}
						<Avatar.Image src={userImage} alt={userName} />
					{/if}
					<Avatar.Fallback class="text-xs">{initials(userName)}</Avatar.Fallback>
				</Avatar.Root>
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" class="w-56">
				<DropdownMenu.Label>
					<div class="flex flex-col">
						<span class="text-sm font-medium">{userName}</span>
						<span class="text-xs text-muted-foreground">{userEmail}</span>
					</div>
				</DropdownMenu.Label>
				<DropdownMenu.Separator />
				<DropdownMenu.Item href="/settings">Settings</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item href="/logout">Log out</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
</header>
