<script lang="ts">
import { WifiOff, X } from "@lucide/svelte";
import { onDestroy, onMount } from "svelte";

let offline = $state(false);
let dismissed = $state(false);
let interval: ReturnType<typeof setInterval> | null = null;

async function checkConnection() {
	try {
		const res = await fetch("/api/trpc/settings.list", {
			method: "GET",
			signal: AbortSignal.timeout(5000),
		});
		offline = !res.ok;
	} catch {
		offline = true;
	}
}

function handleOnline() {
	offline = false;
	dismissed = false;
}

function handleOffline() {
	offline = true;
	dismissed = false;
}

onMount(() => {
	window.addEventListener("online", handleOnline);
	window.addEventListener("offline", handleOffline);

	if (!navigator.onLine) {
		offline = true;
	}

	interval = setInterval(checkConnection, 30_000);
});

onDestroy(() => {
	if (interval) clearInterval(interval);
	if (typeof window !== "undefined") {
		window.removeEventListener("online", handleOnline);
		window.removeEventListener("offline", handleOffline);
	}
});
</script>

{#if offline && !dismissed}
	<div class="flex items-center gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2">
		<WifiOff class="size-4 shrink-0 text-destructive" />
		<p class="flex-1 text-xs text-destructive">
			Unable to connect to the ByteSail API. Some features may not work.
		</p>
		<button
			type="button"
			class="shrink-0 rounded p-0.5 text-destructive/70 hover:text-destructive"
			onclick={() => (dismissed = true)}
			aria-label="Dismiss"
		>
			<X class="size-3.5" />
		</button>
	</div>
{/if}
