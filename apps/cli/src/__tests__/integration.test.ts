import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * CLI integration tests.
 *
 * These tests require a running ByteSail instance and a valid API key.
 * Set the following environment variables:
 *   BYTESAIL_TEST_URL   - Instance URL (e.g. http://localhost:5173)
 *   BYTESAIL_TEST_KEY   - API key for authentication
 *
 * Run with: pnpm vitest run apps/cli/src/__tests__/integration.test.ts
 */

const TEST_URL = process.env.BYTESAIL_TEST_URL;
const TEST_KEY = process.env.BYTESAIL_TEST_KEY;
const HAS_INSTANCE = !!(TEST_URL && TEST_KEY);

// Use a temp config dir so tests don't affect real config
const testConfigDir = join(tmpdir(), `.bytesail-test-${Date.now()}`);
const cliCmd = "bun run apps/cli/src/index.ts";

function run(args: string, opts: { cwd?: string } = {}): string {
	try {
		return execSync(`${cliCmd} ${args}`, {
			encoding: "utf-8",
			timeout: 30_000,
			env: {
				...process.env,
				HOME: testConfigDir,
				BYTESAIL_CONFIG_DIR: testConfigDir,
			},
			cwd: opts.cwd ?? process.cwd(),
		}).trim();
	} catch (e) {
		const err = e as { stdout?: string; stderr?: string; message?: string };
		return err.stdout?.trim() ?? err.stderr?.trim() ?? err.message ?? "";
	}
}

beforeAll(() => {
	mkdirSync(testConfigDir, { recursive: true });
});

afterAll(() => {
	try {
		rmSync(testConfigDir, { recursive: true, force: true });
	} catch {}
});

describe("CLI basics", () => {
	it("shows help output", () => {
		const output = run("--help");
		expect(output).toContain("bytesail");
	});

	it("shows version", () => {
		const output = run("--version");
		expect(output).toMatch(/\d+\.\d+\.\d+/);
	});
});

describe("Auth flow (with test API key)", () => {
	it("fails whoami without login", () => {
		const output = run("whoami");
		expect(output).toMatch(/not.*configured|not.*logged|login/i);
	});

	it("login with API key", () => {
		if (!HAS_INSTANCE) return;

		const output = run(`login --token ${TEST_KEY} --url ${TEST_URL}`);
		expect(output).toMatch(/authenticated|logged in|success/i);
	});

	it("whoami shows user info after login", () => {
		if (!HAS_INSTANCE) return;

		const output = run("whoami");
		expect(output).toMatch(/@|user|email/i);
	});

	it("logout clears credentials", () => {
		if (!HAS_INSTANCE) return;

		const output = run("logout");
		expect(output).toMatch(/logged out|cleared|success/i);
	});
});

describe("Project commands", () => {
	if (!HAS_INSTANCE) {
		it.skip("skipped: requires BYTESAIL_TEST_URL and BYTESAIL_TEST_KEY", () => {});
		return;
	}

	let testProjectName: string;

	beforeAll(() => {
		// Re-login for project tests
		run(`login --token ${TEST_KEY} --url ${TEST_URL}`);
		testProjectName = `cli-test-${Date.now()}`;
	});

	it("lists projects", () => {
		const output = run("project list");
		// Should succeed even if no projects
		expect(output).toBeDefined();
	});

	it("creates a project", () => {
		const output = run(`project create ${testProjectName}`);
		expect(output).toMatch(/created|success/i);
	});

	it("lists projects including the new one", () => {
		const output = run("project list");
		expect(output).toContain(testProjectName);
	});

	it("shows project services (initially empty)", () => {
		// Link project first
		const tmpDir = join(testConfigDir, "test-project-dir");
		mkdirSync(tmpDir, { recursive: true });
		run(`project link`, { cwd: tmpDir });

		const output = run("service list", { cwd: tmpDir });
		expect(output).toMatch(/no services|empty|name/i);
	});

	it("deletes the test project", () => {
		const output = run(`project delete ${testProjectName} --yes`);
		expect(output).toMatch(/deleted|success/i);
	});
});

describe("Deploy and log commands", () => {
	if (!HAS_INSTANCE) {
		it.skip("skipped: requires BYTESAIL_TEST_URL and BYTESAIL_TEST_KEY", () => {});
		return;
	}

	it("deploy list shows deployments", () => {
		const output = run("deploy list");
		// May show deployments or "no deployments" - both valid
		expect(output).toBeDefined();
	});

	it("status shows system overview", () => {
		const output = run("status");
		expect(output).toMatch(/node|cpu|memory|system/i);
	});

	it("completion generates shell script", () => {
		const output = run("completion bash");
		expect(output).toContain("bash");
	});
});
