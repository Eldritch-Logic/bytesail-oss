import { describe, expect, it } from "vitest";
import { resolveTemplateVar } from "../template-utils.js";

describe("resolveTemplateVar", () => {
	it("replaces variable with form value", () => {
		expect(resolveTemplateVar("{{DB_USER}}", { DB_USER: "admin" })).toBe("admin");
	});

	it("applies default when no form value", () => {
		expect(resolveTemplateVar("{{DB_NAME|default:mydb}}", {})).toBe("mydb");
	});

	it("form value takes precedence over default", () => {
		expect(resolveTemplateVar("{{DB_NAME|default:mydb}}", { DB_NAME: "custom" })).toBe("custom");
	});

	it("generates a password of specified length", () => {
		const result = resolveTemplateVar("{{PASS|generate:password:24}}", {});
		expect(result).toHaveLength(24);
	});

	it("generates a hex string of specified length", () => {
		const result = resolveTemplateVar("{{KEY|generate:hex:32}}", {});
		expect(result).toHaveLength(32);
		expect(result).toMatch(/^[0-9a-f]+$/);
	});

	it("generates a UUID", () => {
		const result = resolveTemplateVar("{{ID|generate:uuid}}", {});
		expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
	});

	it("resolves multiple variables in one string", () => {
		const result = resolveTemplateVar(
			"postgres://{{USER|default:app}}:{{PASS|default:secret}}@db:5432/{{DB|default:main}}",
			{},
		);
		expect(result).toBe("postgres://app:secret@db:5432/main");
	});

	it("returns empty string for unknown variable with no directive", () => {
		expect(resolveTemplateVar("{{UNKNOWN}}", {})).toBe("");
	});

	it("leaves non-template text untouched", () => {
		expect(resolveTemplateVar("hello world", {})).toBe("hello world");
	});

	it("handles adjacent template variables", () => {
		expect(resolveTemplateVar("{{A|default:x}}{{B|default:y}}", {})).toBe("xy");
	});
});
