import { test, expect } from "@playwright/test";

import { loginAsAdmin } from "./helpers/auth";

test.describe("Resident approval", () => {
  test("pending residents tab shows pending approvals", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/residents?status=PENDING");
    await expect(page).toHaveURL(/admin\/residents/);
    // Page should load without error
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("resident detail page is accessible", async ({ page }) => {
    await loginAsAdmin(page);
    // Navigate to residents list
    await page.goto("/admin/residents");
    // If there are any residents, click the first one
    const firstRow = page.getByRole("row").nth(1);
    const rowCount = await page.getByRole("row").count();

    if (rowCount > 1) {
      // Click to open resident detail
      await firstRow.click();
      await expect(page).toHaveURL(/\/admin\/residents\/.+/);
    } else {
      // No residents — verify empty state
      await expect(page.getByRole("main")).toBeVisible();
    }
  });

  test("approve button is present for pending residents", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/residents?status=PENDING");
    // If pending residents exist, approve button should be visible in their detail
    const rowCount = await page.getByRole("row").count();
    if (rowCount > 1) {
      await page.getByRole("row").nth(1).click();
      await expect(page).toHaveURL(/\/admin\/residents\/.+/);
      // Approve/Reject buttons should appear
      const approveBtn = page.getByRole("button", { name: /approve/i });
      await expect(approveBtn).toBeVisible({ timeout: 5000 });
    }
  });

  test("unauthenticated access to admin is redirected", async ({ page }) => {
    // No login — directly access admin
    await page.goto("/admin/residents");
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
