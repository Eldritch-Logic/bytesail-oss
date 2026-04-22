<script lang="ts">
import TimeAgo from "$lib/components/shared/TimeAgo.svelte";
import * as Card from "$lib/components/ui/card/index.js";

type Project = {
	id: string;
	name: string;
	slug: string;
	description?: string | null;
	createdAt: Date | string;
	updatedAt: Date | string;
};

type Props = {
	project: Project;
};

let { project }: Props = $props();
</script>

<a href="/projects/{project.id}" class="block">
	<Card.Root
		class="transition-colors hover:border-primary/50"
	>
		<Card.Header class="pb-2">
			<Card.Title class="text-base">{project.name}</Card.Title>
			{#if project.description}
				<Card.Description class="line-clamp-2 text-xs">
					{project.description}
				</Card.Description>
			{/if}
		</Card.Header>
		<Card.Content>
			<p class="text-xs text-muted-foreground">
				Updated <TimeAgo date={project.updatedAt} />
			</p>
		</Card.Content>
	</Card.Root>
</a>
