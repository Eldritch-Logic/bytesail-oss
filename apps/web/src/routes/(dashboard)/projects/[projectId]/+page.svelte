<script lang="ts">
import type { CanvasGroup, services } from "@bytesail/db/schema";
import {
	Background,
	BackgroundVariant,
	Controls,
	type Edge,
	type Node,
	Panel,
	SvelteFlow,
} from "@xyflow/svelte";
import "@xyflow/svelte/dist/style.css";
import { Group, Layers, Plus, Server } from "@lucide/svelte";
import type { InferSelectModel } from "drizzle-orm";
import { onDestroy } from "svelte";
import { invalidateAll } from "$app/navigation";
import CanvasContextMenu from "$lib/components/canvas/CanvasContextMenu.svelte";
import FocusNode from "$lib/components/canvas/FocusNode.svelte";
import GroupNode from "$lib/components/canvas/GroupNode.svelte";
import ServiceDetailPanel from "$lib/components/canvas/ServiceDetailPanel.svelte";
import ServiceNode from "$lib/components/canvas/ServiceNode.svelte";
import EmptyState from "$lib/components/shared/EmptyState.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import { trpc } from "$lib/trpc.js";

type Service = InferSelectModel<typeof services>;

let { data } = $props();

let selectedService = $state<Service | null>(null);
let detailOpen = $state(false);

let contextMenu = $state({
	show: false,
	x: 0,
	y: 0,
	service: null as Service | null,
	currentGroupId: null as string | null,
});

const GRID_SPACING_X = 350;
const GRID_SPACING_Y = 200;
const COLS = 3;

const NODE_W = 240;
const NODE_H = 140;

const nodeTypes = { service: ServiceNode, group: GroupNode };

const savedPositions = data.project.canvasState?.nodes ?? [];
const savedGroups: CanvasGroup[] = data.project.canvasState?.groups ?? [];

function groupStyle(w: number, h: number) {
	return `width: ${w}px; height: ${h}px; border: none; background: transparent; box-shadow: none;`;
}

function buildGroupNodes(): Node[] {
	return savedGroups.map((g) => ({
		id: g.id,
		type: "group",
		position: { x: g.x, y: g.y },
		style: groupStyle(g.width, g.height),
		data: {
			name: g.name,
			color: g.color,
			onRename: (name: string) => renameGroup(g.id, name),
			onDelete: () => deleteGroup(g.id),
			onColorChange: (color: string) => changeGroupColor(g.id, color),
		},
	}));
}

function buildServiceNodes(): Node[] {
	return data.services.map((s, i) => {
		const saved = savedPositions.find((n) => n.serviceId === s.id);
		const parentId = saved?.groupId;
		return {
			id: s.id,
			type: "service",
			position: saved
				? { x: saved.x, y: saved.y }
				: {
						x: (i % COLS) * GRID_SPACING_X,
						y: Math.floor(i / COLS) * GRID_SPACING_Y,
					},
			parentId,
			extent: parentId ? ("parent" as const) : undefined,
			data: { service: s },
		};
	});
}

let nodes = $state<Node[]>([...buildGroupNodes(), ...buildServiceNodes()]);

function getClosestHandles(
	sourcePos: { x: number; y: number },
	targetPos: { x: number; y: number },
): { sourceHandle: string; targetHandle: string } {
	const sCx = sourcePos.x + NODE_W / 2;
	const sCy = sourcePos.y + NODE_H / 2;
	const tCx = targetPos.x + NODE_W / 2;
	const tCy = targetPos.y + NODE_H / 2;

	const dx = tCx - sCx;
	const dy = tCy - sCy;

	if (Math.abs(dx) > Math.abs(dy)) {
		return dx > 0
			? { sourceHandle: "s-right", targetHandle: "t-left" }
			: { sourceHandle: "s-left", targetHandle: "t-right" };
	}
	return dy > 0
		? { sourceHandle: "s-bottom", targetHandle: "t-top" }
		: { sourceHandle: "s-top", targetHandle: "t-bottom" };
}

function buildEdges(): Edge[] {
	const posMap = new Map(nodes.map((n) => [n.id, n.position]));
	return data.dependencies.map((dep) => {
		const sourcePos = posMap.get(dep.toServiceId) ?? { x: 0, y: 0 };
		const targetPos = posMap.get(dep.fromServiceId) ?? { x: 0, y: 0 };
		const { sourceHandle, targetHandle } = getClosestHandles(sourcePos, targetPos);
		return {
			id: dep.id,
			source: dep.toServiceId,
			target: dep.fromServiceId,
			sourceHandle,
			targetHandle,
			type: "smoothstep",
			style: "stroke-dasharray: 6 3;",
		};
	});
}

let edges = $state<Edge[]>(buildEdges());

function handleNodeDragStop() {
	edges = buildEdges();
	saveCanvasState();
}

function addGroup() {
	const id = `group-${crypto.randomUUID().slice(0, 8)}`;
	const newGroup: Node = {
		id,
		type: "group",
		position: { x: 50, y: 50 },
		style: groupStyle(320, 200),
		data: {
			name: "New Group",
			color: "gray",
			onRename: (name: string) => renameGroup(id, name),
			onDelete: () => deleteGroup(id),
			onColorChange: (color: string) => changeGroupColor(id, color),
		},
	};
	nodes = [newGroup, ...nodes];
	saveCanvasState();
}

function renameGroup(groupId: string, name: string) {
	nodes = nodes.map((n) => (n.id === groupId ? { ...n, data: { ...n.data, name } } : n));
	saveCanvasState();
}

function deleteGroup(groupId: string) {
	nodes = nodes
		.map((n) => {
			if (n.parentId === groupId) {
				return { ...n, parentId: undefined, extent: undefined };
			}
			return n;
		})
		.filter((n) => n.id !== groupId);
	saveCanvasState();
}

function changeGroupColor(groupId: string, color: string) {
	nodes = nodes.map((n) => (n.id === groupId ? { ...n, data: { ...n.data, color } } : n));
	saveCanvasState();
}

function saveCanvasState() {
	const canvasNodes = nodes
		.filter((n) => n.type === "service")
		.map((n) => ({
			serviceId: n.id,
			x: n.position.x,
			y: n.position.y,
			groupId: n.parentId,
		}));

	const groups: CanvasGroup[] = nodes
		.filter((n) => n.type === "group")
		.map((n) => {
			const style = n.style as string | undefined;
			const widthMatch = style?.match(/width:\s*(\d+)/);
			const heightMatch = style?.match(/height:\s*(\d+)/);
			return {
				id: n.id,
				name: (n.data as { name: string }).name,
				x: n.position.x,
				y: n.position.y,
				width: widthMatch ? Number.parseInt(widthMatch[1]) : 400,
				height: heightMatch ? Number.parseInt(heightMatch[1]) : 300,
				color: (n.data as { color?: string }).color,
			};
		});

	trpc.project.update
		.mutate({
			id: data.project.id,
			canvasState: { nodes: canvasNodes, groups, zoom: 1, panX: 0, panY: 0 },
		})
		.catch((e) => console.error("Failed to save canvas state:", e));
}

function handleNodeClick(_event: { node: Node }) {
	if (_event.node.type === "group") return;
	const service = data.services.find((s) => s.id === _event.node.id);
	if (service) {
		selectedService = service;
		detailOpen = true;
	}
}

async function syncStatuses() {
	try {
		const podStatuses = await trpc.service.syncStatuses.query({
			projectId: data.project.id,
		});
		if (podStatuses.length > 0) {
			const updated = nodes.map((n) => {
				if (n.type !== "service") return n;
				const svc = data.services.find((s) => s.id === n.id);
				if (!svc) return n;
				const pod = podStatuses.find((p) => p.serviceSlug === svc.slug);
				if (!pod || pod.status === svc.status) return n;
				return {
					...n,
					data: { service: { ...svc, status: pod.status } },
				};
			});
			nodes = updated;
		}
	} catch {
		// K3s might not be reachable in dev
	}
}

function handlePaneContextMenu(event: { event: MouseEvent }) {
	event.event.preventDefault();
	contextMenu = {
		show: true,
		x: event.event.clientX,
		y: event.event.clientY,
		service: null,
		currentGroupId: null,
	};
}

function handleNodeContextMenu(event: { node: Node; event: MouseEvent }) {
	event.event.preventDefault();
	if (event.node.type === "group") return;
	const service = data.services.find((s) => s.id === event.node.id) ?? null;
	contextMenu = {
		show: true,
		x: event.event.clientX,
		y: event.event.clientY,
		service,
		currentGroupId: event.node.parentId ?? null,
	};
}

const canvasGroups = $derived(
	nodes
		.filter((n) => n.type === "group")
		.map((n) => ({
			id: n.id,
			name: (n.data as { name: string }).name,
			color: (n.data as { color?: string }).color,
		})),
);

const GROUP_PAD = 30;
const GROUP_HEADER = 50;
const GROUP_GAP = 30;
const GROUP_COLS = 2;

function calcGroupSize(childCount: number) {
	const cols = Math.min(childCount, GROUP_COLS);
	const rows = Math.ceil(childCount / GROUP_COLS);
	const w = GROUP_PAD * 2 + cols * NODE_W + (cols - 1) * GROUP_GAP;
	const h = GROUP_HEADER + rows * NODE_H + (rows - 1) * GROUP_GAP + GROUP_PAD;
	return { w: Math.max(w, 320), h: Math.max(h, 200) };
}

function childPosition(index: number) {
	const col = index % GROUP_COLS;
	const row = Math.floor(index / GROUP_COLS);
	return {
		x: GROUP_PAD + col * (NODE_W + GROUP_GAP),
		y: GROUP_HEADER + row * (NODE_H + GROUP_GAP),
	};
}

function moveToGroup(serviceId: string, groupId: string) {
	const group = nodes.find((n) => n.id === groupId);
	if (!group) return;

	const existingChildren = nodes.filter((n) => n.parentId === groupId && n.id !== serviceId);
	const totalChildren = existingChildren.length + 1;
	const pos = childPosition(existingChildren.length);
	const { w, h } = calcGroupSize(totalChildren);

	nodes = nodes.map((n) => {
		if (n.id === serviceId) {
			return {
				...n,
				parentId: groupId,
				extent: "parent" as const,
				position: pos,
			};
		}
		if (n.id === groupId) {
			return { ...n, style: groupStyle(w, h) };
		}
		return n;
	});
	saveCanvasState();
}

function removeFromGroup(serviceId: string) {
	const node = nodes.find((n) => n.id === serviceId);
	const groupId = node?.parentId;
	const parentNode = groupId ? nodes.find((n) => n.id === groupId) : null;

	// Remove from group
	nodes = nodes.map((n) => {
		if (n.id === serviceId) {
			return {
				...n,
				parentId: undefined,
				extent: undefined,
				position: parentNode
					? {
							x: parentNode.position.x + n.position.x,
							y: parentNode.position.y + n.position.y,
						}
					: n.position,
			};
		}
		return n;
	});

	// Re-layout remaining children and resize group
	if (groupId) {
		const remaining = nodes.filter((n) => n.parentId === groupId);
		const { w, h } = calcGroupSize(remaining.length);
		nodes = nodes.map((n) => {
			if (n.parentId === groupId) {
				const idx = remaining.indexOf(n);
				return { ...n, position: childPosition(idx) };
			}
			if (n.id === groupId) {
				return { ...n, style: groupStyle(w, h) };
			}
			return n;
		});
	}

	saveCanvasState();
}

async function handleContextMenuAction(action: {
	type: string;
	service?: Service;
	serviceId?: string;
	groupId?: string;
}) {
	if (action.type === "addGroup") {
		addGroup();
	} else if (action.type === "moveToGroup" && action.serviceId && action.groupId) {
		moveToGroup(action.serviceId, action.groupId);
	} else if (action.type === "removeFromGroup" && action.serviceId) {
		removeFromGroup(action.serviceId);
	} else if (action.type === "deploy" && action.service) {
		try {
			await trpc.deployment.deploy.mutate({ serviceId: action.service.id });
			invalidateAll();
		} catch (e) {
			console.error("Deploy failed:", e);
		}
	} else if (action.type === "restart" && action.service) {
		try {
			await trpc.service.restart.mutate({ id: action.service.id });
			invalidateAll();
		} catch (e) {
			console.error("Restart failed:", e);
		}
	} else if (action.type === "viewLogs" && action.service) {
		selectedService = action.service;
		detailOpen = true;
	}
}

const interval = setInterval(syncStatuses, 10_000);
syncStatuses();

onDestroy(() => clearInterval(interval));
</script>

<div class="flex h-[calc(100vh-8rem)] flex-col">
	<div class="flex items-center justify-between pb-4">
		<div>
			<h1 class="text-2xl font-semibold">{data.project.name}</h1>
			{#if data.project.description}
				<p class="mt-1 text-sm text-muted-foreground">{data.project.description}</p>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			<Button variant="outline" href="/projects/{data.project.id}/compose">
				<Layers class="mr-2 size-4" />
				Compose
			</Button>
			<Button variant="outline" onclick={addGroup}>
				<Group class="mr-2 size-4" />
				Add Group
			</Button>
			<Button>
				<Plus class="mr-2 size-4" />
				Add Service
			</Button>
		</div>
	</div>

	{#if data.services.length === 0}
		<div class="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border">
			<EmptyState
				icon={Server}
				title="No services yet"
				description="Add a service to start deploying your application."
			>
				{#snippet action()}
					<Button>
						<Plus class="mr-2 size-4" />
						Add Service
					</Button>
				{/snippet}
			</EmptyState>
		</div>
	{:else}
		<div class="flex-1 rounded-lg border border-border">
			<SvelteFlow
				bind:nodes
				bind:edges
				{nodeTypes}
				fitView
				fitViewOptions={{ padding: 0.3 }}
				minZoom={0.25}
				maxZoom={2}
				colorMode="dark"
				onnodeclick={handleNodeClick}
				onnodedragstop={handleNodeDragStop}
				onpanecontextmenu={handlePaneContextMenu}
				onnodecontextmenu={handleNodeContextMenu}
				proOptions={{ hideAttribution: true }}
			>
				<Background variant={BackgroundVariant.Dots} gap={20} size={1} />
				<Controls position="bottom-right" showLock={false} />
				{#if detailOpen && selectedService}
					<FocusNode nodeId={selectedService.id} />
				{/if}
			</SvelteFlow>
		</div>
	{/if}
</div>

<ServiceDetailPanel
	service={selectedService}
	bind:open={detailOpen}
	onOpenChange={(v) => { if (!v) selectedService = null; }}
	projectId={data.project.id}
/>

<CanvasContextMenu
	x={contextMenu.x}
	y={contextMenu.y}
	show={contextMenu.show}
	service={contextMenu.service}
	currentGroupId={contextMenu.currentGroupId}
	groups={canvasGroups}
	onAction={handleContextMenuAction}
	onClose={() => (contextMenu = { ...contextMenu, show: false })}
/>
