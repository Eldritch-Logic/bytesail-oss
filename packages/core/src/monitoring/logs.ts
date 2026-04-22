import type { K3sClient } from "../k3s/client.js";
import { projectNamespace } from "../k3s/namespaces.js";

const LOKI_URL = process.env.LOKI_URL ?? "http://loki.observability.svc.cluster.local:3100";

export type LogEntry = {
	timestamp: string;
	line: string;
	level: "debug" | "info" | "warn" | "error" | "fatal";
	pod: string;
	container?: string;
};

export type LogQueryOptions = {
	query?: string;
	start?: string;
	end?: string;
	limit?: number;
	direction?: "forward" | "backward";
};

const LOG_LEVEL_REGEX = /\b(DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|PANIC|CRITICAL)\b/i;

function detectLevel(line: string): LogEntry["level"] {
	const match = line.match(LOG_LEVEL_REGEX);
	if (!match) return "info";
	const level = match[1].toUpperCase();
	if (level === "DEBUG") return "debug";
	if (level === "WARNING" || level === "WARN") return "warn";
	if (level === "ERROR") return "error";
	if (level === "FATAL" || level === "PANIC" || level === "CRITICAL") return "fatal";
	return "info";
}

type LokiStream = {
	stream: Record<string, string>;
	values: [string, string][];
};

type LokiQueryResponse = {
	status: string;
	data: {
		resultType: string;
		result: LokiStream[];
	};
};

function parseLokiResponse(data: LokiQueryResponse): LogEntry[] {
	const entries: LogEntry[] = [];

	for (const stream of data.data.result) {
		const pod = stream.stream.pod ?? stream.stream.instance ?? "";
		const container = stream.stream.container;

		for (const [tsNano, line] of stream.values) {
			const tsMs = Number(BigInt(tsNano) / 1000000n);
			entries.push({
				timestamp: new Date(tsMs).toISOString(),
				line,
				level: (stream.stream.level as LogEntry["level"]) ?? detectLevel(line),
				pod,
				container,
			});
		}
	}

	entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
	return entries;
}

export async function queryLogs(
	serviceSlug: string,
	projectId: string,
	projectSlug: string,
	options: LogQueryOptions = {},
): Promise<LogEntry[]> {
	const { query, start, end, limit = 500, direction = "backward" } = options;

	const namespace = projectNamespace(projectId, projectSlug);
	let logQL = `{namespace="${namespace}", bytesail_service="${serviceSlug}"}`;
	if (query) {
		logQL += ` |~ \`${query}\``;
	}

	const params = new URLSearchParams({
		query: logQL,
		limit: String(limit),
		direction,
	});
	if (start) params.set("start", start);
	if (end) params.set("end", end);

	const res = await fetch(`${LOKI_URL}/loki/api/v1/query_range?${params}`);
	if (!res.ok) {
		throw new Error(`Loki query failed: ${res.status} ${await res.text()}`);
	}

	const data = (await res.json()) as LokiQueryResponse;
	return parseLokiResponse(data);
}

export type LogStreamCallback = (entry: LogEntry) => void;

export async function streamLogs(
	k3s: K3sClient,
	serviceSlug: string,
	projectId: string,
	projectSlug: string,
	onEntry: LogStreamCallback,
	options: { tail?: number } = {},
): Promise<() => void> {
	const namespace = projectNamespace(projectId, projectSlug);
	const { tail = 100 } = options;

	const pods = await k3s.core.listNamespacedPod({
		namespace,
		labelSelector: `bytesail.io/service=${serviceSlug}`,
	});

	const abortControllers: AbortController[] = [];

	for (const pod of pods.items) {
		const podName = pod.metadata?.name;
		if (!podName) continue;

		const containers = pod.spec?.containers.map((c) => c.name) ?? [];

		for (const container of containers) {
			const controller = new AbortController();
			abortControllers.push(controller);

			streamPodLogs(k3s, namespace, podName, container, tail, controller.signal, onEntry);
		}
	}

	return () => {
		for (const c of abortControllers) {
			c.abort();
		}
	};
}

async function streamPodLogs(
	k3s: K3sClient,
	namespace: string,
	podName: string,
	container: string,
	tail: number,
	signal: AbortSignal,
	onEntry: LogStreamCallback,
) {
	try {
		const logStream = await k3s.core.readNamespacedPodLog({
			name: podName,
			namespace,
			container,
			follow: true,
			tailLines: tail,
			timestamps: true,
		});

		const text = typeof logStream === "string" ? logStream : String(logStream);

		for (const rawLine of text.split("\n")) {
			if (signal.aborted) return;
			if (!rawLine.trim()) continue;

			const spaceIdx = rawLine.indexOf(" ");
			const timestamp = spaceIdx > 0 ? rawLine.slice(0, spaceIdx) : new Date().toISOString();
			const line = spaceIdx > 0 ? rawLine.slice(spaceIdx + 1) : rawLine;

			onEntry({
				timestamp,
				line,
				level: detectLevel(line),
				pod: podName,
				container,
			});
		}
	} catch (e) {
		if (!signal.aborted) {
			console.error(`[ByteSail] Log stream failed for ${podName}/${container}:`, e);
		}
	}
}
