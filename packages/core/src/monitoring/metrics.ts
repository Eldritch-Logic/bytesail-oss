import { createK3sClient } from "../k3s/client.js";
import { projectNamespace } from "../k3s/namespaces.js";

const PROMETHEUS_URL =
	process.env.PROMETHEUS_URL ?? "http://prometheus.observability.svc.cluster.local:9090";

export type MetricPoint = {
	timestamp: number;
	value: number;
};

export type MetricName = "cpu" | "memory" | "network_rx" | "network_tx" | "restarts";

type PrometheusMatrixResult = {
	status: string;
	data: {
		resultType: "matrix";
		result: Array<{
			metric: Record<string, string>;
			values: [number, string][];
		}>;
	};
};

type PrometheusVectorResult = {
	status: string;
	data: {
		resultType: "vector";
		result: Array<{
			metric: Record<string, string>;
			value: [number, string];
		}>;
	};
};

function buildServiceQuery(metric: MetricName, namespace: string, serviceSlug: string): string {
	const podSelector = `namespace="${namespace}", pod=~"${serviceSlug}-.+"`;

	switch (metric) {
		case "cpu":
			return `sum(rate(container_cpu_usage_seconds_total{${podSelector}, container!="", container!="POD"}[5m]))`;
		case "memory":
			return `sum(container_memory_working_set_bytes{${podSelector}, container!="", container!="POD"})`;
		case "network_rx":
			return `sum(rate(container_network_receive_bytes_total{${podSelector}}[5m]))`;
		case "network_tx":
			return `sum(rate(container_network_transmit_bytes_total{${podSelector}}[5m]))`;
		case "restarts":
			return `sum(kube_pod_container_status_restarts_total{namespace="${namespace}", pod=~"${serviceSlug}-.+"})`;
	}
}

function parseMatrixResponse(data: PrometheusMatrixResult): MetricPoint[] {
	const points: MetricPoint[] = [];

	for (const series of data.data.result) {
		for (const [ts, val] of series.values) {
			points.push({ timestamp: ts, value: Number.parseFloat(val) });
		}
	}

	points.sort((a, b) => a.timestamp - b.timestamp);
	return points;
}

export async function queryMetrics(
	serviceSlug: string,
	projectId: string,
	projectSlug: string,
	metric: MetricName,
	start: string,
	end: string,
	step = "60s",
): Promise<MetricPoint[]> {
	const namespace = projectNamespace(projectId, projectSlug);
	const query = buildServiceQuery(metric, namespace, serviceSlug);

	const params = new URLSearchParams({ query, start, end, step });
	const res = await fetch(`${PROMETHEUS_URL}/api/v1/query_range?${params}`);
	if (!res.ok) {
		throw new Error(`Prometheus query failed: ${res.status} ${await res.text()}`);
	}

	const data = (await res.json()) as PrometheusMatrixResult;
	return parseMatrixResponse(data);
}

export type SystemMetrics = {
	nodeCount: number;
	cpuUsagePercent: number;
	cpuCores: number;
	memoryUsedBytes: number;
	memoryTotalBytes: number;
	storageUsedBytes: number;
	storageTotalBytes: number;
};

export async function querySystemMetrics(): Promise<SystemMetrics> {
	// Try Prometheus first
	try {
		const result = await querySystemMetricsFromPrometheus();
		if (result.nodeCount > 0) return result;
	} catch {
		// Prometheus not available
	}

	// Fall back to K3s API
	return querySystemMetricsFromK3s();
}

async function querySystemMetricsFromPrometheus(): Promise<SystemMetrics> {
	const queries: Record<string, string> = {
		nodeCount: "count(kube_node_info)",
		cpuUsage: '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
		cpuCores: 'count(node_cpu_seconds_total{mode="idle"})',
		memoryUsed: "sum(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes)",
		memoryTotal: "sum(node_memory_MemTotal_bytes)",
		storageUsed:
			'sum(node_filesystem_size_bytes{mountpoint="/"} - node_filesystem_avail_bytes{mountpoint="/"})',
		storageTotal: 'sum(node_filesystem_size_bytes{mountpoint="/"})',
	};

	const results = await Promise.all(
		Object.entries(queries).map(async ([key, query]) => {
			const params = new URLSearchParams({ query });
			const res = await fetch(`${PROMETHEUS_URL}/api/v1/query?${params}`);
			if (!res.ok) return [key, 0] as const;
			const data = (await res.json()) as PrometheusVectorResult;
			const val = data.data.result[0]?.value[1];
			return [key, val ? Number.parseFloat(val) : 0] as const;
		}),
	);

	const vals = Object.fromEntries(results);

	return {
		nodeCount: Math.round(vals.nodeCount ?? 0),
		cpuUsagePercent: vals.cpuUsage ?? 0,
		cpuCores: Math.round(vals.cpuCores ?? 0),
		memoryUsedBytes: vals.memoryUsed ?? 0,
		memoryTotalBytes: vals.memoryTotal ?? 0,
		storageUsedBytes: vals.storageUsed ?? 0,
		storageTotalBytes: vals.storageTotal ?? 0,
	};
}

async function querySystemMetricsFromK3s(): Promise<SystemMetrics> {
	try {
		const k3s = createK3sClient();

		const nodeList = await k3s.core.listNode();
		const nodes = nodeList.items ?? [];

		let totalCpuCores = 0;
		let totalMemoryBytes = 0;
		let allocatableCpu = 0;
		let allocatableMemory = 0;

		for (const node of nodes) {
			const capacity = node.status?.capacity;
			const allocatable = node.status?.allocatable;

			if (capacity?.cpu) {
				totalCpuCores += parseCpuValue(capacity.cpu);
			}
			if (capacity?.memory) {
				totalMemoryBytes += parseMemoryValue(capacity.memory);
			}
			if (allocatable?.cpu) {
				allocatableCpu += parseCpuValue(allocatable.cpu);
			}
			if (allocatable?.memory) {
				allocatableMemory += parseMemoryValue(allocatable.memory);
			}
		}

		// Get pod resource usage from metrics API
		let usedCpu = 0;
		let usedMemory = 0;
		try {
			const metricsResponse = await k3s.custom.listClusterCustomObject({
				group: "metrics.k8s.io",
				version: "v1beta1",
				plural: "nodes",
			});
			const items =
				(metricsResponse as { items?: Array<{ usage?: { cpu?: string; memory?: string } }> })
					.items ?? [];
			for (const item of items) {
				if (item.usage?.cpu) usedCpu += parseCpuValue(item.usage.cpu);
				if (item.usage?.memory) usedMemory += parseMemoryValue(item.usage.memory);
			}
		} catch {
			// Metrics API might not be available, estimate from allocatable
			usedMemory = totalMemoryBytes - allocatableMemory;
			usedCpu = totalCpuCores - allocatableCpu;
		}

		const cpuPercent = totalCpuCores > 0 ? (usedCpu / totalCpuCores) * 100 : 0;

		return {
			nodeCount: nodes.length,
			cpuUsagePercent: Math.max(0, Math.min(100, cpuPercent)),
			cpuCores: totalCpuCores,
			memoryUsedBytes: usedMemory,
			memoryTotalBytes: totalMemoryBytes,
			storageUsedBytes: 0,
			storageTotalBytes: 0,
		};
	} catch {
		return {
			nodeCount: 0,
			cpuUsagePercent: 0,
			cpuCores: 0,
			memoryUsedBytes: 0,
			memoryTotalBytes: 0,
			storageUsedBytes: 0,
			storageTotalBytes: 0,
		};
	}
}

function parseCpuValue(cpu: string): number {
	if (cpu.endsWith("n")) return Number.parseInt(cpu, 10) / 1_000_000_000;
	if (cpu.endsWith("u")) return Number.parseInt(cpu, 10) / 1_000_000;
	if (cpu.endsWith("m")) return Number.parseInt(cpu, 10) / 1000;
	return Number.parseFloat(cpu);
}

function parseMemoryValue(mem: string): number {
	if (mem.endsWith("Ki")) return Number.parseInt(mem, 10) * 1024;
	if (mem.endsWith("Mi")) return Number.parseInt(mem, 10) * 1024 * 1024;
	if (mem.endsWith("Gi")) return Number.parseInt(mem, 10) * 1024 * 1024 * 1024;
	if (mem.endsWith("Ti")) return Number.parseInt(mem, 10) * 1024 * 1024 * 1024 * 1024;
	if (mem.endsWith("k") || mem.endsWith("K")) return Number.parseInt(mem, 10) * 1000;
	if (mem.endsWith("M")) return Number.parseInt(mem, 10) * 1_000_000;
	if (mem.endsWith("G")) return Number.parseInt(mem, 10) * 1_000_000_000;
	return Number.parseInt(mem, 10);
}

export async function queryCurrentMetrics(
	serviceSlug: string,
	projectId: string,
	projectSlug: string,
): Promise<{ cpu: number; memoryBytes: number; restarts: number }> {
	const namespace = projectNamespace(projectId, projectSlug);

	const cpuQuery = buildServiceQuery("cpu", namespace, serviceSlug);
	const memQuery = buildServiceQuery("memory", namespace, serviceSlug);
	const restartQuery = buildServiceQuery("restarts", namespace, serviceSlug);

	const [cpu, mem, restarts] = await Promise.all(
		[cpuQuery, memQuery, restartQuery].map(async (query) => {
			try {
				const params = new URLSearchParams({ query });
				const res = await fetch(`${PROMETHEUS_URL}/api/v1/query?${params}`);
				if (!res.ok) return 0;
				const data = (await res.json()) as PrometheusVectorResult;
				const val = data.data.result[0]?.value[1];
				return val ? Number.parseFloat(val) : 0;
			} catch {
				return 0;
			}
		}),
	);

	return { cpu, memoryBytes: mem, restarts };
}
