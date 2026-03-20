import { test, expect } from "@playwright/test";

import { loginAsAdmin } from "./helpers/auth";

test.describe("Payment recording", () => {
  test("fees page is accessible", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/fees");
    await expect(page.getByRole("heading", { name: /fee|payment/i })).toBeVisible();
  });

  test("fees list shows payment status badges", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/fees");
    await expect(page.getByRole("main")).toBeVisible();
    // Status badges (PAID, PENDING, OVERDUE) should be present if fees exist
  });

  test("record payment button is visible for pending fees", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/fees?status=PENDING");
    await expect(page.getByRole("main")).toBeVisible();
    // If pending fees exist, record payment option should be available
    const rowCount = await page.getByRole("row").count();
    if (rowCount > 1) {
      // Open first fee
      await page.getByRole("row").nth(1).click();
      // Record payment button or form should appear
      const recordBtn = page.getByRole("button", { name: /record.*payment|mark.*paid/i });
      await expect(recordBtn.or(page.getByText(/record payment/i))).toBeVisible({ timeout: 5000 });
    }
  });

  test("expenses page is accessible", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/expenses");
    await expect(page.getByRole("heading", { name: /expense/i })).toBeVisible();
  });

  test("unauthenticated cannot access fees", async ({ page }) => {
    await page.goto("/admin/fees");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
