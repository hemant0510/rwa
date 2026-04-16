import { test, expect } from "@playwright/test";

// Slow down every action so you can watch it live
test.use({ launchOptions: { slowMo: 800 } });

test.describe("RWA Admin Login — Demo", () => {
  test("login from home page", async ({ page }) => {
    // Step 1: Open the application home page
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Modern RWA Management" })).toBeVisible();
    console.log("✅ Step 1: Home page loaded");

    // Step 2: Click the Sign In button (header)
    await page.getByRole("link", { name: "Sign In" }).first().click();
    await expect(page).toHaveURL(/\/login/);
    console.log("✅ Step 2: Login page opened");

    // Step 3: Enter credentials and submit
    await page.fill("#email", "edentest@gmail.com");
    await page.fill("#password", "eden@1234");
    await page.click('button[type="submit"]');
    console.log("⏳ Step 3: Credentials submitted, waiting for redirect...");

    // Step 4: Verify successful login — should redirect to admin dashboard
    await page.waitForURL("**/admin/dashboard", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    console.log("✅ Step 4: Admin dashboard loaded — login successful!");

    // Pause so you can see the dashboard before the browser closes
    await page.waitForTimeout(5000);
  });
});
