# Testing & Monitoring Guide

## Table of Contents

1. [Running Playwright E2E Tests](#1-playwright-e2e-tests)
2. [Viewing Sentry Error Logs](#2-sentry-error-monitoring)

---

## 1. Playwright E2E Tests

### What's Covered

| Spec File                            | What It Tests                                               |
| ------------------------------------ | ----------------------------------------------------------- |
| `01-admin-login.spec.ts`             | Login UI, invalid credentials, rate limit (429)             |
| `02-resident-registration.spec.ts`   | Registration form validation, mobile masking                |
| `03-resident-approval.spec.ts`       | Pending residents, approve button, unauthenticated redirect |
| `04-payment-recording.spec.ts`       | Fees page, record payment, expenses, unauthenticated access |
| `05-cross-society-isolation.spec.ts` | Society scoping via API, Terms/Privacy public access        |

---

### One-time Setup

**Step 1 — Install Playwright browsers** (only needed once)

```bash
npx playwright install chromium
```

**Step 2 — Set test credentials**

Create a `.env.test.local` file in the project root (or set in your shell):

```env
TEST_ADMIN_EMAIL=admin@yoursociety.com
TEST_ADMIN_PASSWORD=your-admin-password
PLAYWRIGHT_BASE_URL=http://localhost:3000
```

These credentials must belong to an **active RWA_ADMIN** user in the dev/staging database.

---

### Running the Tests

**Start the dev server first** (in a separate terminal):

```bash
npm run dev
```

Then run E2E tests:

```bash
# Run all E2E specs headlessly
npm run test:e2e

# Open Playwright UI (interactive mode — recommended for debugging)
npm run test:e2e:ui

# Run a single spec file
npx playwright test tests/e2e/01-admin-login.spec.ts

# Run in headed mode (see the browser)
npx playwright test --headed

# Debug a specific test step-by-step
npx playwright test --debug tests/e2e/03-resident-approval.spec.ts
```

> **Note:** The dev server auto-starts when running locally (`webServer` config in `playwright.config.ts`), so you don't need to start it manually if you use `npm run test:e2e`. However, starting it first is faster.

---

### Reading the Results

After a run, Playwright generates an HTML report:

```bash
# View the HTML report in your browser
npx playwright show-report
```

The report is saved to `playwright-report/index.html`. It includes:

- Pass / fail counts per spec
- Screenshots on failure
- Full trace viewer (step-by-step actions) on retry failures

**Console output example:**

```
Running 5 tests using 1 worker

  ✓ 01-admin-login.spec.ts:12:3 › shows login page with required fields (1.2s)
  ✓ 01-admin-login.spec.ts:19:3 › shows error for invalid credentials (2.1s)
  ✓ 01-admin-login.spec.ts:27:3 › redirects admin to dashboard on valid login (3.4s)
  ✗ 03-resident-approval.spec.ts:52:3 › approve button is present for pending residents (5.0s)

  1 failed
```

---

### Debugging Failed Tests

```bash
# Re-run only failed tests
npx playwright test --last-failed

# Open the trace viewer for a failed test
npx playwright show-report
# Click the failed test → click "Traces" → step through actions

# Add a pause in the test (add to the spec file temporarily):
await page.pause(); // opens Playwright Inspector
```

---

### CI/CD

In CI, set:

```env
CI=true
TEST_ADMIN_EMAIL=...
TEST_ADMIN_PASSWORD=...
PLAYWRIGHT_BASE_URL=https://your-staging-url.vercel.app
```

The config disables `webServer` in CI (uses the deployed URL instead) and enables 1 retry per test.

---

## 2. Sentry Error Monitoring

### Setup (Production / Staging)

**Step 1 — Create a Sentry project**

1. Go to [sentry.io](https://sentry.io) → Create Account (free tier works)
2. Create a new project → Platform: **Next.js**
3. Copy your **DSN** (looks like `https://abc123@o123456.ingest.sentry.io/789`)

**Step 2 — Set environment variables**

In your hosting provider (Vercel → Settings → Environment Variables) or `.env.local`:

```env
# Required — enables Sentry in production
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@o123456.ingest.sentry.io/789

# Required in CI for source map uploads (so stack traces show real file names)
SENTRY_AUTH_TOKEN=your-sentry-auth-token
SENTRY_ORG=your-sentry-org-slug
SENTRY_PROJECT=your-sentry-project-slug
```

> Sentry is **disabled in development** (`NODE_ENV !== "production"`). You will not see events locally unless you temporarily change the config.

**Step 3 — Deploy**

After setting env vars, your next deployment will automatically:

- Capture unhandled exceptions (server + client)
- Capture unhandled promise rejections
- Upload source maps so errors show the original TypeScript line numbers

---

### Viewing Errors in Sentry

1. Go to **sentry.io** → your project
2. Click **Issues** in the left sidebar

**What you see:**

| Column     | Meaning                           |
| ---------- | --------------------------------- |
| Title      | Error message + file name         |
| Events     | How many times it occurred        |
| Users      | How many users were affected      |
| First seen | When the bug was first introduced |
| Last seen  | Most recent occurrence            |

**Clicking an issue shows:**

- Full **stack trace** with your original TypeScript line numbers (from source maps)
- **Breadcrumbs** — what the user did just before the error (clicks, API calls, navigation)
- **Request details** — URL, method, status code
- **User context** — browser, OS
- **Environment** — production vs staging

---

### Key Views

**Issues → Unresolved** — all active bugs, sorted by frequency.

**Performance** → Transaction traces — slow API routes (P95 latency, etc.)

**Alerts** — configure to send email/Slack when a new issue appears or error rate spikes.

**Releases** — tag deployments so you can see which deploy introduced a bug:

```bash
# Add to your deploy pipeline
SENTRY_RELEASE=$(git rev-parse --short HEAD)
```

---

### Manually Capturing Errors

If you want to capture a non-fatal error (e.g., email sending failure) explicitly:

```typescript
import * as Sentry from "@sentry/nextjs";

try {
  await sendEmail(...);
} catch (err) {
  // Log it but don't throw — email is best-effort
  Sentry.captureException(err, {
    extra: { context: "welcome email", email: user.email },
  });
}
```

---

### Test That Sentry Is Working

After deploying with a valid DSN, trigger a test error:

```bash
# Hit the Sentry test endpoint (built-in to @sentry/nextjs)
curl https://your-app.vercel.app/api/sentry-example-api
```

Or add a temporary error to any API route:

```typescript
throw new Error("Sentry test error — remove me");
```

The error should appear in Sentry **Issues** within ~30 seconds.

---

### Sentry vs Console Logs

| Situation                                                                 | Use                                    |
| ------------------------------------------------------------------------- | -------------------------------------- |
| Debugging locally                                                         | `console.log` / `console.error`        |
| Non-fatal errors you want to track (email failures, 3rd-party API issues) | `Sentry.captureException()`            |
| Fatal / unhandled errors                                                  | Captured automatically — nothing to do |
| Performance bottlenecks in production                                     | Sentry Performance tab                 |
