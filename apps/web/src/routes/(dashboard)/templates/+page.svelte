<script lang="ts">
import { Rocket, Search, X } from "@lucide/svelte";
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import { toastError, toastSuccess } from "$lib/components/notifications/toast.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { trpc } from "$lib/trpc.js";

type Template = {
	slug: string;
	name: string;
	description: string;
	icon: string;
	category: string;
	tags: string[];
};

type Category = { slug: string; name: string };

type FormField = {
	key: string;
	label: string;
	type: string;
	default?: string;
	required?: boolean;
	options?: string[];
};

type TemplateSpec = {
	slug: string;
	name: string;
	description: string;
	icon: string;
	services: Array<{ name: string; image: string; port?: number }>;
	form?: FormField[];
};

let templates = $state<Template[]>([]);
let categories = $state<Category[]>([]);
let searchQuery = $state("");
let activeCategory = $state("all");
let loading = $state(true);

// Deploy dialog
let deployTemplate = $state<TemplateSpec | null>(null);
let deployProjectId = $state("");
let newProjectName = $state("");
let createNewProject = $state(false);
let formValues = $state<Record<string, string>>({});
let deploying = $state(false);
let projects = $state<Array<{ id: string; name: string }>>([]);

const filtered = $derived(
	templates.filter((t) => {
		if (activeCategory !== "all" && t.category !== activeCategory) return false;
		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			return (
				t.name.toLowerCase().includes(q) ||
				t.description.toLowerCase().includes(q) ||
				t.tags.some((tag) => tag.includes(q))
			);
		}
		return true;
	}),
);

async function loadTemplates() {
	loading = true;
	try {
		const result = await trpc.template.list.query();
		templates = result.templates as Template[];
		categories = result.categories as Category[];
	} catch (e) {
		console.error("Failed to load templates:", e);
	} finally {
		loading = false;
	}
}

async function openDeploy(slug: string) {
	try {
		const spec = await trpc.template.getBySlug.query({ slug });
		deployTemplate = spec as TemplateSpec;

		// Initialize form values with defaults
		formValues = {};
		for (const field of spec.form ?? []) {
			if (field.default) formValues[field.key] = field.default;
		}

		// Load projects
		const allProjects = await trpc.project.list.query();
		projects = allProjects.map((p) => ({ id: p.id, name: p.name }));
		createNewProject = projects.length === 0;
		newProjectName = spec.name ?? "";
		if (projects.length > 0) deployProjectId = projects[0].id;
	} catch (e) {
		toastError("Failed to load template");
	}
}

async function handleDeploy() {
	if (!deployTemplate) return;
	deploying = true;
	try {
		let projectId = deployProjectId;

		if (createNewProject) {
			if (!newProjectName.trim()) {
				toastError("Project name is required");
				deploying = false;
				return;
			}
			const slug = newProjectName
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9-]/g, "-")
				.replace(/-+/g, "-");
			const project = await trpc.project.create.mutate({ name: newProjectName.trim(), slug });
			projectId = project.id;
		}

		if (!projectId) {
			toastError("Select or create a project");
			deploying = false;
			return;
		}

		await trpc.template.deploy.mutate({
			slug: deployTemplate.slug,
			projectId,
			formValues,
		});
		toastSuccess(`${deployTemplate.name} deploying!`, "Check the project canvas for status.");
		deployTemplate = null;
		goto(`/projects/${projectId}`);
	} catch (e) {
		toastError("Deploy failed", e instanceof Error ? e.message : "");
	} finally {
		deploying = false;
	}
}

onMount(loadTemplates);
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<h1 class="text-2xl font-semibold">Templates</h1>
		<div class="relative w-full sm:w-64">
			<Search class="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input bind:value={searchQuery} placeholder="Search templates..." class="pl-9" />
			{#if searchQuery}
				<button type="button" onclick={() => (searchQuery = "")} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
					<X class="size-3.5" />
				</button>
			{/if}
		</div>
	</div>

	<div class="flex gap-2 overflow-x-auto pb-1">
		<button
			type="button"
			onclick={() => (activeCategory = "all")}
			class="shrink-0 rounded-full border px-3 py-1 text-sm transition-colors {activeCategory === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}"
		>
			All
		</button>
		{#each categories as cat}
			<button
				type="button"
				onclick={() => (activeCategory = cat.slug)}
				class="shrink-0 rounded-full border px-3 py-1 text-sm transition-colors {activeCategory === cat.slug ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}"
			>
				{cat.name}
			</button>
		{/each}
	</div>

	{#if loading}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each Array(8) as _}
				<div class="h-40 animate-pulse rounded-lg border border-border bg-muted/30"></div>
			{/each}
		</div>
	{:else if filtered.length === 0}
		<div class="flex flex-col items-center gap-3 py-12 text-center">
			<Rocket class="size-10 text-muted-foreground/50" />
			<p class="text-sm text-muted-foreground">No templates match your search.</p>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each filtered as template}
				<Card.Root class="flex flex-col transition-colors hover:border-primary/50">
					<Card.Header class="pb-2">
						<div class="flex items-start justify-between">
							<span class="text-3xl">{template.icon}</span>
							<Badge variant="outline" class="text-2xs capitalize">{template.category}</Badge>
						</div>
						<Card.Title class="text-base">{template.name}</Card.Title>
					</Card.Header>
					<Card.Content class="flex-1">
						<p class="text-xs text-muted-foreground">{template.description}</p>
					</Card.Content>
					<Card.Footer>
						<Button size="sm" class="w-full" onclick={() => openDeploy(template.slug)}>
							<Rocket class="mr-1.5 size-3.5" />
							Deploy
						</Button>
					</Card.Footer>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>

<!-- Deploy Dialog -->
{#if deployTemplate}
	<button type="button" class="fixed inset-0 z-40 bg-black/50" onclick={() => (deployTemplate = null)} aria-label="Close"></button>
	<div class="fixed inset-x-3 top-1/2 z-50 mx-auto max-w-lg -translate-y-1/2 rounded-xl border border-border bg-background p-4 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2 sm:p-6">
		<div class="flex items-center gap-3 mb-4">
			<span class="text-3xl">{deployTemplate.icon}</span>
			<div>
				<h2 class="text-lg font-semibold">{deployTemplate.name}</h2>
				<p class="text-xs text-muted-foreground">{deployTemplate.description}</p>
			</div>
		</div>

		<div class="space-y-4">
			<div class="space-y-2">
				<label class="text-sm font-medium">Project</label>
				<div class="flex gap-2 mb-2">
					{#if projects.length > 0}
						<button
							type="button"
							onclick={() => (createNewProject = false)}
							class="rounded-md border px-3 py-1 text-xs transition-colors {!createNewProject ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}"
						>
							Existing
						</button>
					{/if}
					<button
						type="button"
						onclick={() => (createNewProject = true)}
						class="rounded-md border px-3 py-1 text-xs transition-colors {createNewProject ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}"
					>
						New Project
					</button>
				</div>
				{#if createNewProject}
					<Input bind:value={newProjectName} placeholder="Project name" />
				{:else}
					<select id="deploy-project" bind:value={deployProjectId} class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
						{#each projects as p}
							<option value={p.id}>{p.name}</option>
						{/each}
					</select>
				{/if}
			</div>

			{#if deployTemplate.form && deployTemplate.form.length > 0}
				<div class="border-t border-border pt-4 space-y-3">
					<h3 class="text-sm font-medium">Configuration</h3>
					{#each deployTemplate.form as field}
						<div class="space-y-1.5">
							<label for="field-{field.key}" class="text-xs font-medium">{field.label}</label>
							{#if field.type === "select" && field.options}
								<select id="field-{field.key}" bind:value={formValues[field.key]} class="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm">
									{#each field.options as opt}
										<option value={opt}>{opt}</option>
									{/each}
								</select>
							{:else}
								<Input
									id="field-{field.key}"
									type={field.type === "password" ? "password" : "text"}
									value={formValues[field.key] ?? ""}
									oninput={(e) => (formValues[field.key] = (e.target as HTMLInputElement).value)}
									placeholder={field.default ?? ""}
								/>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			<div class="border-t border-border pt-4">
				<h3 class="text-xs font-medium text-muted-foreground mb-2">Services to create</h3>
				<div class="flex flex-wrap gap-2">
					{#each deployTemplate.services as svc}
						<Badge variant="outline" class="text-xs">{svc.name} ({svc.image})</Badge>
					{/each}
				</div>
			</div>

			<div class="flex gap-2 pt-2">
				<Button onclick={handleDeploy} disabled={deploying || !deployProjectId} class="flex-1">
					<Rocket class="mr-1.5 size-3.5" />
					{deploying ? "Deploying..." : "Deploy"}
				</Button>
				<Button variant="ghost" onclick={() => (deployTemplate = null)}>Cancel</Button>
			</div>
		</div>
	</div>
{/if}
