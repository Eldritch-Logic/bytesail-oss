import { expect, test } from "@playwright/test";

// These tests require an authenticated session.
// Set PLAYWRIGHT_STORAGE_STATE to a saved auth state file, or
// implement a test login helper before running.

test.describe("Project management", () => {
	test.skip(
		!process.env.PLAYWRIGHT_STORAGE_STATE,
		"Skipped: requires authenticated session (set PLAYWRIGHT_STORAGE_STATE)",
	);

	test.use({ storageState: process.env.PLAYWRIGHT_STORAGE_STATE ?? undefined });

	test("shows projects page", async ({ page }) => {
		await page.goto("/projects");
		await expect(page.getByRole("heading", { name: /projects/i })).toBeVisible();
	});

	test("can open new project dialog", async ({ page }) => {
		await page.goto("/projects");
		await page.getByRole("button", { name: /new project/i }).click();
		await expect(page.getByText(/create.*project|project.*name/i)).toBeVisible();
	});

	test("can create a project", async ({ page }) => {
		await page.goto("/projects");
		await page.getByRole("button", { name: /new project/i }).click();

		const testName = `e2e-test-${Date.now()}`;
		await page.getByLabel(/name/i).first().fill(testName);
		await page.getByRole("button", { name: /create/i }).click();

		// Should navigate to the new project
		await page.waitForURL(/\/projects\//, { timeout: 10000 });
	});

	test("project canvas shows empty state", async ({ page }) => {
		await page.goto("/projects");

		// Click first project card if exists
		const projectCard = page.locator("[href^='/projects/']").first();
		if (await projectCard.isVisible()) {
			await projectCard.click();
			await page.waitForURL(/\/projects\//);
			// Canvas or empty state should be visible
			await expect(
				page
					.getByText(/no services|add service|canvas/i)
					.or(page.locator(".react-flow, [data-testid=canvas]")),
			).toBeVisible({ timeout: 10000 });
		}
	});
});
