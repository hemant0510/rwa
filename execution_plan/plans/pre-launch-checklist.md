# Pre-Launch Checklist — Eden Estate RWA

**Last updated:** 2026-03-24
**Deployment platform:** Vercel
**Current staging URL:** `https://rwa-gamma.vercel.app`

Work through this document top to bottom. Items marked 🔴 are blockers — the app will break or be insecure without them. Items marked 🟡 are important but won't stop the app from running. Items marked 🟢 are optional improvements.

---

## 1. 🔴 CRON_SECRET — CRITICAL (App Broken Without This)

### Problem

All 6 cron jobs validate a `CRON_SECRET` env var before executing. If this variable is missing or not set, **every cron job returns 403 Forbidden** — fee status transitions, subscription expiry checks, and invoice generation all silently stop working.

The verification code in `src/lib/cron-auth.ts`:

```typescript
export function verifyCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // ← returns false if not set
  const secret = request.headers.get("authorization");
  return secret === `Bearer ${expected}`;
}
```

### Fix

**Step 1 — Generate a secret:**

```bash
openssl rand -base64 32
# Example output: K8mP2xQzR9vL4nY7wJ3cF6hT1eA5uN0s
```

**Step 2 — Add to `.env`:**

```
CRON_SECRET=your-generated-secret-here
```

**Step 3 — Add to `.env.example`:**

```
# Required for cron job authentication (Vercel sends this in Authorization header)
# Generate with: openssl rand -base64 32
CRON_SECRET=
```

**Step 4 — Add to Vercel dashboard:**
Vercel → Project → Settings → Environment Variables → Add `CRON_SECRET`
Set for: Production ✅ Preview ✅ Development ✅

**Step 5 — Verify cron works locally:**

```bash
curl -X POST http://localhost:3000/api/cron/fee-status-activate \
  -H "Authorization: Bearer your-generated-secret-here"
# Should return 200, not 403
```

---

## 2. 🔴 Fee Cron Jobs Not Scheduled in vercel.json

### Problem

Two critical cron jobs are **implemented but never run** because they are missing from `vercel.json`. Fee statuses will never automatically transition:

- `NOT_YET_DUE → PENDING` (session start)
- `PENDING → OVERDUE` (grace period end)

**Current `vercel.json` (incomplete):**

```json
{
  "crons": [
    { "path": "/api/cron/subscription-expiry-check", "schedule": "0 2 * * *" },
    { "path": "/api/cron/trial-expiry-check", "schedule": "0 2 * * *" },
    { "path": "/api/cron/invoice-generation", "schedule": "0 3 * * *" },
    { "path": "/api/cron/overdue-invoice-check", "schedule": "0 4 * * *" }
  ]
}
```

### Fix — Add the two missing fee cron jobs:

```json
{
  "crons": [
    { "path": "/api/cron/subscription-expiry-check", "schedule": "0 2 * * *" },
    { "path": "/api/cron/trial-expiry-check", "schedule": "0 2 * * *" },
    { "path": "/api/cron/invoice-generation", "schedule": "0 3 * * *" },
    { "path": "/api/cron/overdue-invoice-check", "schedule": "0 4 * * *" },
    { "path": "/api/cron/fee-status-activate", "schedule": "0 1 * * *" },
    { "path": "/api/cron/fee-overdue-check", "schedule": "0 5 * * *" }
  ]
}
```

**Why these schedules:**
| Cron | Time | Why |
|------|------|-----|
| `fee-status-activate` | 1 AM daily | Runs before all other jobs; activates new fee sessions |
| `fee-overdue-check` | 5 AM daily | Runs after all billing jobs; marks grace period expiry |

**Verify after deploying:** Vercel → Project → Settings → Cron Jobs — all 6 should appear.

---

## 3. 🔴 Environment Variables — Full Audit

### Currently set in `.env` (confirmed ✅)

| Variable                        | Purpose                                                     |
| ------------------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`                  | Supabase transaction pooler (used by Prisma)                |
| `DIRECT_URL`                    | Supabase direct connection (used by Prisma migrations)      |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public JWT key                           |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase service role key (bypasses RLS — server-side only) |
| `SMTP_HOST`                     | `smtp.gmail.com`                                            |
| `SMTP_PORT`                     | `587`                                                       |
| `SMTP_USER`                     | `rwaconnect360@gmail.com`                                   |
| `SMTP_PASS`                     | Gmail app password                                          |
| `SMTP_FROM`                     | `RWA Connect <rwaconnect360@gmail.com>`                     |
| `NEXT_PUBLIC_APP_URL`           | `https://rwa-gamma.vercel.app`                              |
| `MAX_TRIAL_RESIDENTS`           | `50`                                                        |
| `TRIAL_PERIOD_DAYS`             | `14`                                                        |

### Missing — must add before launch

| Variable                   | Where to get it                                     | Priority               |
| -------------------------- | --------------------------------------------------- | ---------------------- |
| `CRON_SECRET`              | Generate: `openssl rand -base64 32`                 | 🔴 Critical            |
| `NEXT_PUBLIC_SENTRY_DSN`   | Sentry dashboard → Project → Settings → Client Keys | 🟡 Important           |
| `SENTRY_AUTH_TOKEN`        | Sentry → Settings → Auth Tokens → Create            | 🟡 Important           |
| `WATI_API_URL`             | WATI dashboard → API → Endpoint                     | 🟡 When WhatsApp ready |
| `WATI_API_KEY`             | WATI dashboard → API → Access Token                 | 🟡 When WhatsApp ready |
| `UPSTASH_REDIS_REST_URL`   | Upstash console → Database → REST API               | 🟢 Optional            |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash console → Database → REST API               | 🟢 Optional            |

### For production — update these values:

| Variable              | Current (staging)              | Action                                                               |
| --------------------- | ------------------------------ | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL` | `https://rwa-gamma.vercel.app` | Change to production domain                                          |
| `SMTP_USER`           | Gmail account                  | Consider sending service (Resend/SendGrid) for better deliverability |

### Add all to Vercel dashboard:

Vercel → Project → Settings → Environment Variables

- Set `CRON_SECRET`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` for **Production + Preview**
- Never put `SUPABASE_SERVICE_ROLE_KEY` in any `NEXT_PUBLIC_*` variable

---

## 4. 🔴 Database — Run Pending Migrations

### Two things pending:

**A. Community Engagement migration (new tables)**

The following models were added to `schema.prisma` but not yet migrated:

- `CommunityEvent`, `EventRegistration`, `EventPayment`
- `Petition`, `PetitionSignature`
- 6 new enums

```bash
# Run migration
npx prisma migrate dev --name add_community_events_and_petitions

# Regenerate Prisma client
npx prisma generate
```

After migration succeeds: update `supabase/dbinuse.prisma` to add the 5 new models.

**B. RLS migration on production**

The RLS policies file exists at `supabase/migrations/20260320000000_enable_rls_policies.sql`.
Verify it has been applied on prod:

```bash
# Deploy all pending migrations to production
npx prisma migrate deploy
```

Or via Supabase CLI:

```bash
supabase db push
```

**Verify RLS is active** in Supabase dashboard → Table Editor → select any table → Auth Policies tab — each table should show active policies.

---

## 5. 🔴 Supabase Storage Buckets — Create on Each Environment

Storage buckets are **not created by Prisma migrations**. They must be created manually in each Supabase project (stage + prod).

| Bucket name           | Public       | Used for                        |
| --------------------- | ------------ | ------------------------------- |
| `expense-receipts`    | No (private) | Expense receipt/invoice uploads |
| `petition-docs`       | No (private) | Petition PDF documents          |
| `petition-signatures` | No (private) | Resident signature images       |

**Create via Supabase dashboard:**
Supabase → Storage → New bucket → name → uncheck "Public bucket" → Create

**Or via SQL in Supabase SQL Editor:**

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('expense-receipts', 'expense-receipts', false),
  ('petition-docs', 'petition-docs', false),
  ('petition-signatures', 'petition-signatures', false);
```

**Verify:** Try uploading an expense receipt from the admin panel — it should succeed and the file should appear in the bucket.

---

## 6. 🔴 Seed Master Data on Fresh Database

Every new environment (stage, prod) needs platform-level data before any society can be onboarded.

```bash
# Seeds: 1 SuperAdmin + 6 PlatformPlans + billing options
npx tsx supabase/seed-master.ts
```

**What it creates:**

- SuperAdmin: `admin@superadmin.com` (change credentials after first login)
- 6 plans: Basic, Basic+, Community, Pro, Enterprise AI, Flex
- ~20 billing option records (Monthly/Annual/2-Year/3-Year per plan)

**After running:**

1. Log in to `/super-admin-login` with seeded credentials
2. Change SuperAdmin password immediately
3. Verify plans appear in `/sa/plans`

---

## 7. 🟡 WhatsApp (WATI) Setup

The WhatsApp service in `src/lib/whatsapp.ts` is fully implemented but not connected. It gracefully degrades (returns `{ success: false }`) when env vars are missing — so the app works without it.

### When you're ready to enable:

**Step 1 — Register templates on WATI dashboard**

Log into WATI → Message Templates → Create each template:

| Template name (must match code exactly) | Parameters                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `registration_submitted`                | `{{1}}` = resident name, `{{2}}` = society name                                |
| `registration_approved`                 | `{{1}}` = name, `{{2}}` = RWAID, `{{3}}` = society                             |
| `registration_rejected`                 | `{{1}}` = name, `{{2}}` = rejection reason                                     |
| `payment_receipt`                       | `{{1}}` = name, `{{2}}` = amount, `{{3}}` = receipt no, `{{4}}` = session year |
| `fee_reminder`                          | `{{1}}` = name, `{{2}}` = amount due, `{{3}}` = due date                       |
| `broadcast_message`                     | `{{1}}` = message text                                                         |
| `event_published`                       | `{{1}}` = name, `{{2}}` = event title, `{{3}}` = event date, `{{4}}` = society |
| `petition_published`                    | `{{1}}` = name, `{{2}}` = petition title, `{{3}}` = society                    |

**Step 2 — Set env vars:**

```
WATI_API_URL=https://live-mt-server.wati.io
WATI_API_KEY=your-bearer-token-from-wati-dashboard
```

**Step 3 — Wire the 7 automated triggers**
Currently templates exist but are not called from their corresponding events. This is the remaining 60% of Phase 5.

**Step 4 — Test:**

```bash
# Test single message manually via API:
curl -X POST https://live-mt-server.wati.io/api/v1/sendTemplateMessage \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"template_name":"registration_submitted","broadcast_name":"test","parameters":[],"to_number":"91XXXXXXXXXX"}'
```

---

## 8. 🟡 Sentry Error Monitoring Setup

Config files exist (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`) but Sentry is disabled because `NEXT_PUBLIC_SENTRY_DSN` is not set.

### Setup steps:

**Step 1 — Create Sentry project:**

- Go to sentry.io → New Project → Next.js
- Copy the DSN (looks like `https://abc123@o123456.ingest.sentry.io/789`)

**Step 2 — Set env vars:**

```
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_AUTH_TOKEN=your-auth-token-for-source-map-uploads
```

**Step 3 — Set in Vercel dashboard** (Production environment)

**Step 4 — Verify:** Deploy and trigger a test error — it should appear in Sentry within seconds.

**Current Sentry config (already set):**

- Traces: 10% of transactions sampled
- Session Replays: 1% normal, 100% on errors
- Only enabled in `NODE_ENV === 'production'`

---

## 9. 🟡 E2E Tests — Playwright Setup

Playwright is configured (`playwright.config.ts`) with 5 test spec files in `tests/e2e/`.

### Setup steps:

**Step 1 — Install browsers:**

```bash
npx playwright install chromium
```

**Step 2 — Create test credentials file:**

```bash
# Create tests/e2e/.env.test.local (gitignored)
TEST_ADMIN_EMAIL=your-test-admin@email.com
TEST_ADMIN_PASSWORD=your-test-password
```

**Step 3 — Run E2E tests:**

```bash
npm run test:e2e          # headless
npm run test:e2e:ui       # with browser UI (good for debugging)
```

**Test coverage (5 spec files):**

1. Admin login (includes rate limit test)
2. Resident registration (masking + validation)
3. Approval flow
4. Payment recording
5. Cross-society isolation

**Step 4 — Add to CI/CD:**
E2E tests should run on every PR before merge (configure in GitHub Actions / Vercel CI).

---

## 10. 🟡 Vercel Deployment Configuration

### Environment Variables

Add all variables from Section 3 to:
Vercel → Project → Settings → Environment Variables

Set each variable for the correct environments:

- `DATABASE_URL`, `DIRECT_URL` → Production only (separate DB per environment)
- `CRON_SECRET` → Production + Preview
- `NEXT_PUBLIC_*` → All environments
- Sensitive keys → Production only

### Custom Domain

1. Vercel → Project → Settings → Domains → Add domain
2. Update DNS records with your domain registrar
3. Update `NEXT_PUBLIC_APP_URL` to the production domain
4. SSL is automatic via Vercel

### Deployment Branch

- **Production:** `main` branch → auto-deploy
- **Preview:** `develop` branch → deploy to preview URL
- Verify in: Vercel → Project → Settings → Git

---

## 11. 🟡 Rate Limiting — Multi-Instance Consideration

**Current state:** In-memory rate limiting (Map-based). Works correctly for single-instance deployments but rate limit counters are **not shared** across multiple Vercel instances.

**Impact:** On Vercel's serverless infrastructure, each function invocation may run on a different instance, so a user could bypass rate limits by hitting different instances.

**Affected routes:**

- `/api/v1/auth/login` — 5 attempts/email/15min
- `/api/v1/auth/forgot-password` — 3 attempts/email/hour

**Fix (if needed):** The code already has the Redis integration stubbed out.

```bash
# Install
npm install @upstash/redis @upstash/ratelimit
```

```
# Add to .env
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

Then swap `checkRateLimit()` to use the Redis backend (code is commented and ready in `src/lib/rate-limit.ts`).

**Decision:** If you're on Vercel's Hobby plan (single region, fewer cold starts), in-memory is acceptable for launch. If on Pro plan with multiple regions, set up Upstash.

---

## 12. 🟢 Pre-Launch Code Quality Checks

Run these before every production deployment:

```bash
# 1. TypeScript — zero errors
npx tsc --noEmit

# 2. ESLint — zero errors
npm run lint

# 3. Formatting — consistent
npm run format:check

# 4. Unit tests — all passing, coverage ≥ 95%
npm run test:coverage

# 5. Production build — must succeed
npm run build

# 6. E2E tests — all passing
npm run test:e2e
```

All 6 must pass before deploying to production.

---

## 13. 🟢 Gmail SMTP — Production Consideration

Currently using Gmail (`smtp.gmail.com`) with an app password. This works for low volume but Gmail has sending limits:

- **Free Gmail:** 500 emails/day
- **Google Workspace:** 2,000 emails/day

**For launch:** Gmail is fine initially.

**When to switch:** Once you have 100+ active societies or start hitting limits, migrate to a dedicated service:

- **Resend** (recommended — good Next.js integration, 3,000 free/month)
- **SendGrid** (100 free/day, then paid)
- **AWS SES** (cheapest at scale)

Changing only requires updating the 3 SMTP env vars — no code changes needed.

---

## 14. 🟢 Post-Launch Operational Checklist

After going live, set up these ongoing operations:

**Database backups:**

- Supabase provides automatic daily backups (Pro plan)
- Verify: Supabase → Project → Settings → Database → Backups

**Monitoring alerts:**

- Sentry → Alerts → create alert for error rate spike
- Vercel → Observability → set up alerts for function failures

**Cron job monitoring:**

- Vercel → Project → Settings → Cron Jobs → verify each ran successfully
- Check daily that fee cron jobs executed (look at audit_logs)

**First week:**

- Monitor Supabase logs for unusual queries
- Watch for any 500 errors in Vercel logs
- Test the full resident registration → approval → payment flow end-to-end on prod

---

## Summary — Launch Order

Do these in order on the day of launch:

```
1. Generate CRON_SECRET and add to .env + Vercel
2. Update vercel.json with fee cron jobs
3. Run: npx prisma migrate deploy  (apply all migrations to prod DB)
4. Create 3 storage buckets in prod Supabase
5. Run: npx tsx supabase/seed-master.ts  (seed plans + super admin)
6. Set all env vars in Vercel dashboard
7. Change SuperAdmin default password
8. Run full test suite: npm run test:coverage + npm run test:e2e
9. Deploy to production (push to main)
10. Verify all 6 cron jobs appear in Vercel dashboard
11. Test one full user flow end-to-end on prod
12. Set up Sentry alerts
```
