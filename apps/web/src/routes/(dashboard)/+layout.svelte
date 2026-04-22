<script lang="ts">
import AppShell from "$lib/components/layout/AppShell.svelte";
import { Toaster } from "$lib/components/ui/sonner/index.js";

let { data, children } = $props();
</script>

<AppShell
	userName={data.session?.user?.name}
	userEmail={data.session?.user?.email}
	userImage={data.session?.user?.image}
	projects={data.projects ?? []}
>
	{@render children()}
</AppShell>

<Toaster richColors position="bottom-right" />
