import yaml from "js-yaml";

export type ComposeService = {
	name: string;
	image?: string;
	build?: string | { context: string; dockerfile?: string };
	ports?: Array<string | number>;
	volumes?: string[];
	environment?: Record<string, string> | string[];
	env_file?: string | string[];
	depends_on?: string[] | Record<string, unknown>;
	deploy?: {
		replicas?: number;
		resources?: {
			limits?: { cpus?: string; memory?: string };
			reservations?: { cpus?: string; memory?: string };
		};
	};
	healthcheck?: {
		test: string | string[];
		interval?: string;
		timeout?: string;
		retries?: number;
	};
	restart?: string;
	command?: string | string[];
};

export type ComposeFile = {
	version?: string;
	services: Record<string, ComposeService>;
	volumes?: Record<string, unknown>;
	networks?: Record<string, unknown>;
};

export type ParseResult = {
	services: ComposeService[];
	warnings: string[];
};

export function parseComposeFile(content: string): ComposeFile {
	const parsed = yaml.load(content) as ComposeFile;
	if (!parsed?.services) {
		throw new Error("Invalid compose file: missing services");
	}
	return parsed;
}

export function validateComposeFile(compose: ComposeFile): string[] {
	const warnings: string[] = [];

	if (compose.networks && Object.keys(compose.networks).length > 0) {
		warnings.push("Custom networks are ignored — K3s provides flat networking between services");
	}

	for (const [name, svc] of Object.entries(compose.services)) {
		if (!svc.image && !svc.build) {
			warnings.push(`Service "${name}": no image or build directive specified`);
		}
	}

	return warnings;
}

export function composeToServices(
	compose: ComposeFile,
	_envVars?: Record<string, string>,
): ParseResult {
	const warnings = validateComposeFile(compose);
	const services: ComposeService[] = [];

	for (const [name, svc] of Object.entries(compose.services)) {
		const { name: _svcName, ...svcRest } = svc as ComposeService;
		const service: ComposeService = { name, ...svcRest };

		// Resolve environment variables from env_file or environment map
		if (svc.environment && Array.isArray(svc.environment)) {
			const envMap: Record<string, string> = {};
			for (const entry of svc.environment) {
				const eqIdx = entry.indexOf("=");
				if (eqIdx !== -1) {
					envMap[entry.slice(0, eqIdx)] = entry.slice(eqIdx + 1);
				}
			}
			service.environment = envMap;
		}

		services.push(service);
	}

	return { services, warnings };
}

export function parsePorts(
	ports: Array<string | number>,
): Array<{ host: number; container: number; protocol: string }> {
	return ports.map((p) => {
		const str = String(p);
		const parts = str.split(":");
		const protocol = str.includes("/udp") ? "UDP" : "TCP";
		const clean = str.replace("/udp", "").replace("/tcp", "");

		if (parts.length === 2) {
			return {
				host: Number(parts[0]),
				container: Number(parts[1].replace(/\/\w+$/, "")),
				protocol,
			};
		}
		const port = Number(clean);
		return { host: port, container: port, protocol };
	});
}

export function parseEnvironment(
	env: Record<string, string> | string[] | undefined,
): Record<string, string> {
	if (!env) return {};
	if (Array.isArray(env)) {
		const result: Record<string, string> = {};
		for (const entry of env) {
			const eqIdx = entry.indexOf("=");
			if (eqIdx !== -1) {
				result[entry.slice(0, eqIdx)] = entry.slice(eqIdx + 1);
			}
		}
		return result;
	}
	return env;
}

export function getDependencyOrder(compose: ComposeFile): string[] {
	const graph = new Map<string, string[]>();
	const names = Object.keys(compose.services);

	for (const name of names) {
		const deps = compose.services[name].depends_on;
		if (Array.isArray(deps)) {
			graph.set(name, deps);
		} else if (deps && typeof deps === "object") {
			graph.set(name, Object.keys(deps));
		} else {
			graph.set(name, []);
		}
	}

	const sorted: string[] = [];
	const visited = new Set<string>();
	const visiting = new Set<string>();

	function visit(name: string) {
		if (visited.has(name)) return;
		if (visiting.has(name)) return;
		visiting.add(name);
		for (const dep of graph.get(name) ?? []) {
			visit(dep);
		}
		visiting.delete(name);
		visited.add(name);
		sorted.push(name);
	}

	for (const name of names) {
		visit(name);
	}

	return sorted;
}
