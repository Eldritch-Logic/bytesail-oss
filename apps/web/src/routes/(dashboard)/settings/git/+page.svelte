<script lang="ts">
import { CheckCircle, ExternalLink, GitBranch, Trash2 } from "@lucide/svelte";
import EmptyState from "$lib/components/shared/EmptyState.svelte";
import GithubIcon from "$lib/components/shared/GithubIcon.svelte";
import TimeAgo from "$lib/components/shared/TimeAgo.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";

let { data } = $props();
let confirmDisconnect = $state<string | null>(null);

function createGitHubApp() {
	const baseUrl = window.location.origin;
	const isLocalhost = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");
	const webhookUrl = isLocalhost
		? "https://example.com/webhook-placeholder"
		: `${baseUrl}/api/v1/webhooks/github`;

	const manifest = {
		name: `ByteSail-${crypto.randomUUID().slice(0, 8)}`,
		url: baseUrl,
		hook_attributes: {
			url: webhookUrl,
			active: !isLocalhost,
		},
		redirect_url: `${baseUrl}/api/github/setup`,
		callback_urls: [`${baseUrl}/api/github/callback`],
		setup_url: `${baseUrl}/api/github/callback`,
		public: false,
		default_permissions: {
			contents: "read",
			metadata: "read",
			statuses: "write",
			deployments: "write",
			pull_requests: "read",
		},
		default_events: ["push", "pull_request"],
	};

	const form = document.createElement("form");
	form.method = "POST";
	form.action = "https://github.com/settings/apps/new?state=bytesail";
	const input = document.createElement("input");
	input.type = "hidden";
	input.name = "manifest";
	input.value = JSON.stringify(manifest);
	form.appendChild(input);
	document.body.appendChild(form);
	form.submit();
}

function installGitHubApp() {
	if (data.githubApp?.appSlug) {
		window.location.href = `https://github.com/apps/${data.githubApp.appSlug}/installations/new`;
	}
}
</script>

<div class="space-y-6">
	<Card.Root>
		<Card.Header>
			<Card.Title>GitHub App</Card.Title>
			<Card.Description>
				ByteSail uses a GitHub App for repository access and webhooks.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if data.githubApp}
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<GithubIcon class="size-6" />
						<div>
							<div class="flex items-center gap-2">
								<p class="text-sm font-medium">{data.githubApp.appName}</p>
								<Badge variant="outline" class="text-status-running border-status-running">
									<CheckCircle class="mr-1 size-3" /> Connected
								</Badge>
							</div>
							<p class="text-xs text-muted-foreground">
								App ID: {data.githubApp.appId}
								{#if data.githubApp.owner}
									&middot; Owner: {data.githubApp.owner}
								{/if}
							</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<Button variant="outline" size="sm" onclick={installGitHubApp}>
							Install on Account
						</Button>
						{#if data.githubApp.htmlUrl}
							<a
								href={data.githubApp.htmlUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
							>
								<ExternalLink class="size-3.5" />
							</a>
						{/if}
					</div>
				</div>
			{:else}
				<div class="flex flex-col items-center gap-4 py-8 text-center">
					<GithubIcon class="size-10 text-muted-foreground" />
					<div class="space-y-1">
						<p class="text-sm font-medium">No GitHub App configured</p>
						<p class="max-w-sm text-xs text-muted-foreground">
							Create a GitHub App to enable repository access, push-to-deploy,
							and PR preview environments. This takes about 10 seconds.
						</p>
					</div>
					<Button onclick={createGitHubApp}>
						<GithubIcon class="mr-2 size-4" />
						Create GitHub App
					</Button>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	{#if data.githubApp}
		<Separator />

		<Card.Root>
			<Card.Header>
				<div class="flex items-center justify-between">
					<div>
						<Card.Title>Installations</Card.Title>
						<Card.Description>
							Accounts and organizations where the GitHub App is installed.
						</Card.Description>
					</div>
					<Button variant="outline" size="sm" onclick={installGitHubApp}>
						Add Installation
					</Button>
				</div>
			</Card.Header>
			<Card.Content>
				{#if !data.providers || data.providers.length === 0}
					<EmptyState
						icon={GitBranch}
						title="No installations yet"
						description="Install the GitHub App on your account or organization to access repositories."
					>
						{#snippet action()}
							<Button onclick={installGitHubApp}>
								Install on Account
							</Button>
						{/snippet}
					</EmptyState>
				{:else}
					<div class="space-y-3">
						{#each data.providers as provider}
							<div class="flex items-center justify-between rounded-lg border border-border p-4">
								<div class="flex items-center gap-3">
									<GithubIcon class="size-5" />
									<div>
										<p class="text-sm font-medium">
											{provider.providerUsername ?? "GitHub"}
										</p>
										<p class="text-xs text-muted-foreground">
											Installation ID: {provider.githubInstallationId ?? "—"}
											&middot; Connected <TimeAgo date={provider.createdAt} />
										</p>
									</div>
								</div>
								<Button
									variant="ghost"
									size="sm"
									onclick={() => (confirmDisconnect = provider.id)}
								>
									<Trash2 class="size-4 text-destructive" />
								</Button>
							</div>
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
		<Separator />

		<Card.Root>
			<Card.Header>
				<Card.Title>Recent Webhook Events</Card.Title>
				<Card.Description>Deployments triggered by git push and PR events.</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if !data.webhookEvents || data.webhookEvents.length === 0}
					<p class="text-sm text-muted-foreground">No webhook-triggered deployments yet.</p>
				{:else}
					<div class="space-y-2">
						{#each data.webhookEvents as event}
							<div class="flex items-center justify-between rounded-md border border-border p-3 text-sm">
								<div class="flex items-center gap-3">
									<div class="size-2 rounded-full {event.status === 'running' ? 'bg-status-running' : event.status === 'failed' ? 'bg-status-failed' : 'bg-status-building'}"></div>
									<span class="font-medium">v{event.version}</span>
									<Badge variant="outline" class="text-2xs capitalize">{event.trigger.replace("_", " ")}</Badge>
									{#if event.commitHash}
										<code class="font-mono text-xs text-muted-foreground">{event.commitHash.slice(0, 7)}</code>
									{/if}
								</div>
								<TimeAgo date={event.createdAt} class="text-xs text-muted-foreground" />
							</div>
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
</div>

<Dialog.Root
	open={!!confirmDisconnect}
	onOpenChange={(v) => { if (!v) confirmDisconnect = null; }}
>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Remove Installation</Dialog.Title>
			<Dialog.Description>
				This will remove the installation from ByteSail. Auto-deploy will stop working
				for repositories under this installation.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Dialog.Close>
				<Button variant="outline">Cancel</Button>
			</Dialog.Close>
			<Button variant="destructive" onclick={() => { confirmDisconnect = null; }}>
				Remove
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
