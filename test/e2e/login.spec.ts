import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("redirects unauthenticated user to login page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("shows login form with email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /masuk|login|sign/i })).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "wrong@email.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.getByRole("button", { name: /masuk|login|sign/i }).click();
    await expect(page.getByText(/gagal|error|invalid/i)).toBeVisible({ timeout: 10000 });
  });
});
