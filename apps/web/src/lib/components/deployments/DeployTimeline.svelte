<script lang="ts">
import { Rocket } from "@lucide/svelte";
import EmptyState from "$lib/components/shared/EmptyState.svelte";
import DeployCard from "./DeployCard.svelte";

type Deployment = {
	id: string;
	version: number;
	status: string;
	trigger: string;
	commitHash: string | null;
	commitMessage: string | null;
	commitAuthor: string | null;
	branch: string | null;
	buildDuration: number | null;
	deployDuration: number | null;
	errorMessage: string | null;
	createdAt: Date | string;
};

type Props = {
	deployments: Deployment[];
	onRollback?: (id: string) => void;
	onViewLogs?: (id: string) => void;
};

let { deployments, onRollback, onViewLogs }: Props = $props();
</script>

{#if deployments.length === 0}
	<EmptyState
		icon={Rocket}
		title="No deployments yet"
		description="Deploy your service to see the deployment history here."
	/>
{:else}
	<div class="space-y-3">
		{#each deployments as deployment, i}
			<DeployCard {deployment} isCurrent={i === 0 && deployment.status === "running"} {onRollback} {onViewLogs} />
		{/each}
	</div>
{/if}
