import { describe, expect, it } from "vitest";
import { detectPort, detectServiceType } from "../compose-utils.js";

describe("detectServiceType", () => {
	it("detects postgres as database", () => {
		expect(detectServiceType("db", "postgres:16")).toBe("database");
	});

	it("detects mysql as database", () => {
		expect(detectServiceType("db", "mysql:8")).toBe("database");
	});

	it("detects mariadb as database", () => {
		expect(detectServiceType("db", "mariadb:11")).toBe("database");
	});

	it("detects mongo as database", () => {
		expect(detectServiceType("db", "mongo:7")).toBe("database");
	});

	it("detects redis as redis", () => {
		expect(detectServiceType("cache", "redis:7-alpine")).toBe("redis");
	});

	it("detects keydb as redis", () => {
		expect(detectServiceType("cache", "eqalpha/keydb:latest")).toBe("redis");
	});

	it("detects valkey as redis", () => {
		expect(detectServiceType("cache", "valkey/valkey:8")).toBe("redis");
	});

	it("defaults to app for unknown images", () => {
		expect(detectServiceType("web", "node:20")).toBe("app");
	});

	it("falls back to name when no image", () => {
		expect(detectServiceType("postgres")).toBe("database");
	});

	it("defaults to app when name is generic", () => {
		expect(detectServiceType("web")).toBe("app");
	});
});

describe("detectPort", () => {
	it("extracts port from compose ports mapping", () => {
		expect(detectPort("node:20", ["8080:3000"])).toBe(3000);
	});

	it("extracts port from single number port", () => {
		expect(detectPort("node:20", [3000])).toBe(3000);
	});

	it("uses container port (last part) from mapping", () => {
		expect(detectPort("nginx", ["80:80"])).toBe(80);
	});

	it("auto-detects postgres port", () => {
		expect(detectPort("postgres:16-alpine")).toBe(5432);
	});

	it("auto-detects mysql port", () => {
		expect(detectPort("mysql:8")).toBe(3306);
	});

	it("auto-detects redis port", () => {
		expect(detectPort("redis:7")).toBe(6379);
	});

	it("auto-detects mongo port", () => {
		expect(detectPort("mongo:7")).toBe(27017);
	});

	it("auto-detects nginx port", () => {
		expect(detectPort("nginx:latest")).toBe(80);
	});

	it("auto-detects minio port", () => {
		expect(detectPort("minio/minio:latest")).toBe(9000);
	});

	it("auto-detects elasticsearch port", () => {
		expect(detectPort("elasticsearch:8")).toBe(9200);
	});

	it("defaults to 3000 for unknown images", () => {
		expect(detectPort("myapp:latest")).toBe(3000);
	});

	it("defaults to 3000 with no image", () => {
		expect(detectPort()).toBe(3000);
	});

	it("prefers explicit ports over auto-detection", () => {
		expect(detectPort("postgres:16", ["5433:5432"])).toBe(5432);
	});
});
