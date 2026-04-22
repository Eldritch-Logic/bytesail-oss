<script lang="ts">
import { authClient } from "@bytesail/auth/client";
import { goto } from "$app/navigation";
import GithubIcon from "$lib/components/shared/GithubIcon.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { Label } from "$lib/components/ui/label/index.js";

let name = $state("");
let email = $state("");
let password = $state("");
let confirmPassword = $state("");
let error = $state("");
let loading = $state(false);

async function handleRegister(e: Event) {
	e.preventDefault();
	error = "";

	if (password !== confirmPassword) {
		error = "Passwords do not match";
		return;
	}

	loading = true;

	const result = await authClient.signUp.email({ name, email, password });

	if (result.error) {
		error = result.error.message ?? "Registration failed";
		loading = false;
		return;
	}

	goto("/projects");
}

async function handleGitHubSignUp() {
	await authClient.signIn.social({ provider: "github", callbackURL: "/projects" });
}
</script>

<div class="flex min-h-screen items-center justify-center">
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title class="text-2xl">Create an account</Card.Title>
			<Card.Description>Get started with ByteSail</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if error}
				<Alert.Root variant="destructive">
					<Alert.Description>{error}</Alert.Description>
				</Alert.Root>
			{/if}

			<form onsubmit={handleRegister} class="space-y-4">
				<div class="space-y-2">
					<Label for="name">Name</Label>
					<Input id="name" type="text" bind:value={name} placeholder="Your name" required />
				</div>
				<div class="space-y-2">
					<Label for="email">Email</Label>
					<Input id="email" type="email" bind:value={email} placeholder="you@example.com" required />
				</div>
				<div class="space-y-2">
					<Label for="password">Password</Label>
					<Input id="password" type="password" bind:value={password} required />
				</div>
				<div class="space-y-2">
					<Label for="confirm-password">Confirm password</Label>
					<Input id="confirm-password" type="password" bind:value={confirmPassword} required />
				</div>
				<Button type="submit" class="w-full" disabled={loading}>
					{loading ? "Creating account..." : "Create account"}
				</Button>
			</form>

			<div class="relative">
				<div class="absolute inset-0 flex items-center">
					<span class="w-full border-t border-border"></span>
				</div>
				<div class="relative flex justify-center text-xs uppercase">
					<span class="bg-card px-2 text-muted-foreground">or</span>
				</div>
			</div>

			<Button variant="outline" class="w-full" onclick={handleGitHubSignUp}>
				<GithubIcon class="mr-2 size-4" />
				Sign up with GitHub
			</Button>
		</Card.Content>
		<Card.Footer class="justify-center">
			<p class="text-sm text-muted-foreground">
				Already have an account? <a href="/login" class="text-primary hover:underline">Sign in</a>
			</p>
		</Card.Footer>
	</Card.Root>
</div>
