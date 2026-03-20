import { test, expect } from "@playwright/test";

import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAsAdmin } from "./helpers/auth";

test.describe("Admin login", () => {
  test("shows login page with required fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "RWA Connect" })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "wrong@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    // Should show an error toast or stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects admin to dashboard on valid login", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByText(/dashboard/i).first()).toBeVisible();
  });

  test("login page has links to terms and privacy", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: /terms of service/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /privacy policy/i })).toBeVisible();
  });

  test("rate limit shows after too many attempts", async ({ page }) => {
    await page.goto("/login");
    // Submit with wrong password 5 times — 6th should be rate-limited
    for (let i = 0; i < 5; i++) {
      await page.fill('input[type="email"]', ADMIN_EMAIL);
      await page.fill('input[type="password"]', "wrong-password-attempt");
      await page.click('button[type="submit"]');
      await page.waitForTimeout(300);
    }
    // After 5 wrong attempts the 6th should show rate limit or error
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    // Either rate limited toast or login error — we just verify we're still on login
    await expect(page).toHaveURL(/\/login/);
  });
});
