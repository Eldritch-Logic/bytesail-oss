export function detectServiceType(
	name: string,
	image?: string,
): "app" | "database" | "redis" | "worker" | "cron" {
	const lower = (image ?? name).toLowerCase();
	if (/postgres|mysql|mariadb|mongo|cockroach|timescale|postgis/.test(lower)) return "database";
	if (/redis|valkey|keydb|dragonfly/.test(lower)) return "redis";
	return "app";
}

export function detectPort(image?: string, ports?: Array<string | number>): number {
	// Try to extract from compose ports mapping (e.g. "5432:5432" or "8080:80")
	if (ports && ports.length > 0) {
		const first = String(ports[0]);
		const parts = first.split(":");
		// Container port is the last part
		const containerPort = Number.parseInt(parts[parts.length - 1]);
		if (!Number.isNaN(containerPort)) return containerPort;
	}

	// Auto-detect from image name
	if (!image) return 3000;
	const lower = image.toLowerCase();
	if (/postgres|postgis|timescale|cockroach/.test(lower)) return 5432;
	if (/mysql|mariadb/.test(lower)) return 3306;
	if (/mongo/.test(lower)) return 27017;
	if (/redis|valkey|keydb|dragonfly/.test(lower)) return 6379;
	if (/nginx|httpd|apache/.test(lower)) return 80;
	if (/grafana/.test(lower)) return 3000;
	if (/loki/.test(lower)) return 3100;
	if (/prometheus/.test(lower)) return 9090;
	if (/minio/.test(lower)) return 9000;
	if (/rabbitmq/.test(lower)) return 5672;
	if (/nats/.test(lower)) return 4222;
	if (/elasticsearch|opensearch/.test(lower)) return 9200;
	if (/clickhouse/.test(lower)) return 8123;
	return 3000;
}
