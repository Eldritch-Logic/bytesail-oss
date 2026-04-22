<script lang="ts">
import type { services } from "@bytesail/db/schema";
import {
	Container,
	Database,
	ExternalLink,
	GitBranch,
	Globe,
	Play,
	RotateCcw,
	Server,
	Trash2,
	X,
} from "@lucide/svelte";
import type { InferSelectModel } from "drizzle-orm";
import { invalidateAll } from "$app/navigation";
import DeployTimeline from "$lib/components/deployments/DeployTimeline.svelte";
import type { LogEntry } from "$lib/components/monitoring/LogViewer.svelte";
import LogViewer from "$lib/components/monitoring/LogViewer.svelte";
import StatusDot from "$lib/components/shared/StatusDot.svelte";
import TimeAgo from "$lib/components/shared/TimeAgo.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import VariableEditor from "$lib/components/variables/VariableEditor.svelte";
import { trpc } from "$lib/trpc.js";

type Service = InferSelectModel<typeof services>;

type Props = {
	service: Service | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
};

let { service, open = $bindable(), onOpenChange, projectId }: Props = $props();

let activeTab = $state("deployments");
let deploying = $state(false);

type Deployment = {
	id: string;
	version: number;
	status: string;
	trigger: string;
	commitHash: string | null;
	commitMessage: string | null;
	commitAuthor: string | null;
	branch: string | null;
	buildDuration: number | null;
	deployDuration: number | null;
	errorMessage: string | null;
	createdAt: Date | string;
};

type Variable = {
	id: string;
	key: string;
	value: string;
	isSecret: boolean | null;
};

type Domain = {
	id: string;
	hostname: string;
	port: number;
	tlsEnabled: boolean | null;
	isGenerated: boolean | null;
};

let deploymentsList = $state<Deployment[]>([]);
let variablesList = $state<Variable[]>([]);
let domainsList = $state<Domain[]>([]);
let logEntries = $state<LogEntry[]>([]);
let logsLoading = $state(false);
let loading = $state(false);

let showAddDomain = $state(false);
let newHostname = $state("");
let newTls = $state(true);
let addingDomain = $state(false);

const typeIcons: Record<string, typeof Server> = {
	app: Server,
	database: Database,
	redis: Database,
	worker: Container,
	cron: Container,
};

const TypeIcon = $derived(service ? (typeIcons[service.type] ?? Server) : Server);

$effect(() => {
	if (service && open) {
		loadServiceData(service.id);
		activeTab = "deployments";
		logEntries = [];
	}
});

$effect(() => {
	if (activeTab === "logs" && service) {
		loadLogs(service.id);
	}
});

async function loadLogs(serviceId: string) {
	logsLoading = true;
	try {
		const result = await trpc.monitoring.getLogs.query({
			serviceId,
			limit: 500,
			direction: "backward",
		});
		logEntries = result.reverse();
	} catch (e) {
		console.error("Failed to load logs:", e);
	} finally {
		logsLoading = false;
	}
}

async function loadServiceData(serviceId: string) {
	loading = true;
	try {
		const [deps, vars, doms] = await Promise.all([
			trpc.deployment.list.query({ serviceId }),
			trpc.variable.list.query({ serviceId }).catch(() => []),
			trpc.domain.list.query({ serviceId }).catch(() => []),
		]);
		deploymentsList = deps as Deployment[];
		variablesList = vars as Variable[];
		domainsList = doms as Domain[];
	} catch (e) {
		console.error("Failed to load service data:", e);
	} finally {
		loading = false;
	}
}

async function handleDeploy() {
	if (!service) return;
	deploying = true;
	try {
		await trpc.deployment.deploy.mutate({ serviceId: service.id });
		invalidateAll();
	} catch (e) {
		console.error("Deploy failed:", e);
	} finally {
		deploying = false;
	}
}

async function handleRestart() {
	if (!service) return;
	try {
		await trpc.service.restart.mutate({ id: service.id });
		invalidateAll();
	} catch (e) {
		console.error("Restart failed:", e);
	}
}

async function handleAddDomain() {
	if (!service || !newHostname.trim()) return;
	addingDomain = true;
	try {
		// Get default environment
		const envs = await trpc.environment.list.query({ projectId: service.projectId });
		const defaultEnv = envs.find((e: { isDefault: boolean | null }) => e.isDefault);
		if (!defaultEnv) {
			console.error("No default environment found");
			return;
		}
		await trpc.domain.add.mutate({
			serviceId: service.id,
			environmentId: defaultEnv.id,
			hostname: newHostname.trim(),
			port: service.port ?? 3000,
			tlsEnabled: newTls,
		});
		newHostname = "";
		newTls = true;
		showAddDomain = false;
		await loadServiceData(service.id);
	} catch (e) {
		console.error("Failed to add domain:", e);
	} finally {
		addingDomain = false;
	}
}

async function handleDeleteDomain(id: string) {
	try {
		await trpc.domain.remove.mutate({ id });
		if (service) await loadServiceData(service.id);
	} catch (e) {
		console.error("Failed to delete domain:", e);
	}
}

function close() {
	open = false;
	onOpenChange(false);
}

const tabs = [
	{ id: "deployments", label: "Deployments" },
	{ id: "logs", label: "Logs" },
	{ id: "variables", label: "Variables" },
	{ id: "networking", label: "Networking" },
	{ id: "settings", label: "Settings" },
] as const;
</script>

{#if open && service}
	<div class="fixed inset-y-0 right-0 z-40 flex w-full max-w-2xl flex-col border-l border-border bg-background shadow-2xl">
		<!-- Header -->
		<div class="flex-shrink-0 border-b border-border px-6 pb-0 pt-6">
			<div class="flex items-start justify-between">
				<div class="flex items-center gap-3">
					<div class="flex size-10 items-center justify-center rounded-lg border border-border bg-card">
						<TypeIcon class="size-5 text-muted-foreground" />
					</div>
					<div>
						<h2 class="text-lg font-semibold">{service.name}</h2>
						<div class="flex items-center gap-2 text-sm text-muted-foreground">
							<StatusDot status={service.status ?? "stopped"} />
							<span class="capitalize">{service.status ?? "stopped"}</span>
							{#if service.dockerImage}
								<span class="text-xs">&middot; {service.dockerImage}:{service.dockerTag ?? "latest"}</span>
							{:else if service.repoOwner}
								<span class="text-xs">&middot; {service.repoOwner}/{service.repoName}</span>
							{/if}
						</div>
					</div>
				</div>

				<div class="flex items-center gap-1.5">
					<Button size="sm" variant="ghost" onclick={handleDeploy} disabled={deploying}>
						<Play class="size-3.5" />
					</Button>
					{#if service.status === "running"}
						<Button size="sm" variant="ghost" onclick={handleRestart}>
							<RotateCcw class="size-3.5" />
						</Button>
					{/if}
					<a
						href="/projects/{projectId}/services/{service.id}"
						class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
					>
						<ExternalLink class="size-3.5" />
					</a>
					<button
						type="button"
						onclick={close}
						class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
					>
						<X class="size-4" />
					</button>
				</div>
			</div>

			<!-- Tabs -->
			<nav class="mt-4 flex gap-6">
				{#each tabs as tab}
					<button
						type="button"
						onclick={() => (activeTab = tab.id)}
						class="relative pb-3 text-sm transition-colors {activeTab === tab.id
							? 'text-foreground font-medium'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						{tab.label}
						{#if activeTab === tab.id}
							<div class="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-foreground"></div>
						{/if}
					</button>
				{/each}
			</nav>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto">
			{#if activeTab === "deployments"}
				<div class="p-6">
					{#if loading}
						<p class="text-sm text-muted-foreground">Loading deployments...</p>
					{:else}
						<DeployTimeline
						deployments={deploymentsList}
						onViewLogs={() => {
							if (service) window.location.href = `/projects/${projectId}/services/${service.id}/logs`;
						}}
					/>
					{/if}
				</div>
			{:else if activeTab === "logs"}
				<div class="flex flex-1 flex-col">
					{#if logsLoading}
						<div class="flex items-center justify-center p-8 text-sm text-muted-foreground">Loading logs...</div>
					{:else if logEntries.length === 0}
						<div class="flex items-center justify-center p-8 text-sm text-muted-foreground">No logs yet</div>
					{:else}
						<LogViewer logs={logEntries} class="flex-1" />
					{/if}
				</div>
			{:else if activeTab === "variables"}
				<div class="p-6">
					{#if loading}
						<p class="text-sm text-muted-foreground">Loading variables...</p>
					{:else}
						<VariableEditor variables={variablesList} />
					{/if}
				</div>
			{:else if activeTab === "networking"}
				<div class="p-6 space-y-4">
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-medium">Domains</h3>
						<Button size="sm" variant="outline" onclick={() => (showAddDomain = !showAddDomain)}>
							Add Domain
						</Button>
					</div>

					{#if showAddDomain}
						<div class="rounded-lg border border-border p-4 space-y-3">
							<div class="space-y-1.5">
								<label for="domain-host" class="text-xs font-medium">Hostname</label>
								<input
									id="domain-host"
									type="text"
									bind:value={newHostname}
									placeholder="app.example.com"
									class="flex h-8 w-full rounded-md border border-input bg-background px-3 font-mono text-sm"
								/>
							</div>
							<div class="flex items-center gap-2">
								<input id="domain-tls" type="checkbox" bind:checked={newTls} class="size-4 rounded border-input" />
								<label for="domain-tls" class="text-xs">Enable TLS (auto via Let's Encrypt)</label>
							</div>
							<div class="flex gap-2">
								<Button size="sm" onclick={handleAddDomain} disabled={addingDomain || !newHostname.trim()}>
									{addingDomain ? "Adding..." : "Add"}
								</Button>
								<Button size="sm" variant="ghost" onclick={() => (showAddDomain = false)}>Cancel</Button>
							</div>
						</div>
					{/if}

					{#if loading}
						<p class="text-sm text-muted-foreground">Loading...</p>
					{:else if domainsList.length === 0 && !showAddDomain}
						<div class="rounded-lg border border-dashed border-border p-6 text-center">
							<Globe class="mx-auto size-8 text-muted-foreground/50" />
							<p class="mt-2 text-sm text-muted-foreground">No domains configured</p>
							<p class="text-xs text-muted-foreground/70">Add a custom domain to expose this service.</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each domainsList as domain}
								<div class="flex items-center justify-between rounded-lg border border-border p-3">
									<div class="flex items-center gap-2.5">
										<Globe class="size-4 text-muted-foreground" />
										<span class="font-mono text-sm">{domain.hostname}</span>
										{#if domain.isGenerated}
											<Badge variant="outline" class="text-2xs">Generated</Badge>
										{/if}
										{#if domain.tlsEnabled}
											<Badge variant="outline" class="text-2xs text-status-running border-status-running">TLS</Badge>
										{/if}
									</div>
									<div class="flex items-center gap-3 text-xs text-muted-foreground">
										<span>Port {domain.port}</span>
										<button type="button" onclick={() => handleDeleteDomain(domain.id)} class="p-1 hover:text-destructive">
											<Trash2 class="size-3.5" />
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else if activeTab === "settings"}
				<div class="p-6 space-y-6">
					<!-- Source -->
					<section>
						<h3 class="mb-3 text-sm font-medium">Source</h3>
						<div class="space-y-3">
							{#if service.repoOwner && service.repoName}
								<div class="flex items-center justify-between text-sm">
									<span class="text-muted-foreground">Repository</span>
									<span class="flex items-center gap-1.5 font-mono text-xs">
										<GitBranch class="size-3.5" />
										{service.repoOwner}/{service.repoName}
									</span>
								</div>
								{#if service.repoBranch}
									<div class="flex items-center justify-between text-sm">
										<span class="text-muted-foreground">Branch</span>
										<span class="font-mono text-xs">{service.repoBranch}</span>
									</div>
								{/if}
							{:else if service.dockerImage}
								<div class="flex items-center justify-between text-sm">
									<span class="text-muted-foreground">Image</span>
									<span class="font-mono text-xs">{service.dockerImage}:{service.dockerTag ?? "latest"}</span>
								</div>
							{/if}
							<div class="flex items-center justify-between text-sm">
								<span class="text-muted-foreground">Source type</span>
								<span class="capitalize text-xs">{service.sourceType}</span>
							</div>
							<div class="flex items-center justify-between text-sm">
								<span class="text-muted-foreground">Auto-deploy</span>
								<span class="text-xs">{service.autoDeploy ? "Enabled" : "Disabled"}</span>
							</div>
						</div>
					</section>

					<div class="border-t border-border"></div>

					<!-- Build -->
					<section>
						<h3 class="mb-3 text-sm font-medium">Build</h3>
						<div class="space-y-3">
							<div class="flex items-center justify-between text-sm">
								<span class="text-muted-foreground">Build type</span>
								<span class="text-xs">{service.buildType ?? "railpacks"}</span>
							</div>
							{#if service.buildType === "dockerfile" && service.dockerfilePath}
								<div class="flex items-center justify-between text-sm">
									<span class="text-muted-foreground">Dockerfile</span>
									<span class="font-mono text-xs">{service.dockerfilePath}</span>
								</div>
							{/if}
						</div>
					</section>

					<div class="border-t border-border"></div>

					<!-- Runtime -->
					<section>
						<h3 class="mb-3 text-sm font-medium">Runtime</h3>
						<div class="space-y-3">
							<div class="flex items-center justify-between text-sm">
								<span class="text-muted-foreground">Replicas</span>
								<span class="text-xs">{service.replicas ?? 1}</span>
							</div>
							<div class="flex items-center justify-between text-sm">
								<span class="text-muted-foreground">Restart policy</span>
								<span class="capitalize text-xs">{service.restartPolicy ?? "always"}</span>
							</div>
							{#if service.cpuLimit}
								<div class="flex items-center justify-between text-sm">
									<span class="text-muted-foreground">CPU limit</span>
									<span class="text-xs">{service.cpuLimit}</span>
								</div>
							{/if}
							{#if service.memoryLimit}
								<div class="flex items-center justify-between text-sm">
									<span class="text-muted-foreground">Memory limit</span>
									<span class="text-xs">{service.memoryLimit}</span>
								</div>
							{/if}
							{#if service.command}
								<div class="flex items-center justify-between text-sm">
									<span class="text-muted-foreground">Command</span>
									<span class="font-mono text-xs">{service.command}</span>
								</div>
							{/if}
						</div>
					</section>

					<div class="border-t border-border"></div>

					<!-- Health Check -->
					<section>
						<h3 class="mb-3 text-sm font-medium">Health Check</h3>
						<div class="space-y-3">
							<div class="flex items-center justify-between text-sm">
								<span class="text-muted-foreground">Path</span>
								<span class="font-mono text-xs">{service.healthCheckPath ?? "—"}</span>
							</div>
							<div class="flex items-center justify-between text-sm">
								<span class="text-muted-foreground">Port</span>
								<span class="text-xs">{service.healthCheckPort ?? "—"}</span>
							</div>
							<div class="flex items-center justify-between text-sm">
								<span class="text-muted-foreground">Interval</span>
								<span class="text-xs">{service.healthCheckInterval ?? 30}s</span>
							</div>
						</div>
					</section>

					<div class="border-t border-border"></div>

					<!-- Metadata -->
					<section>
						<div class="space-y-3">
							<div class="flex items-center justify-between text-sm">
								<span class="text-muted-foreground">Created</span>
								<TimeAgo date={service.createdAt} class="text-xs" />
							</div>
							<div class="flex items-center justify-between text-sm">
								<span class="text-muted-foreground">Updated</span>
								<TimeAgo date={service.updatedAt} class="text-xs" />
							</div>
						</div>
					</section>
				</div>
			{/if}
		</div>
	</div>
{/if}
