<script lang="ts">
import "../app.css";
import interFont from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import jetbrainsFont from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url";
import { QueryClient, QueryClientProvider } from "@tanstack/svelte-query";
import { ModeWatcher } from "mode-watcher";
import favicon from "$lib/assets/favicon.svg";

let { children } = $props();

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 2, // 2 minutes
			gcTime: 1000 * 60 * 10, // 10 minutes
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preload" href={interFont} as="font" type="font/woff2" crossorigin="anonymous" />
	<link rel="preload" href={jetbrainsFont} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<ModeWatcher defaultMode="dark" />
<QueryClientProvider client={queryClient}>
	{@render children()}
</QueryClientProvider>
