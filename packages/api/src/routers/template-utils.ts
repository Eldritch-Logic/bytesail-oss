import crypto from "node:crypto";

export function resolveTemplateVar(value: string, formValues: Record<string, string>): string {
	return value.replace(/\{\{([^}]+)\}\}/g, (_, expr: string) => {
		const parts = expr.split("|");
		const varName = parts[0].trim();

		// Check form values first
		if (formValues[varName]) return formValues[varName];

		// Process directives
		for (let i = 1; i < parts.length; i++) {
			const directive = parts[i].trim();

			if (directive.startsWith("default:")) {
				return directive.slice(8);
			}

			if (directive.startsWith("generate:")) {
				const genParts = directive.split(":");
				const genType = genParts[1];
				const genLength = parseInt(genParts[2] ?? "24", 10);

				if (genType === "password") {
					return crypto.randomBytes(genLength).toString("base64url").slice(0, genLength);
				}
				if (genType === "hex") {
					return crypto.randomBytes(genLength / 2).toString("hex");
				}
				if (genType === "uuid") {
					return crypto.randomUUID();
				}
			}
		}

		return formValues[varName] ?? "";
	});
}
