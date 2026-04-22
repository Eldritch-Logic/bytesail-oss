<script lang="ts">
import { useSvelteFlow } from "@xyflow/svelte";

type Props = {
	nodeId: string | null;
	panelWidth?: number;
};

let { nodeId, panelWidth = 672 }: Props = $props();

const { getNode, setCenter } = useSvelteFlow();

$effect(() => {
	if (!nodeId) return;
	const node = getNode(nodeId);
	if (!node) return;

	const nodeW = 240;
	const nodeH = 140;
	const cx = node.position.x + nodeW / 2;
	const cy = node.position.y + nodeH / 2;

	// Offset the center to the left so the node appears beside the panel
	const offsetX = panelWidth / 2;

	setCenter(cx - offsetX / 2, cy, { duration: 300, zoom: 1 });
});
</script>
