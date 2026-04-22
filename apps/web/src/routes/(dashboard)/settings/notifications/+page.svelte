<script lang="ts">
import { Bell, Mail, MessageSquare, Plus, Send, TestTube, Trash2, Webhook } from "@lucide/svelte";
import GithubIcon from "$lib/components/shared/GithubIcon.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import { trpc } from "$lib/trpc.js";

type Channel = {
	id: string;
	name: string;
	type: string;
	config: Record<string, unknown>;
	events: string[] | null;
	enabled: boolean | null;
};

let { data } = $props();

let channels = $state<Channel[]>((data.channels ?? []) as Channel[]);
let loading = $state(false);
let showCreate = $state(false);
let testing = $state<string | null>(null);

// Create form
let newName = $state("");
let newType = $state<string>("");
let newWebhookUrl = $state("");
let newBotToken = $state("");
let newChatId = $state("");
let newSmtpHost = $state("");
let newSmtpPort = $state(587);
let newSmtpUser = $state("");
let newSmtpPassword = $state("");
let newSmtpFrom = $state("");
let newSmtpTo = $state("");
let newUrl = $state("");
let newSecret = $state("");
let newEvents = $state<string[]>([]);
let creating = $state(false);

const typeOptions = [
	{ id: "slack", name: "Slack", icon: MessageSquare, color: "#4A154B" },
	{ id: "discord", name: "Discord", icon: MessageSquare, color: "#5865F2" },
	{ id: "telegram", name: "Telegram", icon: Send, color: "#26A5E4" },
	{ id: "email", name: "Email", icon: Mail, color: "#EA4335" },
	{ id: "webhook", name: "Webhook", icon: Webhook, color: "#6b7280" },
] as const;

const eventOptions = [
	{ id: "deployment.started", label: "Deploy Started" },
	{ id: "deployment.succeeded", label: "Deploy Succeeded" },
	{ id: "deployment.failed", label: "Deploy Failed" },
	{ id: "service.crashed", label: "Service Crashed" },
	{ id: "service.restarted", label: "Service Restarted" },
	{ id: "cert.expiring", label: "Cert Expiring" },
	{ id: "backup.completed", label: "Backup Completed" },
	{ id: "backup.failed", label: "Backup Failed" },
] as const;

const typeIcon = (type: string) => typeOptions.find((t) => t.id === type) ?? typeOptions[4];

async function loadChannels() {
	loading = true;
	try {
		channels = (await trpc.notification.listChannels.query()) as Channel[];
	} catch (e) {
		console.error("Failed to load channels:", e);
	} finally {
		loading = false;
	}
}

function buildConfig() {
	switch (newType) {
		case "slack":
			return { type: "slack" as const, webhookUrl: newWebhookUrl };
		case "discord":
			return { type: "discord" as const, webhookUrl: newWebhookUrl };
		case "telegram":
			return { type: "telegram" as const, botToken: newBotToken, chatId: newChatId };
		case "email":
			return {
				type: "email" as const,
				host: newSmtpHost,
				port: newSmtpPort,
				user: newSmtpUser,
				password: newSmtpPassword,
				from: newSmtpFrom,
				to: newSmtpTo,
			};
		case "webhook":
			return {
				type: "webhook" as const,
				url: newUrl,
				secret: newSecret || undefined,
			};
		default:
			return null;
	}
}

async function handleCreate() {
	const config = buildConfig();
	if (!config || !newName.trim()) return;
	creating = true;
	try {
		await trpc.notification.createChannel.mutate({
			name: newName.trim(),
			config,
			events: newEvents.length > 0 ? newEvents : undefined,
		});
		resetForm();
		await loadChannels();
	} catch (e) {
		console.error("Failed to create channel:", e);
	} finally {
		creating = false;
	}
}

async function handleDelete(id: string) {
	try {
		await trpc.notification.deleteChannel.mutate({ id });
		await loadChannels();
	} catch (e) {
		console.error("Failed to delete channel:", e);
	}
}

async function handleToggle(id: string, enabled: boolean) {
	try {
		await trpc.notification.updateChannel.mutate({ id, enabled });
		await loadChannels();
	} catch (e) {
		console.error("Failed to toggle channel:", e);
	}
}

async function handleTest(id: string) {
	testing = id;
	try {
		await trpc.notification.testChannel.mutate({ id });
	} catch (e) {
		console.error("Test failed:", e);
	} finally {
		testing = null;
	}
}

function toggleEvent(eventId: string) {
	if (newEvents.includes(eventId)) {
		newEvents = newEvents.filter((e) => e !== eventId);
	} else {
		newEvents = [...newEvents, eventId];
	}
}

function resetForm() {
	showCreate = false;
	newName = "";
	newType = "";
	newWebhookUrl = "";
	newBotToken = "";
	newChatId = "";
	newSmtpHost = "";
	newSmtpPort = 587;
	newSmtpUser = "";
	newSmtpPassword = "";
	newSmtpFrom = "";
	newSmtpTo = "";
	newUrl = "";
	newSecret = "";
	newEvents = [];
}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold">Notifications</h1>
			<p class="mt-1 text-sm text-muted-foreground">Configure where to receive deployment and system notifications.</p>
		</div>
		<Button onclick={() => (showCreate = true)}>
			<Plus class="mr-2 size-4" />
			Add Channel
		</Button>
	</div>

	{#if showCreate}
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-sm">New Notification Channel</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<label for="ch-name" class="text-sm font-medium">Name</label>
					<Input id="ch-name" bind:value={newName} placeholder="My Slack Channel" />
				</div>

				{#if !newType}
					<div class="space-y-2">
						<label class="text-sm font-medium">Type</label>
						<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
							{#each typeOptions as opt}
								<button
									type="button"
									onclick={() => (newType = opt.id)}
									class="flex flex-col items-center gap-2 rounded-lg border border-border p-3 text-center transition-colors hover:bg-muted"
								>
									<opt.icon class="size-5" style="color: {opt.color};" />
									<span class="text-xs font-medium">{opt.name}</span>
								</button>
							{/each}
						</div>
					</div>
				{:else}
					<div class="flex items-center gap-2">
						<Badge variant="outline">{typeIcon(newType).name}</Badge>
						<button type="button" class="text-xs text-muted-foreground hover:text-foreground" onclick={() => (newType = "")}>Change</button>
					</div>

					{#if newType === "slack" || newType === "discord"}
						<div class="space-y-2">
							<label for="ch-webhook" class="text-sm font-medium">Webhook URL</label>
							<Input id="ch-webhook" bind:value={newWebhookUrl} placeholder="https://hooks.slack.com/services/..." />
						</div>
					{:else if newType === "telegram"}
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div class="space-y-2">
								<label for="ch-bot" class="text-sm font-medium">Bot Token</label>
								<Input id="ch-bot" bind:value={newBotToken} placeholder="123456:ABC-DEF..." />
							</div>
							<div class="space-y-2">
								<label for="ch-chat" class="text-sm font-medium">Chat ID</label>
								<Input id="ch-chat" bind:value={newChatId} placeholder="-100123456789" />
							</div>
						</div>
					{:else if newType === "email"}
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div class="space-y-2">
								<label for="ch-host" class="text-sm font-medium">SMTP Host</label>
								<Input id="ch-host" bind:value={newSmtpHost} placeholder="smtp.gmail.com" />
							</div>
							<div class="space-y-2">
								<label for="ch-port" class="text-sm font-medium">Port</label>
								<Input id="ch-port" type="number" bind:value={newSmtpPort} />
							</div>
							<div class="space-y-2">
								<label for="ch-user" class="text-sm font-medium">Username</label>
								<Input id="ch-user" bind:value={newSmtpUser} />
							</div>
							<div class="space-y-2">
								<label for="ch-pass" class="text-sm font-medium">Password</label>
								<Input id="ch-pass" type="password" bind:value={newSmtpPassword} />
							</div>
							<div class="space-y-2">
								<label for="ch-from" class="text-sm font-medium">From</label>
								<Input id="ch-from" bind:value={newSmtpFrom} placeholder="noreply@example.com" />
							</div>
							<div class="space-y-2">
								<label for="ch-to" class="text-sm font-medium">To</label>
								<Input id="ch-to" bind:value={newSmtpTo} placeholder="team@example.com" />
							</div>
						</div>
					{:else if newType === "webhook"}
						<div class="space-y-3">
							<div class="space-y-2">
								<label for="ch-url" class="text-sm font-medium">URL</label>
								<Input id="ch-url" bind:value={newUrl} placeholder="https://api.example.com/webhook" />
							</div>
							<div class="space-y-2">
								<label for="ch-secret" class="text-sm font-medium">Secret <span class="text-muted-foreground">(optional)</span></label>
								<Input id="ch-secret" bind:value={newSecret} placeholder="HMAC signing secret" />
							</div>
						</div>
					{/if}

					<Separator />

					<div class="space-y-2">
						<label class="text-sm font-medium">Events</label>
						<p class="text-xs text-muted-foreground">Leave empty to receive all events.</p>
						<div class="flex flex-wrap gap-2">
							{#each eventOptions as evt}
								<button
									type="button"
									onclick={() => toggleEvent(evt.id)}
									class="rounded-full border px-3 py-1 text-xs transition-colors {newEvents.includes(evt.id)
										? 'border-primary bg-primary/10 text-primary'
										: 'border-border text-muted-foreground hover:text-foreground'}"
								>
									{evt.label}
								</button>
							{/each}
						</div>
					</div>

					<div class="flex gap-2">
						<Button onclick={handleCreate} disabled={creating || !newName.trim()}>
							{creating ? "Creating..." : "Create Channel"}
						</Button>
						<Button variant="ghost" onclick={resetForm}>Cancel</Button>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}

	{#if loading}
		<div class="space-y-3">
			{#each Array(3) as _}
				<div class="h-16 animate-pulse rounded-lg border border-border bg-muted/30"></div>
			{/each}
		</div>
	{:else if channels.length === 0 && !showCreate}
		<Card.Root>
			<Card.Content class="flex flex-col items-center gap-3 py-12 text-center">
				<Bell class="size-10 text-muted-foreground/50" />
				<p class="text-sm font-medium">No notification channels</p>
				<p class="text-xs text-muted-foreground">Add a channel to receive deployment and system alerts.</p>
				<Button variant="outline" onclick={() => (showCreate = true)}>
					<Plus class="mr-2 size-4" />
					Add Channel
				</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="space-y-3">
			{#each channels as channel}
				{@const info = typeIcon(channel.type)}
				<div class="flex items-center justify-between rounded-lg border border-border p-4">
					<div class="flex items-center gap-3">
						<div class="flex size-9 items-center justify-center rounded-lg border border-border">
							<info.icon class="size-4" style="color: {info.color};" />
						</div>
						<div>
							<div class="flex items-center gap-2">
								<p class="text-sm font-medium">{channel.name}</p>
								<Badge variant="outline" class="text-2xs capitalize">{channel.type}</Badge>
								{#if !channel.enabled}
									<Badge variant="outline" class="text-2xs text-muted-foreground">Disabled</Badge>
								{/if}
							</div>
							{#if channel.events && (channel.events as string[]).length > 0}
								<p class="mt-0.5 text-2xs text-muted-foreground">
									{(channel.events as string[]).map((e) => eventOptions.find((o) => o.id === e)?.label ?? e).join(", ")}
								</p>
							{:else}
								<p class="mt-0.5 text-2xs text-muted-foreground">All events</p>
							{/if}
						</div>
					</div>
					<div class="flex items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							onclick={() => handleTest(channel.id)}
							disabled={testing === channel.id}
						>
							<TestTube class="mr-1.5 size-3.5" />
							{testing === channel.id ? "Sending..." : "Test"}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onclick={() => handleToggle(channel.id, !channel.enabled)}
						>
							{channel.enabled ? "Disable" : "Enable"}
						</Button>
						<Button variant="ghost" size="sm" onclick={() => handleDelete(channel.id)}>
							<Trash2 class="size-3.5 text-destructive" />
						</Button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
