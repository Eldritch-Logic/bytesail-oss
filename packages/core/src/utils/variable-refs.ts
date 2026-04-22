import { db } from "@bytesail/db";
import { services, variables } from "@bytesail/db/schema";
import { and, eq } from "drizzle-orm";

const REF_PATTERN = /\$\{([A-Za-z0-9_-]+)\.([A-Za-z0-9_]+)\}/g;

export function hasReferences(value: string): boolean {
	return REF_PATTERN.test(value);
}

export function parseReferences(value: string): Array<{ serviceSlug: string; varKey: string }> {
	const refs: Array<{ serviceSlug: string; varKey: string }> = [];
	const pattern = new RegExp(REF_PATTERN.source, "g");

	for (const match of value.matchAll(pattern)) {
		refs.push({ serviceSlug: match[1], varKey: match[2] });
	}

	return refs;
}

export async function resolveReferences(
	value: string,
	projectId: string,
	environmentId: string,
): Promise<string> {
	const refs = parseReferences(value);
	if (refs.length === 0) return value;

	let resolved = value;

	for (const ref of refs) {
		const [service] = await db
			.select()
			.from(services)
			.where(and(eq(services.projectId, projectId), eq(services.slug, ref.serviceSlug)));

		if (!service) continue;

		const [variable] = await db
			.select()
			.from(variables)
			.where(
				and(
					eq(variables.serviceId, service.id),
					eq(variables.environmentId, environmentId),
					eq(variables.key, ref.varKey),
				),
			);

		if (variable) {
			resolved = resolved.replace(`\${${ref.serviceSlug}.${ref.varKey}}`, variable.value);
		}
	}

	return resolved;
}
