import { expect, test } from "@playwright/test";

test.describe("Variable management", () => {
	test.skip(
		!process.env.PLAYWRIGHT_STORAGE_STATE,
		"Skipped: requires authenticated session (set PLAYWRIGHT_STORAGE_STATE)",
	);

	test.use({ storageState: process.env.PLAYWRIGHT_STORAGE_STATE ?? undefined });

	// These tests require a project with at least one service.
	// Set PLAYWRIGHT_SERVICE_URL to the service page URL (e.g. /projects/<id>/services/<id>)

	const serviceUrl = process.env.PLAYWRIGHT_SERVICE_URL ?? "";

	test("shows variable editor on service page", async ({ page }) => {
		test.skip(!serviceUrl, "Skipped: set PLAYWRIGHT_SERVICE_URL");

		await page.goto(serviceUrl);
		// Click Variables tab
		const varsTab = page.getByRole("tab", { name: /variables/i });
		if (await varsTab.isVisible()) {
			await varsTab.click();
			await expect(page.getByText(/key/i)).toBeVisible();
			await expect(page.getByText(/value/i)).toBeVisible();
		}
	});

	test("can add a variable", async ({ page }) => {
		test.skip(!serviceUrl, "Skipped: set PLAYWRIGHT_SERVICE_URL");

		await page.goto(serviceUrl);
		const varsTab = page.getByRole("tab", { name: /variables/i });
		if (await varsTab.isVisible()) {
			await varsTab.click();

			await page.getByPlaceholder("KEY").fill("E2E_TEST_VAR");
			await page.getByPlaceholder("value").fill("test-value");
			await page
				.getByRole("button", { name: /add|plus/i })
				.last()
				.click();

			await expect(page.getByText("E2E_TEST_VAR")).toBeVisible();
		}
	});
});
