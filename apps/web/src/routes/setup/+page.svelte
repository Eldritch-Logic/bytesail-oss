<script lang="ts">
import { authClient } from "@bytesail/auth/client";
import { Ship } from "@lucide/svelte";
import { goto } from "$app/navigation";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { Label } from "$lib/components/ui/label/index.js";

let instanceName = $state("ByteSail");
let baseDomain = $state("");
let name = $state("");
let email = $state("");
let password = $state("");
let confirmPassword = $state("");
let error = $state("");
let loading = $state(false);

async function handleSetup(e: Event) {
	e.preventDefault();
	error = "";

	if (password !== confirmPassword) {
		error = "Passwords do not match";
		return;
	}

	loading = true;

	const result = await authClient.signUp.email({ name, email, password });

	if (result.error) {
		error = result.error.message ?? "Setup failed";
		loading = false;
		return;
	}

	goto("/projects");
}
</script>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="items-center text-center">
			<div class="mb-2 rounded-full bg-primary/10 p-3">
				<Ship class="size-8 text-primary" />
			</div>
			<Card.Title class="text-2xl">Welcome to ByteSail</Card.Title>
			<Card.Description>Set up your instance to get started</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-6">
			{#if error}
				<Alert.Root variant="destructive">
					<Alert.Description>{error}</Alert.Description>
				</Alert.Root>
			{/if}

			<form onsubmit={handleSetup} class="space-y-6">
				<div class="space-y-4">
					<h3 class="text-sm font-medium text-muted-foreground">Instance</h3>
					<div class="space-y-2">
						<Label for="instance-name">Instance name</Label>
						<Input id="instance-name" type="text" bind:value={instanceName} required />
					</div>
					<div class="space-y-2">
						<Label for="base-domain">Base domain</Label>
						<Input
							id="base-domain"
							type="text"
							bind:value={baseDomain}
							placeholder="bytesail.example.com"
							required
						/>
					</div>
				</div>

				<div class="space-y-4">
					<h3 class="text-sm font-medium text-muted-foreground">Admin account</h3>
					<div class="space-y-2">
						<Label for="name">Name</Label>
						<Input id="name" type="text" bind:value={name} placeholder="Your name" required />
					</div>
					<div class="space-y-2">
						<Label for="email">Email</Label>
						<Input
							id="email"
							type="email"
							bind:value={email}
							placeholder="admin@example.com"
							required
						/>
					</div>
					<div class="space-y-2">
						<Label for="password">Password</Label>
						<Input id="password" type="password" bind:value={password} required />
					</div>
					<div class="space-y-2">
						<Label for="confirm-password">Confirm password</Label>
						<Input
							id="confirm-password"
							type="password"
							bind:value={confirmPassword}
							required
						/>
					</div>
				</div>

				<Button type="submit" class="w-full" disabled={loading}>
					{loading ? "Setting up..." : "Complete setup"}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
