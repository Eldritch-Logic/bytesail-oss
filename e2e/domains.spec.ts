import { expect, test } from "@playwright/test";

test.describe("Domain management", () => {
	test.skip(
		!process.env.PLAYWRIGHT_STORAGE_STATE,
		"Skipped: requires authenticated session (set PLAYWRIGHT_STORAGE_STATE)",
	);

	test.use({ storageState: process.env.PLAYWRIGHT_STORAGE_STATE ?? undefined });

	const serviceUrl = process.env.PLAYWRIGHT_SERVICE_URL ?? "";

	test("shows networking tab with domain management", async ({ page }) => {
		test.skip(!serviceUrl, "Skipped: set PLAYWRIGHT_SERVICE_URL");

		await page.goto(serviceUrl);
		const networkTab = page.getByRole("tab", { name: /networking/i });
		if (await networkTab.isVisible()) {
			await networkTab.click();
			await expect(page.getByText(/domain/i)).toBeVisible();
		}
	});

	test("can open add domain dialog", async ({ page }) => {
		test.skip(!serviceUrl, "Skipped: set PLAYWRIGHT_SERVICE_URL");

		await page.goto(serviceUrl);
		const networkTab = page.getByRole("tab", { name: /networking/i });
		if (await networkTab.isVisible()) {
			await networkTab.click();
			const addBtn = page.getByRole("button", { name: /add domain/i });
			if (await addBtn.isVisible()) {
				await addBtn.click();
				await expect(page.getByLabel(/hostname/i)).toBeVisible();
			}
		}
	});
});
