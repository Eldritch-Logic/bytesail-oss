const REGISTRY_URL = process.env.REGISTRY_URL ?? "localhost:30500";
const REGISTRY_INTERNAL_URL = "registry.bytesail-system.svc.cluster.local:5000";

type ImageInfo = {
	name: string;
	tags: string[];
};

export async function listImages(): Promise<ImageInfo[]> {
	const res = await fetch(`http://${REGISTRY_URL}/v2/_catalog`);
	if (!res.ok) return [];

	const { repositories } = (await res.json()) as { repositories: string[] };
	const images: ImageInfo[] = [];

	for (const name of repositories ?? []) {
		const tagsRes = await fetch(`http://${REGISTRY_URL}/v2/${name}/tags/list`);
		if (!tagsRes.ok) continue;
		const { tags } = (await tagsRes.json()) as { tags: string[] | null };
		images.push({ name, tags: tags ?? [] });
	}

	return images;
}

export async function deleteImage(name: string, tag: string): Promise<boolean> {
	const digestRes = await fetch(`http://${REGISTRY_URL}/v2/${name}/manifests/${tag}`, {
		headers: { Accept: "application/vnd.docker.distribution.manifest.v2+json" },
	});

	if (!digestRes.ok) return false;

	const digest = digestRes.headers.get("Docker-Content-Digest");
	if (!digest) return false;

	const deleteRes = await fetch(`http://${REGISTRY_URL}/v2/${name}/manifests/${digest}`, {
		method: "DELETE",
	});

	return deleteRes.ok;
}

export function getRegistryUrl(): string {
	return REGISTRY_URL;
}

export function getRegistryInternalUrl(): string {
	return REGISTRY_INTERNAL_URL;
}

export function imageTag(projectSlug: string, serviceSlug: string, version: number): string {
	return `${projectSlug}/${serviceSlug}:v${version}`;
}

export function fullImageUrl(projectSlug: string, serviceSlug: string, version: number): string {
	return `${REGISTRY_URL}/${imageTag(projectSlug, serviceSlug, version)}`;
}
