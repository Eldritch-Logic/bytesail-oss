import { describe, expect, it } from "vitest";
import { slugify } from "../slug.js";

describe("slugify", () => {
	it("converts to lowercase", () => {
		expect(slugify("Hello World")).toBe("hello-world");
	});

	it("replaces spaces with hyphens", () => {
		expect(slugify("my cool project")).toBe("my-cool-project");
	});

	it("replaces underscores with hyphens", () => {
		expect(slugify("my_project_name")).toBe("my-project-name");
	});

	it("removes special characters", () => {
		expect(slugify("hello@world!")).toBe("helloworld");
	});

	it("collapses multiple hyphens", () => {
		expect(slugify("hello---world")).toBe("hello-world");
	});

	it("trims leading and trailing hyphens", () => {
		expect(slugify("-hello-world-")).toBe("hello-world");
	});

	it("handles mixed input", () => {
		expect(slugify("  My App (v2.0)  ")).toBe("my-app-v20");
	});

	it("handles empty string", () => {
		expect(slugify("")).toBe("");
	});

	it("handles already-valid slugs", () => {
		expect(slugify("my-project")).toBe("my-project");
	});

	it("converts tabs and newlines to hyphens", () => {
		expect(slugify("hello\tworld\nfoo")).toBe("hello-world-foo");
	});
});
