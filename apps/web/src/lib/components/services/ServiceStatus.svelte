<script lang="ts">
import type { ServiceStatus } from "@bytesail/shared";
import StatusDot from "$lib/components/shared/StatusDot.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { cn } from "$lib/utils.js";

type Props = {
	status: ServiceStatus;
	class?: string;
};

let { status, class: className }: Props = $props();

const variantMap: Record<ServiceStatus, string> = {
	running: "border-status-running text-status-running",
	building: "border-status-building text-status-building",
	deploying: "border-status-deploying text-status-deploying",
	failed: "border-status-failed text-status-failed",
	stopped: "border-border text-muted-foreground",
	queued: "border-status-queued text-status-queued",
};
</script>

<Badge variant="outline" class={cn(variantMap[status], className)}>
	<StatusDot {status} class="mr-1.5" />
	<span class="capitalize">{status}</span>
</Badge>
