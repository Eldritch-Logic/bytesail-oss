<script lang="ts">
import { Container, Database, HardDrive, Network, TriangleAlert } from "@lucide/svelte";
import yaml from "js-yaml";

type Props = {
	yamlContent: string;
	class?: string;
};

let { yamlContent, class: className }: Props = $props();

type ParsedService = {
	name: string;
	image?: string;
	hasBuild: boolean;
	ports: string[];
	volumes: string[];
	dependsOn: string[];
	envCount: number;
};

type ParsedVolume = {
	name: string;
	usedBy: string[];
};

type ParseError = string | null;

type ParseResult = {
	services: ParsedService[];
	volumes: ParsedVolume[];
	error: ParseError;
};

let debouncedYaml = $state("");
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

$effect(() => {
	const current = yamlContent;
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		debouncedYaml = current;
	}, 500);
});

const parsed = $derived(parseYaml(debouncedYaml));

function parseYaml(content: string): ParseResult {
	if (!content.trim()) return { services: [], volumes: [], error: null };

	try {
		const doc = yaml.load(content) as {
			services?: Record<
				string,
				{
					image?: string;
					build?: unknown;
					ports?: Array<string | number>;
					volumes?: string[];
					depends_on?: string[] | Record<string, unknown>;
					environment?: Record<string, string> | string[];
				}
			>;
			volumes?: Record<string, unknown>;
		};

		if (!doc?.services) return { services: [], volumes: [], error: "No 'services' key found" };

		const services: ParsedService[] = Object.entries(doc.services).map(([name, svc]) => {
			const deps = Array.isArray(svc.depends_on)
				? svc.depends_on
				: svc.depends_on
					? Object.keys(svc.depends_on)
					: [];

			const envCount = svc.environment
				? Array.isArray(svc.environment)
					? svc.environment.length
					: Object.keys(svc.environment).length
				: 0;

			return {
				name,
				image: svc.image,
				hasBuild: !!svc.build,
				ports: (svc.ports ?? []).map(String),
				volumes: svc.volumes ?? [],
				dependsOn: deps,
				envCount,
			};
		});

		// Parse named volumes
		const namedVolumeNames = new Set(Object.keys(doc.volumes ?? {}));

		// Also detect named volumes from service volume mounts (name:path format, not ./path:path)
		for (const svc of services) {
			for (const vol of svc.volumes) {
				const parts = vol.split(":");
				if (parts.length >= 2 && !parts[0].startsWith(".") && !parts[0].startsWith("/")) {
					namedVolumeNames.add(parts[0]);
				}
			}
		}

		const volumes: ParsedVolume[] = [...namedVolumeNames].map((volName) => ({
			name: volName,
			usedBy: services
				.filter((s) => s.volumes.some((v) => v.startsWith(`${volName}:`)))
				.map((s) => s.name),
		}));

		return { services, volumes, error: null };
	} catch (e) {
		let errorMsg = "Invalid YAML";
		if (e instanceof yaml.YAMLException) {
			const line = e.mark?.line != null ? e.mark.line + 1 : null;
			const reason = e.reason ?? e.message;
			errorMsg = line ? `Line ${line}: ${reason}` : reason;
		} else if (e instanceof Error) {
			errorMsg = e.message;
		}
		return { services: [], volumes: [], error: errorMsg };
	}
}

const connections = $derived(
	parsed.services.flatMap((s) => s.dependsOn.map((dep) => ({ from: s.name, to: dep }))),
);
</script>

<div class="rounded-lg border border-border bg-muted/30 p-4 {className ?? ''}">
	<h4 class="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Stack Topology</h4>

	{#if parsed.error}
		<div class="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/5 p-3">
			<TriangleAlert class="mt-0.5 size-4 shrink-0 text-destructive" />
			<div>
				<p class="text-xs font-medium text-destructive">YAML Error</p>
				<p class="mt-0.5 text-xs text-destructive/80">{parsed.error}</p>
			</div>
		</div>
	{:else if parsed.services.length === 0}
		<p class="text-xs text-muted-foreground">Add services to see the topology</p>
	{:else}
		<div class="space-y-2">
			{#each parsed.services as svc}
				<div class="rounded-md border border-border bg-background p-3 transition-all">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<div class="rounded bg-primary/10 p-1">
								<Container class="size-3.5 text-primary" />
							</div>
							<span class="text-sm font-medium">{svc.name}</span>
						</div>
						<div class="flex items-center gap-1">
							{#if svc.image}
								<span class="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">{svc.image}</span>
							{:else if svc.hasBuild}
								<span class="rounded bg-primary/10 px-1.5 py-0.5 text-2xs text-primary">build</span>
							{/if}
						</div>
					</div>

					<div class="mt-2 flex flex-wrap gap-2 text-2xs text-muted-foreground">
						{#if svc.ports.length > 0}
							<span class="flex items-center gap-1">
								<Network class="size-3" />
								{svc.ports.join(", ")}
							</span>
						{/if}
						{#if svc.volumes.length > 0}
							<span class="flex items-center gap-1">
								<HardDrive class="size-3" />
								{svc.volumes.length} vol
							</span>
						{/if}
						{#if svc.envCount > 0}
							<span class="flex items-center gap-1">
								<Database class="size-3" />
								{svc.envCount} env
							</span>
						{/if}
					</div>

					{#if svc.dependsOn.length > 0}
						<div class="mt-2 flex items-center gap-1 text-2xs">
							<span class="text-muted-foreground">depends on:</span>
							{#each svc.dependsOn as dep}
								<span class="rounded border border-border bg-muted px-1.5 py-0.5 font-medium">{dep}</span>
							{/each}
						</div>
					{/if}
				</div>
			{/each}

			{#if connections.length > 0}
				<div class="mt-3 border-t border-border pt-3">
					<h5 class="mb-2 text-2xs font-medium text-muted-foreground uppercase tracking-wider">Connections</h5>
					<div class="space-y-1">
						{#each connections as conn}
							<div class="flex items-center gap-2 text-2xs text-muted-foreground">
								<span class="font-medium text-foreground">{conn.from}</span>
								<span>→</span>
								<span class="font-medium text-foreground">{conn.to}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if parsed.volumes.length > 0}
				<div class="mt-3 border-t border-border pt-3">
					<h5 class="mb-2 text-2xs font-medium text-muted-foreground uppercase tracking-wider">Volumes</h5>
					<div class="space-y-2">
						{#each parsed.volumes as vol}
							<div class="rounded-md border border-border bg-background p-2.5">
								<div class="flex items-center gap-2">
									<div class="rounded bg-amber-500/10 p-1">
										<HardDrive class="size-3 text-amber-500" />
									</div>
									<span class="text-sm font-medium">{vol.name}</span>
								</div>
								{#if vol.usedBy.length > 0}
									<div class="mt-1.5 flex items-center gap-1 text-2xs">
										<span class="text-muted-foreground">used by:</span>
										{#each vol.usedBy as svc}
											<span class="rounded border border-border bg-muted px-1.5 py-0.5 font-medium">{svc}</span>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
