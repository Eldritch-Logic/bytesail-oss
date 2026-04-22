<script lang="ts">
import { Container, Database, FileCode, FolderKanban, LayoutTemplate } from "@lucide/svelte";
import { goto } from "$app/navigation";
import BranchSelector from "$lib/components/git/BranchSelector.svelte";
import RepoSelector from "$lib/components/git/RepoSelector.svelte";
import GithubIcon from "$lib/components/shared/GithubIcon.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { Label } from "$lib/components/ui/label/index.js";
import { Textarea } from "$lib/components/ui/textarea/index.js";
import { trpc } from "$lib/trpc.js";

type Props = {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
};

type Repo = {
	id: number;
	full_name: string;
	name: string;
	owner: { login: string };
	stargazers_count: number;
	language: string | null;
	private: boolean;
	installationId?: string;
	providerId?: string;
};

type Branch = { name: string };

let { open = $bindable(false), onOpenChange }: Props = $props();

let step = $state<"name" | "type" | "github" | "docker">("name");
let name = $state("");
let description = $state("");
let error = $state("");
let loading = $state(false);

// GitHub flow state
let repos = $state<Repo[]>([]);
let reposLoading = $state(false);
let selectedRepo = $state<Repo | null>(null);
let branches = $state<Branch[]>([]);
let branchesLoading = $state(false);
let selectedBranch = $state("main");
let rootDir = $state("/");
let autoDeploy = $state(true);

// Docker flow state
let dockerImage = $state("");
let dockerTag = $state("latest");

function slugify(input: string): string {
	return input
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, "")
		.replace(/[\s_]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

const serviceTypes = [
	{ id: "github", label: "GitHub Repo", icon: GithubIcon },
	{ id: "docker", label: "Docker Image", icon: Container },
	{ id: "database", label: "Database", icon: Database },
	{ id: "compose", label: "Compose Stack", icon: FileCode },
	{ id: "template", label: "Template", icon: LayoutTemplate },
	{ id: "empty", label: "Empty Project", icon: FolderKanban },
];

async function fetchRepos() {
	reposLoading = true;
	try {
		const res = await fetch("/api/github/repos");
		const data = await res.json();
		repos = data.repos ?? [];
	} catch {
		repos = [];
	} finally {
		reposLoading = false;
	}
}

async function fetchBranches(repo: Repo) {
	branchesLoading = true;
	try {
		const params = new URLSearchParams({
			owner: repo.owner.login,
			repo: repo.name,
			installationId: repo.installationId ?? "",
		});
		const res = await fetch(`/api/github/branches?${params}`);
		const data = await res.json();
		branches = data.branches ?? [];
		const defaultBranch =
			branches.find((b) => b.name === "main") ??
			branches.find((b) => b.name === "master") ??
			branches[0];
		if (defaultBranch) selectedBranch = defaultBranch.name;
	} catch {
		branches = [];
	} finally {
		branchesLoading = false;
	}
}

function handleRepoSelect(repo: Repo) {
	selectedRepo = repo;
	fetchBranches(repo);
}

async function createProjectWithService() {
	if (!selectedRepo) return;
	error = "";
	loading = true;

	try {
		const project = await trpc.project.create.mutate({
			name,
			slug: slugify(name),
			description: description || undefined,
		});

		const service = await trpc.service.create.mutate({
			projectId: project.id,
			name: selectedRepo.name,
			slug: slugify(selectedRepo.name),
			type: "app",
			sourceType: "github",
			gitProviderId: selectedRepo.providerId,
			repoOwner: selectedRepo.owner.login,
			repoName: selectedRepo.name,
			repoBranch: selectedBranch,
			repoSubdirectory: rootDir === "/" ? undefined : rootDir,
			autoDeploy,
		});

		// Trigger initial deployment
		await trpc.deployment.deploy.mutate({
			serviceId: service.id,
		});

		open = false;
		onOpenChange?.(false);
		goto(`/projects/${project.id}`);
	} catch (e) {
		error = e instanceof Error ? e.message : "Failed to create project";
	} finally {
		loading = false;
	}
}

async function createEmptyProject() {
	error = "";
	loading = true;

	try {
		const project = await trpc.project.create.mutate({
			name,
			slug: slugify(name),
			description: description || undefined,
		});
		open = false;
		onOpenChange?.(false);
		goto(`/projects/${project.id}`);
	} catch (e) {
		error = e instanceof Error ? e.message : "Failed to create project";
	} finally {
		loading = false;
	}
}

function handleNext() {
	if (!name.trim()) {
		error = "Project name is required";
		return;
	}
	error = "";
	step = "type";
}

async function createProjectWithDocker() {
	if (!dockerImage.trim()) {
		error = "Image name is required";
		return;
	}
	error = "";
	loading = true;

	try {
		const project = await trpc.project.create.mutate({
			name,
			slug: slugify(name),
			description: description || undefined,
		});

		const service = await trpc.service.create.mutate({
			projectId: project.id,
			name: dockerImage.split("/").pop() ?? dockerImage,
			slug: slugify(dockerImage.split("/").pop() ?? dockerImage),
			type: "app",
			sourceType: "docker_image",
			dockerImage,
			dockerTag: dockerTag || "latest",
			buildType: "docker_image",
		});

		await trpc.deployment.deploy.mutate({
			serviceId: service.id,
		});

		open = false;
		onOpenChange?.(false);
		goto(`/projects/${project.id}`);
	} catch (e) {
		error = e instanceof Error ? e.message : "Failed to create project";
	} finally {
		loading = false;
	}
}

async function createProjectWithCompose() {
	error = "";
	loading = true;

	try {
		const project = await trpc.project.create.mutate({
			name,
			slug: slugify(name),
			description: description || undefined,
		});

		const stack = await trpc.compose.create.mutate({
			projectId: project.id,
			name,
			composeFile: "",
		});

		open = false;
		onOpenChange?.(false);
		goto(`/projects/${project.id}/compose/${stack.id}`);
	} catch (e) {
		error = e instanceof Error ? e.message : "Failed to create project";
	} finally {
		loading = false;
	}
}

function handleServiceSelect(type: string) {
	if (type === "empty") {
		createEmptyProject();
		return;
	}
	if (type === "github") {
		step = "github";
		fetchRepos();
		return;
	}
	if (type === "docker") {
		step = "docker";
		return;
	}
	if (type === "compose") {
		createProjectWithCompose();
		return;
	}
	createEmptyProject();
}

function reset() {
	step = "name";
	name = "";
	description = "";
	error = "";
	loading = false;
	repos = [];
	selectedRepo = null;
	branches = [];
	selectedBranch = "main";
	rootDir = "/";
	autoDeploy = true;
	dockerImage = "";
	dockerTag = "latest";
}
</script>

<Dialog.Root
	bind:open
	onOpenChange={(v) => {
		if (!v) reset();
		onOpenChange?.(v);
	}}
>
	<Dialog.Content class="sm:max-w-lg">
		{#if step === "name"}
			<Dialog.Header>
				<Dialog.Title>Create New Project</Dialog.Title>
				<Dialog.Description>Give your project a name to get started.</Dialog.Description>
			</Dialog.Header>
			<div class="space-y-4 py-4">
				{#if error}
					<Alert.Root variant="destructive">
						<Alert.Description>{error}</Alert.Description>
					</Alert.Root>
				{/if}
				<div class="space-y-2">
					<Label for="project-name">Project name</Label>
					<Input id="project-name" bind:value={name} placeholder="my-app" autofocus />
				</div>
				<div class="space-y-2">
					<Label for="project-description">
						Description <span class="text-muted-foreground">(optional)</span>
					</Label>
					<Textarea
						id="project-description"
						bind:value={description}
						placeholder="A short description of your project"
						rows={2}
					/>
				</div>
			</div>
			<Dialog.Footer>
				<Dialog.Close>
					<Button variant="outline">Cancel</Button>
				</Dialog.Close>
				<Button onclick={handleNext}>Next</Button>
			</Dialog.Footer>
		{:else if step === "type"}
			<Dialog.Header>
				<Dialog.Title>Add a Service</Dialog.Title>
				<Dialog.Description>
					Choose how to deploy your first service, or skip for now.
				</Dialog.Description>
			</Dialog.Header>
			<div class="grid grid-cols-2 gap-3 py-4">
				{#each serviceTypes as type}
					<button
						type="button"
						onclick={() => handleServiceSelect(type.id)}
						disabled={loading}
						class="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-sm transition-colors hover:border-primary/50 hover:bg-muted disabled:opacity-50"
					>
						<type.icon class="size-6 text-muted-foreground" />
						<span>{type.label}</span>
					</button>
				{/each}
			</div>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (step = "name")}>Back</Button>
				<Button variant="ghost" onclick={createEmptyProject} disabled={loading}>
					{loading ? "Creating..." : "Skip"}
				</Button>
			</Dialog.Footer>
		{:else if step === "github"}
			<Dialog.Header>
				<Dialog.Title>Connect Repository</Dialog.Title>
				<Dialog.Description>Select a repository to deploy.</Dialog.Description>
			</Dialog.Header>
			<div class="space-y-4 py-4">
				{#if error}
					<Alert.Root variant="destructive">
						<Alert.Description>{error}</Alert.Description>
					</Alert.Root>
				{/if}

				<RepoSelector
					{repos}
					loading={reposLoading}
					selected={selectedRepo?.full_name ?? null}
					onSelect={handleRepoSelect}
				/>

				{#if selectedRepo}
					<div class="space-y-4 rounded-md border border-border p-3">
						<div class="space-y-2">
							<Label>Branch</Label>
							<BranchSelector
								{branches}
								bind:value={selectedBranch}
								loading={branchesLoading}
							/>
						</div>
						<div class="space-y-2">
							<Label for="root-dir">Root directory</Label>
							<Input id="root-dir" bind:value={rootDir} placeholder="/" />
						</div>
						<div class="flex items-center gap-2">
							<Checkbox id="auto-deploy" bind:checked={autoDeploy} />
							<Label for="auto-deploy" class="text-sm font-normal">
								Auto-deploy on push
							</Label>
						</div>
					</div>
				{/if}
			</div>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (step = "type")}>Back</Button>
				<Button onclick={createProjectWithService} disabled={loading || !selectedRepo}>
					{loading ? "Creating..." : "Deploy"}
				</Button>
			</Dialog.Footer>
		{:else if step === "docker"}
			<Dialog.Header>
				<Dialog.Title>Docker Image</Dialog.Title>
				<Dialog.Description>Deploy a container from a Docker image.</Dialog.Description>
			</Dialog.Header>
			<div class="space-y-4 py-4">
				{#if error}
					<Alert.Root variant="destructive">
						<Alert.Description>{error}</Alert.Description>
					</Alert.Root>
				{/if}
				<div class="space-y-2">
					<Label for="docker-image">Image name</Label>
					<Input
						id="docker-image"
						bind:value={dockerImage}
						placeholder="nginx, postgres:16, ghcr.io/user/app"
						autofocus
					/>
				</div>
				<div class="space-y-2">
					<Label for="docker-tag">Tag</Label>
					<Input id="docker-tag" bind:value={dockerTag} placeholder="latest" />
				</div>
			</div>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (step = "type")}>Back</Button>
				<Button onclick={createProjectWithDocker} disabled={loading || !dockerImage.trim()}>
					{loading ? "Creating..." : "Deploy"}
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
