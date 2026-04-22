<script lang="ts">
import { onMount } from "svelte";
import { page } from "$app/stores";
import * as Card from "$lib/components/ui/card/index.js";

let status = $state<"loading" | "authenticating" | "success" | "error">("loading");
let errorMessage = $state("");

onMount(async () => {
	const callbackUrl = $page.url.searchParams.get("callback");

	if (!callbackUrl) {
		status = "error";
		errorMessage = "Missing callback parameter.";
		return;
	}

	// Check if user is authenticated
	try {
		const sessionRes = await fetch("/api/auth/session");
		const session = await sessionRes.json();

		if (!session?.user) {
			// Redirect to login with redirect back to this page
			const currentUrl = $page.url.pathname + $page.url.search;
			window.location.href = `/login?redirect=${encodeURIComponent(currentUrl)}`;
			return;
		}

		status = "authenticating";

		// Create API key for CLI
		const now = new Date();
		const dateStr = now.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});

		const keyRes = await fetch("/api/auth/api-key", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: `CLI (${dateStr})`,
			}),
		});

		if (!keyRes.ok) {
			status = "error";
			errorMessage = "Failed to create API key.";
			return;
		}

		const keyData = await keyRes.json();

		// POST the API key to the CLI callback
		const callbackRes = await fetch(callbackUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ apiKey: keyData.key }),
		});

		if (!callbackRes.ok) {
			status = "error";
			errorMessage = "Failed to send credentials to CLI.";
			return;
		}

		status = "success";
	} catch (e) {
		status = "error";
		errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
	}
});
</script>

<div class="flex min-h-screen items-center justify-center">
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title class="text-2xl">CLI Authentication</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if status === "loading"}
				<p class="text-muted-foreground">Checking session...</p>
			{:else if status === "authenticating"}
				<p class="text-muted-foreground">Creating API key...</p>
			{:else if status === "success"}
				<div class="space-y-2">
					<p class="text-green-500 font-medium">CLI authenticated successfully.</p>
					<p class="text-muted-foreground text-sm">You can close this tab.</p>
				</div>
			{:else if status === "error"}
				<p class="text-destructive">{errorMessage}</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
