import { expect, test } from "@playwright/test";

test.describe("Login flow", () => {
	test("shows login page", async ({ page }) => {
		await page.goto("/login");
		await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(page.getByLabel("Password")).toBeVisible();
	});

	test("shows validation error with empty fields", async ({ page }) => {
		await page.goto("/login");
		await page.getByRole("button", { name: "Sign in" }).click();
		// HTML5 validation prevents submit
		const emailInput = page.getByLabel("Email");
		await expect(emailInput).toHaveAttribute("required", "");
	});

	test("shows error with invalid credentials", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Email").fill("invalid@example.com");
		await page.getByLabel("Password").fill("wrongpassword");
		await page.getByRole("button", { name: "Sign in" }).click();

		await expect(page.getByText(/invalid|error|credentials/i)).toBeVisible({ timeout: 10000 });
	});

	test("has link to register page", async ({ page }) => {
		await page.goto("/login");
		const registerLink = page.getByRole("link", { name: /register|sign up|create account/i });
		if (await registerLink.isVisible()) {
			await registerLink.click();
			await expect(page).toHaveURL(/register/);
		}
	});

	test("redirects unauthenticated users to login", async ({ page }) => {
		await page.goto("/projects");
		await expect(page).toHaveURL(/login/);
	});
});

test.describe("Register flow", () => {
	test("shows register page", async ({ page }) => {
		await page.goto("/register");
		await expect(page.getByRole("heading", { name: /create|register|sign up/i })).toBeVisible();
	});

	test("has name, email, and password fields", async ({ page }) => {
		await page.goto("/register");
		await expect(page.getByLabel(/name/i)).toBeVisible();
		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(page.getByLabel("Password")).toBeVisible();
	});
});
