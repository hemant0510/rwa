import { test, expect } from "@playwright/test";

import { loginAsAdmin } from "./helpers/auth";

test.describe("Resident registration flow", () => {
  test("admin can navigate to resident registration page", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/residents/register");
    await expect(page.getByRole("heading", { name: /register.*resident/i })).toBeVisible();
  });

  test("registration form validates required fields", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/residents/register");

    // Submit without filling in required fields
    const submitBtn = page.getByRole("button", { name: /submit|register|save/i }).first();
    await submitBtn.click();

    // Expect validation messages to appear
    await expect(page.getByText(/required|invalid|please/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("residents list is accessible from sidebar", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/residents");
    await expect(page.getByRole("heading", { name: /residents/i })).toBeVisible();
  });

  test("mobile numbers are masked in resident list", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/residents");
    // Mobile numbers should show XXXXX pattern
    const body = await page.locator("body").innerText();
    // If any mobile is shown, it should be masked (not show raw 10-digit numbers in table)
    const rawMobilePattern = /\b[6-9]\d{9}\b/;
    expect(rawMobilePattern.test(body)).toBe(false);
  });
});
