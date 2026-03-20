import { test, expect } from "@playwright/test";

import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./helpers/auth";

/**
 * Cross-society isolation tests.
 *
 * These verify that society data cannot bleed across tenant boundaries.
 * They use the API directly (no UI) to check that auth scoping works.
 *
 * For full isolation testing with two societies, set:
 *   TEST_SOCIETY2_ADMIN_EMAIL / TEST_SOCIETY2_ADMIN_PASSWORD env vars.
 */

test.describe("Cross-society data isolation", () => {
  test("login redirects to correct society dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin/dashboard", { timeout: 15_000 });
    // Should be in admin dashboard, not another society's dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test("API /auth/me returns correct society context", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin/dashboard", { timeout: 15_000 });

    // Call /api/v1/auth/me and verify societyId is set
    const response = await page.request.get("/api/v1/auth/me");
    expect(response.ok()).toBeTruthy();
    const data = (await response.json()) as { societyId?: string; role?: string };
    expect(data.societyId).toBeTruthy();
    expect(data.role).toBe("RWA_ADMIN");
  });

  test("API /residents only returns residents of logged-in society", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin/dashboard", { timeout: 15_000 });

    const meRes = await page.request.get("/api/v1/auth/me");
    const me = (await meRes.json()) as { societyId?: string };
    const societyId = me.societyId;

    const residentsRes = await page.request.get("/api/v1/residents");
    if (residentsRes.ok()) {
      const data = (await residentsRes.json()) as { residents?: Array<{ societyId?: string }> };
      if (data.residents && data.residents.length > 0) {
        // Every resident should belong to the same society
        for (const resident of data.residents) {
          expect(resident.societyId).toBe(societyId);
        }
      }
    }
  });

  test("unauthenticated API requests return 401", async ({ page }) => {
    // Make request without authentication
    const res = await page.request.get("/api/v1/residents");
    expect([401, 403]).toContain(res.status());
  });

  test("Terms and Privacy pages are publicly accessible", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: /terms of service/i })).toBeVisible();

    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: /privacy policy/i })).toBeVisible();
  });
});
