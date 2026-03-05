# MVP Phase 7 — Security Hardening & Go-Live

**Duration**: ~1 week
**Goal**: Production-ready security, compliance checks, performance optimization, and end-to-end testing before launch.
**Depends on**: All previous phases (Phase 0–6)

---

## Task 7.1 — Row-Level Security (RLS) Policies

### Implementation

Every table with society-scoped data gets an RLS policy at the PostgreSQL layer. This is the **non-negotiable multi-tenancy backbone**.

### Policies to Create

| Table               | Policy                               | Rule                             |
| ------------------- | ------------------------------------ | -------------------------------- |
| `societies`         | Super Admin sees all; Admin sees own | `society_id = auth.society_id()` |
| `users`             | Users in same society                | `society_id = auth.society_id()` |
| `units`             | Units in same society                | `society_id = auth.society_id()` |
| `user_units`        | Via units → society                  | Join through units table         |
| `membership_fees`   | Via users → society                  | `society_id = auth.society_id()` |
| `fee_payments`      | Via membership_fees → society        | Join through fee records         |
| `expenses`          | All in same society                  | `society_id = auth.society_id()` |
| `notifications`     | Own notifications only               | `user_id = auth.uid()`           |
| `audit_logs`        | Admin sees society logs              | `society_id = auth.society_id()` |
| `migration_batches` | Admin sees own imports               | `society_id = auth.society_id()` |

### Super Admin Bypass

- Super Admin bypasses RLS for **aggregate reports only** (total societies, platform stats)
- Super Admin **never** browses individual resident data directly
- Implemented via Supabase service role key (server-side only, never exposed to client)

### Testing

- Test: Admin A cannot see Admin B's society data
- Test: Resident cannot see other society's expenses
- Test: Direct SQL query with wrong society_id returns empty
- Test: API call with tampered society_id returns 403

**Acceptance**: Every society-scoped table has RLS. Cross-society data access impossible. Super Admin aggregate access works.

---

## Task 7.2 — API Security

### Rate Limiting

| Endpoint                            | Limit        | Window               |
| ----------------------------------- | ------------ | -------------------- |
| `POST /api/v1/auth/login`           | 5 attempts   | per email per 15 min |
| `POST /api/v1/auth/forgot-password` | 3 requests   | per email per hour   |
| `POST /api/v1/register/*`           | 5 requests   | per IP per hour      |
| `GET /api/v1/*`                     | 100 requests | per user per minute  |
| `POST /api/v1/*`                    | 50 requests  | per user per minute  |
| `POST /api/v1/broadcasts`           | 5 requests   | per admin per hour   |

### Implementation

- Use Upstash Redis for rate limit counters (serverless-friendly)
- Middleware: `src/lib/rate-limiter.ts`
- Returns `429 Too Many Requests` with `Retry-After` header
- Rate limit headers on every response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Input Validation & Sanitization

- All inputs validated through Zod schemas (already in Phase 0)
- SQL injection: Prisma ORM parameterizes all queries — no raw SQL in MVP
- XSS: React auto-escapes by default; sanitize any `dangerouslySetInnerHTML` usage (should be none)
- CSRF: Next.js App Router uses server actions with automatic CSRF protection
- File upload validation: max 5MB, only PDF/JPG/PNG, check MIME type (not just extension)

### Authentication Hardening

- JWT token expiry: 1 hour (access), 7 days (refresh)
- Session inactivity timeout: 8 hours (Admin/Super Admin), 30 days (Resident)
- Email/password for all users (no OTP, no PIN in v2)
- Login lockout: 5 failed attempts per email per 15 min
- Password reset: email-based reset flow via Supabase Auth

**Acceptance**: Rate limits enforced on all endpoints. File upload validated. Auth timeouts work. Login lockout tested.

---

## Task 7.3 — Data Protection & Encryption

### Encryption Layers

| Layer            | Method            | Implementation                                     |
| ---------------- | ----------------- | -------------------------------------------------- |
| In transit       | TLS 1.3           | Vercel handles HTTPS termination                   |
| At rest (DB)     | AES-256           | Supabase RDS encryption (enabled by default)       |
| At rest (files)  | AES-256           | Supabase Storage encryption (enabled by default)   |
| Sensitive fields | Application-layer | `pin_hash` bcrypt hashed, mobile numbers encrypted |

### Sensitive Data Handling

- Passwords: Supabase Auth handles bcrypt hashing (no PIN in v2)
- Mobile numbers (when provided): Displayed masked in UI (98765xxxxx) except to the user themselves
- Aadhaar/ID proof: Stored encrypted in Supabase Storage, access via signed URLs (1-hour expiry)
- No PII in logs: Middleware strips mobile numbers, emails, and names from server logs

### DPDP Compliance (India)

- Consent checkboxes on all data collection forms (registration, WhatsApp consent)
- Privacy Policy URL displayed on registration page
- Terms of Service link on login page
- Data stored on India-region servers (Supabase AWS ap-south-1 Mumbai)
- Right to Access: Resident can view all their own data in the portal
- Right to Correction: Resident can request profile updates via admin

**Acceptance**: All sensitive data encrypted. Mobile numbers masked in UI. No PII in server logs. Consent forms present.

---

## Task 7.4 — Audit Trail

### Implementation

Every create/update/delete operation on key tables is logged to `audit_logs`:

```sql
audit_logs (
  id, society_id, user_id, action, entity_type, entity_id,
  old_values, new_values, ip_address, created_at
)
```

### Logged Operations

| Action | Entity           | What's Logged                              |
| ------ | ---------------- | ------------------------------------------ |
| CREATE | resident         | New registration details                   |
| UPDATE | resident         | Status change (approved/rejected) + reason |
| CREATE | fee_payment      | Payment amount, mode, receipt number       |
| UPDATE | fee_payment      | Correction (before/after values)           |
| CREATE | fee_reversal     | Reversal reason + linked payment           |
| CREATE | expense          | Expense details                            |
| UPDATE | expense          | Correction (before/after values)           |
| CREATE | expense_reversal | Reversal reason                            |
| UPDATE | fee_status       | Exemption granted + reason                 |
| CREATE | broadcast        | Message, recipient count, admin            |
| UPDATE | admin_role       | Admin activated/deactivated                |

### ~~UI: Audit Log (Super Admin only)~~ (DEFERRED to Phase 2)

> **v2 change**: Audit log admin UI is deferred to Phase 2. Audit trail data is still **written to the database** for all key operations (this is essential for compliance). However, the admin-facing UI to browse/search audit logs is not in MVP scope. Super Admins can access audit data directly via database queries if needed.

**What is kept in MVP**:

- All key operations are still logged to the `audit_logs` table
- Before/after values captured for updates
- Logged operations: see table above

**What is deferred**:

- `AuditLogTable` UI component
- `AuditDetailSheet` UI component
- Search/filter/pagination UI for audit logs

**Acceptance**: All key operations logged to DB. No admin UI for browsing logs (deferred).

---

## Task 7.5 — Error Handling & Monitoring

### Error Boundaries (already set up in Phase 0, verify)

- `src/app/error.tsx` — Root error boundary with retry
- `src/app/not-found.tsx` — 404 page
- Per-portal error boundaries (super-admin, admin, resident)
- Loading skeletons in all route groups

### Error Monitoring

- **Sentry** integration for error tracking
  - `npm install @sentry/nextjs`
  - Configure `sentry.client.config.ts` + `sentry.server.config.ts`
  - Environment: production, staging
  - Source maps uploaded to Sentry for readable stack traces
- **Uptime monitoring**: UptimeRobot (free tier — 5-minute checks)

### Error Response Format (API)

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many OTP requests. Try again in 45 minutes.",
    "status": 429,
    "retryAfter": 2700
  }
}
```

### Standard Error Codes

| Code                       | Status | When                           |
| -------------------------- | ------ | ------------------------------ |
| `UNAUTHORIZED`             | 401    | No valid session               |
| `FORBIDDEN`                | 403    | Role mismatch or wrong society |
| `NOT_FOUND`                | 404    | Resource doesn't exist         |
| `VALIDATION_ERROR`         | 422    | Zod validation failure         |
| `RATE_LIMIT_EXCEEDED`      | 429    | Too many requests              |
| `INTERNAL_ERROR`           | 500    | Unexpected server error        |
| `WHATSAPP_DELIVERY_FAILED` | 502    | BSP API failure                |

**Acceptance**: Sentry captures errors with stack traces. API returns consistent error format. Error boundaries catch and display friendly messages. Uptime monitoring configured.

---

## Task 7.6 — Performance Optimization

### Checklist

- [ ] **Images**: Next.js `<Image>` component with lazy loading (already using)
- [ ] **Code splitting**: Dynamic imports for heavy components (PDF generators, charts)
  ```typescript
  const ReceiptPDF = dynamic(() => import("@/components/features/fees/ReceiptPDF"), { ssr: false });
  const QRPosterPDF = dynamic(() => import("@/components/features/society/QRPosterPDF"), {
    ssr: false,
  });
  ```
- [ ] **Bundle analysis**: `npm run analyze` (add `@next/bundle-analyzer`)
- [ ] **API response caching**: TanStack Query `staleTime: 5min` (already configured)
- [ ] **Database indexes**: Verify indexes on `society_id`, `user_id`, `status`, `created_at`
- [ ] **Pagination**: All list endpoints paginated (max 50 per page)
- [ ] **Skeleton screens**: Every data-fetching page has a loading skeleton
- [ ] **Debouncing**: Society Code uniqueness check (300ms debounce), search inputs (500ms debounce)

### Performance Targets

| Metric                         | Target  |
| ------------------------------ | ------- |
| LCP (Largest Contentful Paint) | < 2.5s  |
| FID (First Input Delay)        | < 100ms |
| CLS (Cumulative Layout Shift)  | < 0.1   |
| API response time (p95)        | < 500ms |
| PDF generation time            | < 3s    |

**Acceptance**: Lighthouse score > 90 on all portals. No layout shifts. PDF generation under 3 seconds.

---

## Task 7.7 — End-to-End Testing

### Critical Path Test Scenarios

| #   | Scenario                | Steps                                                   | Expected                                  |
| --- | ----------------------- | ------------------------------------------------------- | ----------------------------------------- |
| 1   | Society creation        | Super Admin → Onboard Society → Set fees → Create admin | Society created, admin receives email     |
| 2   | Admin login             | Admin → Enter email + password → Dashboard              | Admin lands on dashboard                  |
| 3   | Resident registration   | Click invite link → Fill form (email/password) → Submit | Registration submitted, admin alerted     |
| 4   | Registration approval   | Admin → Pending → Approve → RWAID string generated      | Resident receives RWAID in notification   |
| 5   | Registration rejection  | Admin → Pending → Reject with reason                    | Resident receives rejection message       |
| 6   | Payment recording       | Admin → Fees → Record Payment → Cash ₹1,200             | Receipt generated, WhatsApp sent          |
| 7   | Partial payment         | Admin → Record ₹800 of ₹1,200 → Status: Partial         | Balance shows ₹400 outstanding            |
| 8   | Fee exemption           | Admin → Exempt resident → Reason logged                 | Status: Exempted, excluded from overdue   |
| 9   | Expense logging         | Admin → Add Expense → Security → ₹4,800                 | Balance reduced, expense in ledger        |
| 10  | Expense reversal        | Admin → Reverse expense → Reason                        | Original struck-through, balance restored |
| 11  | Bulk import             | Admin → Upload 100-row Excel → Validate → Import        | 100 accounts + RWAIDs created             |
| 12  | Report download         | Admin → Reports → Paid List → PDF                       | PDF downloads with correct data           |
| 13  | Broadcast               | Admin → Compose → Send to all → Confirm                 | 42 WhatsApp messages queued               |
| 14  | Resident login          | Resident → Email + password → Dashboard                 | Sees own RWAID string, payment history    |
| 15  | Cross-society isolation | Admin A tries to access Society B data                  | 403 Forbidden                             |

### Manual QA Checklist

**Mobile Responsiveness** (test on 360px width):

- [ ] All 3 portals render correctly
- [ ] Sidebar collapses to hamburger on mobile
- [ ] Bottom nav works on resident portal
- [ ] Forms usable on small screens
- [ ] Tables scroll horizontally
- [ ] Dialogs are full-screen on mobile

**Browser Compatibility**:

- [ ] Chrome (latest)
- [ ] Safari (latest)
- [ ] Firefox (latest)
- [ ] Chrome on Android
- [ ] Safari on iOS

**Accessibility**:

- [ ] Keyboard navigation works on all forms
- [ ] Tab order logical
- [ ] Focus indicators visible
- [ ] Screen reader reads form labels
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Touch targets minimum 48px

**Acceptance**: All 15 critical paths pass. Mobile responsive. Cross-browser tested. Accessibility checked.

---

## Task 7.8 — Go-Live Checklist

### Legal & Compliance

- [ ] Privacy Policy published and linked on registration page
- [ ] Terms of Service published and linked on login page
- [ ] DPDP-compliant consent checkboxes on all data collection forms
- [ ] Data storage confirmed on India-region servers (AWS Mumbai)
- [ ] GST registration (if expected revenue > ₹20L in year 1)

### WhatsApp & Notifications

- [ ] WhatsApp Business Account registered and Meta-verified
- [ ] All 7 message templates submitted to Meta
- [ ] At least 5 mandatory templates approved
- [ ] Test broadcast sent to 5 internal numbers — delivery confirmed
- [ ] ~~SMS fallback~~ — Removed in v2 (SMS for OTP only via Supabase Auth)

### Security

- [ ] SSL/TLS — all traffic HTTPS (Vercel handles this)
- [ ] Database encrypted at rest (Supabase default)
- [ ] Storage encrypted at rest (Supabase default)
- [ ] Super Admin account created in `super_admins` table
- [ ] Login rate limiting tested — lockout after 5 failed attempts per email
- [ ] Password reset flow tested
- [ ] RLS policies active on all society-scoped tables
- [ ] No PII in server logs verified

### Infrastructure

- [ ] Production Supabase project created (separate from dev)
- [ ] Production environment variables set
- [ ] Vercel production deployment configured
- [ ] Custom domain pointed (if applicable)
- [ ] Sentry error monitoring active
- [ ] UptimeRobot monitoring configured
- [ ] Database backup schedule verified (Supabase default: daily)

### Data

- [ ] Production database migrated (Prisma migrate deploy)
- [ ] Super Admin seed account created
- [ ] First society ready to onboard
- [ ] Demo data cleaned (no test data in production)

### Functional Verification

- [ ] End-to-end flow: Society → Admin (email/password) → Resident (invite-link) → Payment → Receipt → Expense → Report
- [ ] Pro-rata calculation tested for all 12 months
- [ ] Bulk import tested with 100+ rows
- [ ] RWAID **string** generated correctly on approval
- [ ] ~~RWAID card PDF~~ — Deferred to Phase 2
- [ ] ~~Society Code QR poster~~ — Deferred to Phase 2
- [ ] All 5 reports download as PDF and Excel
- [ ] Fee status transitions: Pending → Paid → Partial → Overdue
- [ ] Vehicle registration: self-service add/remove works
- [ ] Festival fund: create festival, record contributions, view balance

### Post-Launch

- [ ] First real society onboarded
- [ ] Admin trained on all features
- [ ] Support channel set up (WhatsApp group or email)
- [ ] Feedback mechanism in place
- [ ] Hotfix deployment process documented

---

## Phase 7 Definition of Done

- [ ] RLS policies on all society-scoped tables, tested with cross-society access attempts
- [ ] Rate limiting on all sensitive endpoints (OTP, registration, API)
- [ ] File upload validation (5MB, correct MIME types)
- [ ] Sensitive data encrypted and masked in UI
- [ ] DPDP compliance: consent forms, privacy policy, India data residency
- [ ] Audit trail logging all key operations with before/after values
- [ ] Sentry error monitoring configured and capturing errors
- [ ] Performance: Lighthouse > 90, API p95 < 500ms
- [ ] All 15 critical path test scenarios pass
- [ ] Mobile responsive on 360px+ screens
- [ ] Cross-browser tested (Chrome, Safari, Firefox)
- [ ] Accessibility: keyboard nav, focus indicators, contrast
- [ ] Full go-live checklist completed
- [ ] First society onboarded successfully
