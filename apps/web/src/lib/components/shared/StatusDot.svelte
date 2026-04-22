<script lang="ts">
import type { ServiceStatus } from "@bytesail/shared";
import { cn } from "$lib/utils.js";

type Props = {
	status: ServiceStatus;
	class?: string;
};

let { status, class: className }: Props = $props();

const colorMap: Record<ServiceStatus, string> = {
	running: "bg-status-running",
	building: "bg-status-building",
	deploying: "bg-status-deploying",
	failed: "bg-status-failed",
	stopped: "bg-status-stopped",
	queued: "bg-status-queued",
};
</script>

<span
	class={cn("relative inline-flex size-2.5 rounded-full", colorMap[status], className)}
	aria-label={status}
>
	{#if status === "running"}
		<span
			class="absolute inline-flex size-full animate-ping rounded-full bg-status-running opacity-50"
		></span>
	{/if}
</span>
