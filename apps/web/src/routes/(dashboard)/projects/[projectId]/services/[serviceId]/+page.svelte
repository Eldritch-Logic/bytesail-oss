<script lang="ts">
import {
	ArrowLeft,
	GitBranch,
	Globe,
	MoreVertical,
	Play,
	RefreshCw,
	Scaling,
	Server,
	Trash2,
} from "@lucide/svelte";
import { onDestroy } from "svelte";
import { invalidateAll } from "$app/navigation";
import DeployTimeline from "$lib/components/deployments/DeployTimeline.svelte";
import GithubIcon from "$lib/components/shared/GithubIcon.svelte";
import StatusDot from "$lib/components/shared/StatusDot.svelte";
import TimeAgo from "$lib/components/shared/TimeAgo.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
import * as Tabs from "$lib/components/ui/tabs/index.js";
import VariableEditor from "$lib/components/variables/VariableEditor.svelte";
import { trpc } from "$lib/trpc.js";

let { data } = $props();

let deploying = $state(false);
let activeTab = $state("overview");
let showAddDomain = $state(false);
let newDomainHostname = $state("");
let newDomainPort = $state(3000);
let newDomainTls = $state(true);

async function handleAddDomain() {
	try {
		await trpc.domain.add.mutate({
			serviceId: data.service.id,
			environmentId: data.defaultEnvironmentId ?? "",
			hostname: newDomainHostname,
			port: newDomainPort,
			tlsEnabled: newDomainTls,
		});
		showAddDomain = false;
		newDomainHostname = "";
		invalidateAll();
	} catch (e) {
		console.error("Failed to add domain:", e);
	}
}

async function handleDeleteDomain(id: string) {
	try {
		await trpc.domain.remove.mutate({ id });
		invalidateAll();
	} catch (e) {
		console.error("Failed to delete domain:", e);
	}
}

async function handleDeploy() {
	deploying = true;
	try {
		await trpc.deployment.deploy.mutate({ serviceId: data.service.id });
		invalidateAll();
	} catch (e) {
		console.error("Deploy failed:", e);
	} finally {
		deploying = false;
	}
}

async function handleRestart() {
	try {
		await trpc.service.restart.mutate({ id: data.service.id });
		invalidateAll();
	} catch (e) {
		console.error("Restart failed:", e);
	}
}

// Poll while building/deploying
const interval = setInterval(() => {
	const s = data.service.status;
	if (s === "building" || s === "deploying" || s === "queued") {
		invalidateAll();
	}
}, 5_000);

onDestroy(() => clearInterval(interval));
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<a
				href="/projects/{data.service.projectId}"
				class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			>
				<ArrowLeft class="size-5" />
			</a>
			<div class="flex items-center gap-3">
				<StatusDot status={data.service.status ?? "stopped"} />
				<h1 class="text-2xl font-semibold">{data.service.name}</h1>
				<Badge variant="outline" class="text-xs">{data.service.type}</Badge>
			</div>
		</div>

		<div class="flex items-center gap-2">
			<Button onclick={handleDeploy} disabled={deploying}>
				<Play class="mr-2 size-4" />
				{deploying ? "Deploying..." : "Deploy"}
			</Button>

			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					<Button variant="outline" size="icon">
						<MoreVertical class="size-4" />
					</Button>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end">
					<DropdownMenu.Item onclick={handleRestart}>
						<RefreshCw class="mr-2 size-4" />
						Restart
					</DropdownMenu.Item>
					<DropdownMenu.Item>
						<Scaling class="mr-2 size-4" />
						Scale
					</DropdownMenu.Item>
					<DropdownMenu.Separator />
					<DropdownMenu.Item class="text-destructive">
						<Trash2 class="mr-2 size-4" />
						Delete
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</div>

	<Tabs.Root bind:value={activeTab}>
		<Tabs.List>
			<Tabs.Trigger value="overview">Overview</Tabs.Trigger>
			<Tabs.Trigger value="deployments">Deployments</Tabs.Trigger>
			<Tabs.Trigger value="logs">Logs</Tabs.Trigger>
			<Tabs.Trigger value="variables">Variables</Tabs.Trigger>
			<Tabs.Trigger value="networking">Networking</Tabs.Trigger>
			<Tabs.Trigger value="settings">Settings</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="overview">
			<div class="mt-4 grid gap-4 sm:grid-cols-2">
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-sm">Runtime</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-2 text-sm">
						<div class="flex justify-between">
							<span class="text-muted-foreground">Status</span>
							<span class="capitalize">{data.service.status ?? "stopped"}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-muted-foreground">Replicas</span>
							<span>{data.service.replicas ?? 1}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-muted-foreground">Build Type</span>
							<span>{data.service.buildType ?? "railpacks"}</span>
						</div>
						{#if data.service.cpuLimit}
							<div class="flex justify-between">
								<span class="text-muted-foreground">CPU Limit</span>
								<span>{data.service.cpuLimit}</span>
							</div>
						{/if}
						{#if data.service.memoryLimit}
							<div class="flex justify-between">
								<span class="text-muted-foreground">Memory Limit</span>
								<span>{data.service.memoryLimit}</span>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<Card.Title class="text-sm">Source</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-2 text-sm">
						{#if data.service.repoOwner && data.service.repoName}
							<div class="flex items-center justify-between">
								<span class="text-muted-foreground">Repository</span>
								<span class="flex items-center gap-1.5">
									<GithubIcon class="size-3.5" />
									{data.service.repoOwner}/{data.service.repoName}
								</span>
							</div>
						{/if}
						{#if data.service.repoBranch}
							<div class="flex items-center justify-between">
								<span class="text-muted-foreground">Branch</span>
								<span class="flex items-center gap-1.5">
									<GitBranch class="size-3.5" />
									{data.service.repoBranch}
								</span>
							</div>
						{/if}
						<div class="flex justify-between">
							<span class="text-muted-foreground">Auto-deploy</span>
							<span>{data.service.autoDeploy ? "Enabled" : "Disabled"}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-muted-foreground">Source Type</span>
							<span class="capitalize">{data.service.sourceType}</span>
						</div>
					</Card.Content>
				</Card.Root>
			</div>

			{#if data.deployments.length > 0}
				<Card.Root class="mt-4">
					<Card.Header>
						<Card.Title class="text-sm">Recent Deployments</Card.Title>
					</Card.Header>
					<Card.Content>
						<div class="space-y-2">
							{#each data.deployments.slice(0, 5) as dep}
								<div class="flex items-center justify-between rounded-md border border-border p-3 text-sm">
									<div class="flex items-center gap-3">
										<StatusDot status={dep.status === "running" ? "running" : dep.status === "failed" ? "failed" : dep.status === "building" ? "building" : "stopped"} />
										<span class="font-medium">v{dep.version}</span>
										{#if dep.commitHash}
											<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{dep.commitHash.slice(0, 7)}</code>
										{/if}
										{#if dep.commitMessage}
											<span class="truncate text-muted-foreground">{dep.commitMessage}</span>
										{/if}
									</div>
									<div class="flex items-center gap-2 text-xs text-muted-foreground">
										<span class="capitalize">{dep.trigger}</span>
										<TimeAgo date={dep.createdAt} />
									</div>
								</div>
							{/each}
						</div>
					</Card.Content>
				</Card.Root>
			{/if}
		</Tabs.Content>

		<Tabs.Content value="deployments">
			<div class="mt-4">
				<DeployTimeline deployments={data.deployments} />
			</div>
		</Tabs.Content>

		<Tabs.Content value="logs">
			<div class="mt-4 text-sm text-muted-foreground">
				Live logs coming soon.
			</div>
		</Tabs.Content>

		<Tabs.Content value="variables">
			<div class="mt-4">
				<VariableEditor variables={data.variables ?? []} />
			</div>
		</Tabs.Content>

		<Tabs.Content value="networking">
			<div class="mt-4 space-y-6">
				<Card.Root>
					<Card.Header>
						<div class="flex items-center justify-between">
							<div>
								<Card.Title class="text-sm">Domains</Card.Title>
								<Card.Description>Custom domains and generated subdomains for this service.</Card.Description>
							</div>
							<Button variant="outline" size="sm" onclick={() => (showAddDomain = true)}>
								Add Domain
							</Button>
						</div>
					</Card.Header>
					<Card.Content>
						{#if !data.domains || data.domains.length === 0}
							<div class="flex flex-col items-center gap-3 py-8 text-center">
								<Globe class="size-10 text-muted-foreground/50" />
								<p class="text-sm font-medium">No domains</p>
								<p class="text-xs text-muted-foreground">Add a custom domain or generate a subdomain to expose this service.</p>
								<Button variant="outline" size="sm" onclick={() => (showAddDomain = true)}>Add Domain</Button>
							</div>
						{:else}
							<div class="space-y-2">
								{#each data.domains as domain}
									<div class="flex items-center justify-between rounded-md border border-border p-3 text-sm">
										<div class="flex items-center gap-3">
											<span class="font-mono">{domain.hostname}</span>
											{#if domain.isGenerated}
												<Badge variant="outline" class="text-2xs">Generated</Badge>
											{/if}
											{#if domain.tlsEnabled}
												<Badge variant="outline" class="text-2xs text-status-running border-status-running">TLS</Badge>
											{/if}
										</div>
										<div class="flex items-center gap-2 text-xs text-muted-foreground">
											<span>Port {domain.port}</span>
											<button type="button" onclick={() => handleDeleteDomain(domain.id)} class="p-1 text-muted-foreground hover:text-destructive">
												<Trash2 class="size-3.5" />
											</button>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</div>

			<Dialog.Root bind:open={showAddDomain}>
				<Dialog.Content class="sm:max-w-sm">
					<Dialog.Header>
						<Dialog.Title>Add Domain</Dialog.Title>
						<Dialog.Description>
							Point a CNAME record for your domain to your ByteSail instance.
						</Dialog.Description>
					</Dialog.Header>
					<div class="space-y-4 py-4">
						<div class="space-y-2">
							<label for="domain-hostname" class="text-sm font-medium">Hostname</label>
							<input id="domain-hostname" type="text" bind:value={newDomainHostname} placeholder="app.example.com" class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
						</div>
						<div class="space-y-2">
							<label for="domain-port" class="text-sm font-medium">Port</label>
							<input id="domain-port" type="number" bind:value={newDomainPort} class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
						</div>
						<div class="flex items-center gap-2">
							<input id="domain-tls" type="checkbox" bind:checked={newDomainTls} class="size-4 rounded border-input" />
							<label for="domain-tls" class="text-sm">Enable TLS (auto via Let's Encrypt)</label>
						</div>
					</div>
					<Dialog.Footer>
						<Dialog.Close>
							<Button variant="outline">Cancel</Button>
						</Dialog.Close>
						<Button onclick={handleAddDomain} disabled={!newDomainHostname.trim()}>
							Add Domain
						</Button>
					</Dialog.Footer>
				</Dialog.Content>
			</Dialog.Root>
		</Tabs.Content>

		<Tabs.Content value="settings">
			<div class="mt-4 space-y-6">
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-sm">General</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-4">
						<div class="space-y-2">
							<label for="svc-name" class="text-sm font-medium">Service name</label>
							<input id="svc-name" type="text" value={data.service.name} class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<Card.Title class="text-sm">Source</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-4">
						{#if data.service.repoOwner}
							<div class="space-y-2">
								<label class="text-sm font-medium">Repository</label>
								<p class="text-sm text-muted-foreground">{data.service.repoOwner}/{data.service.repoName}</p>
							</div>
						{/if}
						<div class="space-y-2">
							<label for="svc-branch" class="text-sm font-medium">Branch</label>
							<input id="svc-branch" type="text" value={data.service.repoBranch ?? "main"} class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
						</div>
						<div class="space-y-2">
							<label for="svc-subdir" class="text-sm font-medium">Root directory</label>
							<input id="svc-subdir" type="text" value={data.service.repoSubdirectory ?? "/"} class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
						</div>
						<div class="flex items-center gap-2">
							<input id="svc-autodeploy" type="checkbox" checked={data.service.autoDeploy ?? true} class="size-4 rounded border-input" />
							<label for="svc-autodeploy" class="text-sm">Auto-deploy on push</label>
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<Card.Title class="text-sm">Build</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-4">
						<div class="space-y-2">
							<label for="svc-buildtype" class="text-sm font-medium">Build type</label>
							<select id="svc-buildtype" class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
								<option value="railpacks" selected={data.service.buildType === "railpacks"}>Railpack (auto-detect)</option>
								<option value="dockerfile" selected={data.service.buildType === "dockerfile"}>Dockerfile</option>
							</select>
						</div>
						{#if data.service.buildType === "dockerfile"}
							<div class="space-y-2">
								<label for="svc-dockerfile" class="text-sm font-medium">Dockerfile path</label>
								<input id="svc-dockerfile" type="text" value={data.service.dockerfilePath ?? "Dockerfile"} class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
							</div>
						{/if}
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<Card.Title class="text-sm">Runtime</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-4">
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div class="space-y-2">
								<label for="svc-replicas" class="text-sm font-medium">Replicas</label>
								<input id="svc-replicas" type="number" min="0" max="10" value={data.service.replicas ?? 1} class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
							</div>
							<div class="space-y-2">
								<label for="svc-restart" class="text-sm font-medium">Restart policy</label>
								<select id="svc-restart" class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
									<option value="always" selected={data.service.restartPolicy === "always"}>Always</option>
									<option value="on-failure" selected={data.service.restartPolicy === "on-failure"}>On failure</option>
									<option value="never" selected={data.service.restartPolicy === "never"}>Never</option>
								</select>
							</div>
						</div>
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div class="space-y-2">
								<label for="svc-cpu" class="text-sm font-medium">CPU limit</label>
								<input id="svc-cpu" type="text" value={data.service.cpuLimit ?? ""} placeholder="e.g. 500m" class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
							</div>
							<div class="space-y-2">
								<label for="svc-mem" class="text-sm font-medium">Memory limit</label>
								<input id="svc-mem" type="text" value={data.service.memoryLimit ?? ""} placeholder="e.g. 512Mi" class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
							</div>
						</div>
						<div class="space-y-2">
							<label for="svc-cmd" class="text-sm font-medium">Command override</label>
							<input id="svc-cmd" type="text" value={data.service.command ?? ""} placeholder="Leave empty for default" class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<Card.Title class="text-sm">Health Check</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-4">
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
							<div class="space-y-2">
								<label for="svc-hc-path" class="text-sm font-medium">Path</label>
								<input id="svc-hc-path" type="text" value={data.service.healthCheckPath ?? ""} placeholder="/health" class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
							</div>
							<div class="space-y-2">
								<label for="svc-hc-port" class="text-sm font-medium">Port</label>
								<input id="svc-hc-port" type="number" value={data.service.healthCheckPort ?? ""} placeholder="3000" class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
							</div>
							<div class="space-y-2">
								<label for="svc-hc-interval" class="text-sm font-medium">Interval (s)</label>
								<input id="svc-hc-interval" type="number" value={data.service.healthCheckInterval ?? 30} class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
							</div>
						</div>
					</Card.Content>
				</Card.Root>

				<Card.Root class="border-destructive/50">
					<Card.Header>
						<Card.Title class="text-sm text-destructive">Danger Zone</Card.Title>
					</Card.Header>
					<Card.Content>
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-medium">Delete this service</p>
								<p class="text-xs text-muted-foreground">This action cannot be undone. All deployments and data will be lost.</p>
							</div>
							<Button variant="destructive" size="sm">Delete Service</Button>
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		</Tabs.Content>
	</Tabs.Root>
</div>
