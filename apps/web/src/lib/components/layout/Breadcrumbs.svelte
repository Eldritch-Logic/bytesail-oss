<script lang="ts">
import { ChevronDown, ChevronRight } from "@lucide/svelte";
import { page } from "$app/state";

type Project = { id: string; name: string; slug: string };

type Props = {
	projects?: Project[];
};

let { projects = [] }: Props = $props();

let showProjectDropdown = $state(false);

type Crumb = {
	label: string;
	href: string;
	isProject?: boolean;
	projectId?: string;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildCrumbs(pathname: string): Crumb[] {
	const segments = pathname.split("/").filter(Boolean);
	const crumbs: Crumb[] = [];
	let path = "";

	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i];
		path += `/${segment}`;

		if (UUID_REGEX.test(segment)) {
			const prevSegment = segments[i - 1];

			if (prevSegment === "projects") {
				const project = projects.find((p) => p.id === segment);
				crumbs.push({
					label: project?.name ?? segment.slice(0, 8),
					href: path,
					isProject: true,
					projectId: segment,
				});
				continue;
			}

			crumbs.push({
				label: segment.slice(0, 8) + "...",
				href: path,
			});
			continue;
		}

		crumbs.push({
			label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " "),
			href: path,
		});
	}

	return crumbs;
}

const crumbs = $derived(buildCrumbs(page.url.pathname));

const currentProjectId = $derived(crumbs.find((c) => c.isProject)?.projectId ?? null);

function switchProject(projectId: string) {
	showProjectDropdown = false;
	window.location.href = `/projects/${projectId}`;
}
</script>

<nav aria-label="Breadcrumb" class="flex items-center gap-1 text-sm">
	{#each crumbs as crumb, i}
		{#if i > 0}
			<ChevronRight class="size-3.5 text-muted-foreground" />
		{/if}

		{#if crumb.isProject && projects.length > 1}
			<div class="relative">
				<button
					type="button"
					onclick={() => (showProjectDropdown = !showProjectDropdown)}
					class="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-foreground transition-colors hover:bg-muted"
				>
					{crumb.label}
					<ChevronDown class="size-3 text-muted-foreground" />
				</button>

				{#if showProjectDropdown}
					<button
						type="button"
						class="fixed inset-0 z-40"
						onclick={() => (showProjectDropdown = false)}
						aria-label="Close"
					></button>
					<div class="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-border bg-card py-1 shadow-xl">
						{#each projects as project}
							<button
								type="button"
								onclick={() => switchProject(project.id)}
								class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted {project.id === currentProjectId ? 'text-primary font-medium' : ''}"
							>
								{project.name}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{:else if i === crumbs.length - 1}
			<span class="font-medium text-foreground">{crumb.label}</span>
		{:else}
			<a href={crumb.href} class="text-muted-foreground transition-colors hover:text-foreground">
				{crumb.label}
			</a>
		{/if}
	{/each}
</nav>
