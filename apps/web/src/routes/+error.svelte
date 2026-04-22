<script lang="ts">
import { TriangleAlert } from "@lucide/svelte";
import { page } from "$app/state";
import { Button } from "$lib/components/ui/button/index.js";
</script>

<div class="flex min-h-screen items-center justify-center bg-background p-6">
	<div class="flex max-w-md flex-col items-center gap-4 text-center">
		<div class="flex size-16 items-center justify-center rounded-full bg-destructive/10">
			<TriangleAlert class="size-8 text-destructive" />
		</div>
		<h1 class="text-2xl font-semibold">{page.status}</h1>
		<p class="text-sm text-muted-foreground">{page.error?.message ?? "An unexpected error occurred."}</p>
		<div class="flex gap-2">
			<Button onclick={() => location.reload()}>Retry</Button>
			<Button variant="outline" href="/">Go Home</Button>
		</div>
	</div>
</div>
