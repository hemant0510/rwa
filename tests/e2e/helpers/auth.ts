import { Page } from "@playwright/test";

export const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "admin@eden.test";
export const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "test-password-123";
export const RESIDENT_EMAIL = process.env.TEST_RESIDENT_EMAIL ?? "resident@eden.test";
export const RESIDENT_PASSWORD = process.env.TEST_RESIDENT_PASSWORD ?? "test-password-123";

export async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/admin/dashboard", { timeout: 15_000 });
}

export async function loginAsResident(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', RESIDENT_EMAIL);
  await page.fill('input[type="password"]', RESIDENT_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/r/home", { timeout: 15_000 });
}

export async function logout(page: Page) {
  // Navigate to login directly — clears session
  await page.goto("/login");
}
