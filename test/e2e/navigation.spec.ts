import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("tracking page shows token input form", async ({ page }) => {
    await page.goto("/tracking/test-token");
    await expect(page.locator("text=Track Service").or(page.locator('input[placeholder*="token" i]'))).toBeVisible({ timeout: 10000 });
  });

  test("404 page works for unknown routes", async ({ page }) => {
    await page.goto("/nonexistent-route-xyz");
    await expect(page.locator("text=404").or(page.locator("text=tidak ditemukan"))).toBeVisible({ timeout: 10000 });
  });

  test("root route redirects based on auth state", async ({ page }) => {
    await page.goto("/");
    // Should redirect to /login since not authenticated
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });
});
