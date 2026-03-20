# Plan: Security & Reliability Hardening

## Context

Two gap analyses have been merged into this plan:

1. **Bulk-upload hardening** — Five issues found after residents page improvements (bulk upload, filters, send-verification email).
2. **Phase 7 launch hardening** — Critical security gaps identified during production-readiness review (RLS, audit trail, rate limiting, monitoring, session enforcement, legal compliance).

All items below must be resolved before this system is considered production-grade.

---

## Issues to Fix

### 1. Row-Level Security (RLS) Policies Not Deployed (CRITICAL)

**Problem:**
Multi-tenancy relies entirely on application-layer checks (`getFullAccessAdmin()`, `forbiddenError()`). No RLS policies exist in Supabase. A leaked JWT or direct DB connection bypasses all society isolation.

**Risk:** Any direct SQL query can read/write data across all societies.

**Fix:**

- Apply `ENABLE ROW LEVEL SECURITY` to all 12 tables: `users`, `units`, `user_units`, `membership_fees`, `fee_payments`, `expenses`, `notifications`, `notification_preferences`, `broadcasts`, `audit_logs`, `migration_batches`, `fee_sessions`
- Deploy policies from `execution_plan/MVP/database-design.md` (lines 987–1044) via Supabase migration
- Policy rules: society isolation on all read/write, admin-only on sensitive tables, `audit_logs` immutable (insert only)

**Files to change:**
| File | Change |
|---|---|
| `supabase/migrations/` | New migration file with all RLS `ENABLE` + `CREATE POLICY` statements |

---

### 2. Missing Auth/Authorization on API Routes (CRITICAL)

**Problem:**
Several API routes have zero authentication. Anyone who knows the URL can call them:

- `GET /api/v1/residents` — returns all residents for any society
- `POST /api/v1/residents/bulk-upload` — creates residents in any society
- `POST /api/v1/residents/[id]/send-verification` — sends emails for any resident

**Risk:** Data breach, unauthorized writes, spam abuse.

**Fix:**

- Add a shared `requireRWAAdmin(request)` guard helper in `src/lib/api-helpers.ts`
- It reads the session from Supabase (`createClient().auth.getUser()`), looks up the user in DB, verifies `role === "RWA_ADMIN"` and `societyId` matches the requested society
- Return `401` if no session, `403` if role mismatch
- Apply to all three routes

**Files to change:**
| File | Change |
|---|---|
| `src/lib/api-helpers.ts` | Add `requireRWAAdmin(request, societyId)` helper |
| `src/app/api/v1/residents/route.ts` | Call guard at top, pass `societyId` from query |
| `src/app/api/v1/residents/bulk-upload/route.ts` | Call guard at top, resolve societyId from societyCode |
| `src/app/api/v1/residents/[id]/send-verification/route.ts` | Call guard at top |

---

### 3. Audit Logging Not Wired (CRITICAL)

**Problem:**
`src/lib/audit.ts` exports `logAudit()` with a full typed `AuditAction` enum and writes to the `audit_logs` table — but it is **never called** anywhere. Every financial and administrative operation (resident approval, payment recording, expense creation, broadcast sent) has zero audit trail.

**Risk:** No compliance trail for financial operations. Cannot investigate disputes or unauthorized changes.

**Fix:**

- Call `logAudit()` after each of these operations (non-blocking — fire and forget, errors caught internally):
  - Resident approved / rejected
  - Payment recorded / reversed
  - Expense created / reversed
  - Broadcast sent
  - Admin role changed
  - Society settings updated

**Files to change:**
| File | Change |
|---|---|
| `src/app/api/v1/residents/[id]/approve/route.ts` | `logAudit(RESIDENT_APPROVED, ...)` |
| `src/app/api/v1/residents/[id]/reject/route.ts` | `logAudit(RESIDENT_REJECTED, ...)` |
| `src/app/api/v1/payments/route.ts` | `logAudit(PAYMENT_RECORDED, ...)` |
| `src/app/api/v1/expenses/route.ts` | `logAudit(EXPENSE_CREATED, ...)` |
| `src/app/api/v1/broadcasts/route.ts` | `logAudit(BROADCAST_SENT, ...)` |

---

### 4. Rate Limiting Not Active (HIGH)

**Problem:**
`src/lib/rate-limit.ts` exists as an in-memory stub (comment says "replace with Redis in production") but is **never imported or called** by any endpoint. Login, password reset, and registration have zero brute-force protection.

**Fix:**

- Integrate `checkRateLimit()` into: login, forgot-password, register-society routes
- Swap backing store to Upstash Redis for multi-instance production use
- Limits per plan (from `phase-7-security-launch.md`):
  - Login: 5 attempts per email per 15 min
  - Forgot-password: 3 requests per email per hour
  - Registration: 5 requests per IP per hour
  - General GET: 100/user/min, POST: 50/user/min

**Files to change:**
| File | Change |
|---|---|
| `src/lib/rate-limit.ts` | Replace in-memory map with Upstash Redis client |
| `src/app/api/v1/auth/login/route.ts` | Call rate limit check at entry |
| `src/app/api/v1/auth/forgot-password/route.ts` | Call rate limit check at entry |
| `src/app/api/v1/auth/register-society/route.ts` | Call rate limit check at entry |

---

### 5. RWAID Race Condition on Concurrent Bulk Uploads (HIGH)

**Problem:**
The bulk-upload route counts existing RWAIDs for a year to determine the next sequence number:

```typescript
const existingYearCount = await prisma.user.count({ where: { rwaid: { contains: `-${year}-` } } });
const rwaid = generateRWAID(society.societyId, year, existingYearCount + 1);
```

If two admins upload simultaneously, both reads return the same count, and both assign the same RWAID — violating uniqueness.

**Fix:**

- Add `@@unique([societyId, rwaid])` constraint on the `User` model in Prisma schema (or confirm it already exists)
- Catch `P2002` (unique constraint) errors — retry with incremented sequence on collision (max 3 retries)

**Files to change:**
| File | Change |
|---|---|
| `supabase/dbinuse.prisma` | Verify/add `@@unique` on `rwaid` field |
| `src/app/api/v1/residents/bulk-upload/route.ts` | Catch Prisma `P2002`, retry with +1 sequence (max 3 retries) |

---

### 6. Supabase Auth Orphan on DB Failure (HIGH)

**Problem:**
In bulk upload, the flow is:

1. Create Supabase auth user → `authUserId` obtained
2. Start Prisma transaction → create `user` row + optionally `unit` + `userUnit`

If step 2 fails, the Prisma transaction rolls back — but the Supabase auth user is **not rolled back**. This leaves an orphaned auth account: the user can never log in, but the email is permanently "taken".

**Fix:**

- After any `prisma.$transaction` failure where a new Supabase auth user was just created, call `supabaseAdmin.auth.admin.deleteUser(authUserId)` to clean up
- Only delete if `authUserId` was freshly created in this request (not reused)
- Log both the original error and any cleanup failure

**Files to change:**
| File | Change |
|---|---|
| `src/app/api/v1/residents/bulk-upload/route.ts` | Add cleanup block after transaction catch: delete Supabase user if newly created |

---

### 7. Session Timeout Not Enforced (HIGH)

**Problem:**
`ADMIN_SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000` is defined in `src/lib/constants.ts` but `src/middleware.ts` does not enforce it. Admin sessions never expire due to inactivity regardless of the configured value.

**Fix:**

- In `src/middleware.ts`, check the session's `last_sign_in_at` timestamp
- If `now - lastActivity > ADMIN_SESSION_TIMEOUT_MS`, call `supabase.auth.signOut()` and redirect to login

**Files to change:**
| File | Change |
|---|---|
| `src/middleware.ts` | Add inactivity check using `ADMIN_SESSION_TIMEOUT_MS` |

---

### 8. Sentry Error Monitoring Not Installed (HIGH)

**Problem:**
No `@sentry/nextjs` package installed. There is zero production error visibility — crashes, unhandled promise rejections, and API errors are silent.

**Fix:**

- `npm install @sentry/nextjs`
- Add `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- Update `next.config.ts` to wrap with `withSentryConfig`
- Set `SENTRY_DSN` env var in Vercel

**Files to change:**
| File | Change |
|---|---|
| `package.json` | Add `@sentry/nextjs` |
| `sentry.client.config.ts` | New — client-side init |
| `sentry.server.config.ts` | New — server-side init |
| `next.config.ts` | Wrap with `withSentryConfig` |
| `.env` / Vercel env | Add `SENTRY_DSN` |

---

### 9. E2E Critical Path Testing (HIGH)

**Problem:**
15 critical user journeys are documented in the Phase 7 plan but no automated or manual QA has been run. No Playwright/Cypress is configured.

**Critical paths to verify:**

1. Society creation
2. Admin login
3. Resident registration
4. Registration approval / rejection
5. Payment recording (full + partial)
6. Fee exemption
7. Expense logging + reversal
8. Bulk import
9. Report download
10. Broadcast sent
11. Resident login
12. Cross-society data isolation

**Fix:**

- Run manual QA against all 15 paths before launch and record results
- Add Playwright for at least paths 1–5 + 11 + 12 (highest risk)

**Files to change:**
| File | Change |
|---|---|
| `e2e/` | New Playwright test suite for critical paths |
| `package.json` | Add `@playwright/test` |

---

### 10. CSP and Security Headers Incomplete (MEDIUM)

**Problem:**
`src/proxy.ts` sets basic headers (`X-Frame-Options`, `X-Content-Type-Options`, etc.) but `next.config.ts` is empty boilerplate. No Content-Security-Policy is configured. Headers from `proxy.ts` may not apply in all deployment scenarios.

**Fix:**

- Move security headers to `next.config.ts` `headers()` config (authoritative for all routes)
- Add `Content-Security-Policy` with appropriate directives for Next.js + Supabase + Vercel

**Files to change:**
| File | Change |
|---|---|
| `next.config.ts` | Add `headers()` with full security header set including CSP |

---

### 11. URL State Persistence for Residents Page Filters (MEDIUM)

**Problem:**
All filter state (search, status, emailVerified, ownershipType, year, page, limit) lives in React `useState`. Refreshing the page or sharing a URL loses the filter context.

**Fix:**

- Replace `useState` for all filters with `useSearchParams` / `useRouter` from Next.js
- Read initial values from URL on mount, write back on every filter change
- URL format: `/admin/residents?search=john&status=ACTIVE&year=2026&page=2`
- Use `router.replace` (not `router.push`) so filter changes don't pollute browser history

**Files to change:**
| File | Change |
|---|---|
| `src/app/admin/residents/page.tsx` | Replace filter `useState` with URL search params |

---

### 12. Supabase Auth Reuse Scope Too Broad (MEDIUM)

**Problem:**
When checking for an existing Supabase auth account to reuse, the query searches **across all societies**:

```typescript
prisma.user.findFirst({ where: { email: record.email, authUserId: { not: null } } });
```

A resident of Society A could have their `authUserId` reused when being added to Society B — not explicitly designed for and can cause cross-society confusion.

**Fix:**

- Decide: multi-society login supported or not
- If **not** intended: scope to `{ email, authUserId: { not: null }, societyId: society.id }`
- If **intended**: add an explicit comment documenting the design decision

**Files to change:**
| File | Change |
|---|---|
| `src/app/api/v1/residents/bulk-upload/route.ts` | Clarifying comment or tightened scope |

---

### 13. Privacy Policy & Terms of Service Missing (MEDIUM)

**Problem:**
No Privacy Policy or Terms of Service pages exist in the app. These are required for DPDP compliance and must be linked from the registration and login pages.

**Fix:**

- Create static `/privacy` and `/terms` pages
- Link them from the registration form and login page footer

**Files to change:**
| File | Change |
|---|---|
| `src/app/privacy/page.tsx` | New — Privacy Policy page |
| `src/app/terms/page.tsx` | New — Terms of Service page |
| Registration + login pages | Add footer links |

---

## Priority Order

| #   | Issue                              | Priority     | Effort     |
| --- | ---------------------------------- | ------------ | ---------- |
| 1   | RLS Policies not deployed          | **CRITICAL** | Medium     |
| 2   | Missing auth on API routes         | **CRITICAL** | Medium     |
| 3   | Audit logging not wired            | **CRITICAL** | Low        |
| 4   | Rate limiting not active           | **HIGH**     | Medium     |
| 5   | RWAID race condition               | **HIGH**     | Low–Medium |
| 6   | Supabase auth orphan on DB failure | **HIGH**     | Low        |
| 7   | Session timeout not enforced       | **HIGH**     | Low        |
| 8   | Sentry not installed               | **HIGH**     | Low        |
| 9   | E2E critical path testing          | **HIGH**     | High       |
| 10  | CSP and security headers           | Medium       | Low        |
| 11  | URL state persistence for filters  | Medium       | Medium     |
| 12  | Supabase auth reuse scope          | Medium       | Low        |
| 13  | Privacy Policy & Terms missing     | Medium       | Low        |

---

## Files to Create

| File                                               | Purpose                   |
| -------------------------------------------------- | ------------------------- |
| `supabase/migrations/<timestamp>_rls_policies.sql` | RLS enable + all policies |
| `sentry.client.config.ts`                          | Sentry client init        |
| `sentry.server.config.ts`                          | Sentry server init        |
| `src/app/privacy/page.tsx`                         | Privacy Policy            |
| `src/app/terms/page.tsx`                           | Terms of Service          |
| `e2e/critical-paths.spec.ts`                       | Playwright E2E tests      |

## Files to Modify

| File                                                       | Issues addressed                          |
| ---------------------------------------------------------- | ----------------------------------------- |
| `src/lib/api-helpers.ts`                                   | #2 — add `requireRWAAdmin` helper         |
| `src/lib/rate-limit.ts`                                    | #4 — Upstash Redis backend                |
| `src/middleware.ts`                                        | #7 — enforce session timeout              |
| `next.config.ts`                                           | #8, #10 — Sentry + security headers + CSP |
| `src/app/api/v1/residents/route.ts`                        | #2 — auth guard                           |
| `src/app/api/v1/residents/bulk-upload/route.ts`            | #2, #5, #6, #12                           |
| `src/app/api/v1/residents/[id]/send-verification/route.ts` | #2 — auth guard                           |
| `src/app/api/v1/residents/[id]/approve/route.ts`           | #3 — audit log                            |
| `src/app/api/v1/residents/[id]/reject/route.ts`            | #3 — audit log                            |
| `src/app/api/v1/payments/route.ts`                         | #3 — audit log                            |
| `src/app/api/v1/expenses/route.ts`                         | #3 — audit log                            |
| `src/app/api/v1/broadcasts/route.ts`                       | #3 — audit log                            |
| `src/app/api/v1/auth/login/route.ts`                       | #4 — rate limit                           |
| `src/app/api/v1/auth/forgot-password/route.ts`             | #4 — rate limit                           |
| `src/app/api/v1/auth/register-society/route.ts`            | #4 — rate limit                           |
| `src/app/admin/residents/page.tsx`                         | #11 — URL state                           |
| `prisma/dbinuse.prisma`                                    | #5 — unique constraint                    |
| `package.json`                                             | #8 Sentry, #9 Playwright                  |

## Test Coverage Required

- Auth guard: unit tests for 401/403 scenarios
- Rate limiting: test limit exceeded → 429 response
- RWAID retry on P2002: collision → retry → success
- Supabase orphan cleanup: `deleteUser` called when transaction fails
- Audit logging: verify `logAudit` called for each operation
- Session timeout: middleware redirects after inactivity
- URL state: component test verifying URL params read/written correctly
- E2E: 15 critical-path manual + automated scenarios
