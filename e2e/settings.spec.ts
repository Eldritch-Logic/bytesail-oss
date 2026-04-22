import { expect, test } from "@playwright/test";

test.describe("Settings pages", () => {
	test.skip(
		!process.env.PLAYWRIGHT_STORAGE_STATE,
		"Skipped: requires authenticated session (set PLAYWRIGHT_STORAGE_STATE)",
	);

	test.use({ storageState: process.env.PLAYWRIGHT_STORAGE_STATE ?? undefined });

	test("shows settings navigation", async ({ page }) => {
		await page.goto("/settings");
		await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
		await expect(page.getByRole("link", { name: "General" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Git" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Notifications" })).toBeVisible();
		await expect(page.getByRole("link", { name: "API Keys" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Audit Log" })).toBeVisible();
	});

	test("navigates to notifications settings", async ({ page }) => {
		await page.goto("/settings/notifications");
		await expect(page.getByText(/notification/i)).toBeVisible();
	});

	test("navigates to API keys settings", async ({ page }) => {
		await page.goto("/settings/api-keys");
		await expect(page.getByText(/api key/i)).toBeVisible();
	});

	test("navigates to audit log", async ({ page }) => {
		await page.goto("/settings/audit-log");
		await expect(page.getByText(/audit log/i)).toBeVisible();
	});

	test("navigates to organization settings", async ({ page }) => {
		await page.goto("/settings/organization");
		await expect(page.getByText(/organization/i)).toBeVisible();
	});
});
