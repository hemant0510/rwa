# Eden Estate RWA — Project Status

**Last updated:** 2026-03-24
**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind v4 · Prisma · Supabase · Vercel

---

## What's Built (MVP — ~99% Complete)

| Area                                          | Status           | Notes                                                                  |
| --------------------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| Foundation — DB, auth, layouts, design system | ✅ Done          | 22 tables, Supabase Auth, shadcn/ui                                    |
| Super Admin portal                            | ✅ Done          | Society onboarding, plans, discounts, billing dashboard                |
| Resident registration                         | ✅ Done          | Invite-link, approval flow, bulk import, RWAID generation              |
| Fee management                                | ✅ Done          | Pro-rata, payment recording, receipts, correction, reversal, cron jobs |
| Expense ledger                                | ✅ Done          | Add/edit/reverse, receipt upload, resident transparency view           |
| Data migration & reports                      | ✅ Done          | Excel import wizard, 5 report types (PDF + Excel)                      |
| Security & launch hardening                   | ✅ Done          | Auth guards, rate limiting, RLS, CSP headers, Sentry, E2E tests        |
| WhatsApp notifications                        | ⚠️ Partial (40%) | Templates defined; WATI/Interakt API not yet wired                     |

### Pre-launch Checklist

| Item                                                            | Status                          |
| --------------------------------------------------------------- | ------------------------------- |
| Set `NEXT_PUBLIC_SENTRY_DSN` in Vercel                          | ⏳ pending                      |
| Run RLS migration (`supabase db push`) on prod                  | ⏳ pending                      |
| Set `SENTRY_AUTH_TOKEN` in CI                                   | ⏳ pending                      |
| Install Playwright browsers (`npx playwright install chromium`) | ⏳ pending                      |
| Set `TEST_ADMIN_EMAIL` + `TEST_ADMIN_PASSWORD` env vars         | ⏳ pending                      |
| Wire WATI/Interakt API credentials                              | ⏳ pending (Phase 5 completion) |
| Upstash Redis for multi-instance rate limiting (optional)       | ⏳ optional                     |

---

## In Progress

### Community Engagement Module

**Spec:** [plans/community-engagement.md](plans/community-engagement.md)

| Sub-feature                                   | Status                      |
| --------------------------------------------- | --------------------------- |
| DB schema (5 new models + 6 enums)            | ✅ Added to `schema.prisma` |
| Prisma migration                              | ⏳ Not yet run              |
| Event API routes + validation + service       | ⏳ Pending                  |
| Petition API routes + validation + service    | ⏳ Pending                  |
| SignaturePad + SignatureUpload components     | ⏳ Pending                  |
| Admin Events pages                            | ⏳ Pending                  |
| Resident Events page                          | ⏳ Pending                  |
| Admin Petitions pages                         | ⏳ Pending                  |
| Resident Petitions pages                      | ⏳ Pending                  |
| WhatsApp notifications for events + petitions | ⏳ Pending                  |

---

## Planned Next

### Society Bank Balance Visibility

Show society fund balance to all residents on the Financial Transparency page (`/r/expenses`).

- Manual balance entry by admin
- System-calculated balance (fees collected − expenses) shown alongside for cross-check
- Admin toggle to show/hide (default: visible)
- Design: extend existing resident expenses page — not a new page

### AI Features (priority order)

1. **Broadcast Drafter** — admin types plain text, AI generates polished WhatsApp message
2. **Petition / Complaint Letter Writer** — describe issue, AI drafts formal letter for upload as petition PDF
3. **Resident Chatbot** — natural language queries about fees, events, balance
4. **Monthly Financial Summary** — AI-generated narrative for governing body
5. **SuperAdmin Platform Intelligence** — churn signals, anomaly detection across societies

**Implementation stack:** Claude API (Anthropic) · Vercel AI SDK · Supabase `pgvector` (future semantic search)

### WhatsApp API Completion (Phase 5)

Wire WATI/Interakt credentials, connect all 7 existing templates to their event triggers, add retry logic + delivery webhook.

### Festival Fund Full Lifecycle

`DRAFT → COLLECTING → CLOSED → COMPLETED` with settlement reports and surplus disposal options.

---

## Key File Locations

| Area                   | Path                                       |
| ---------------------- | ------------------------------------------ |
| Coding standards       | `.claude/core_rules.md`                    |
| DB schema              | `supabase/schema.prisma`                   |
| Enum reference         | `execution_plan/DB/enums-reference.md`     |
| DB migration notes     | `execution_plan/DB/database-management.md` |
| Zod validation schemas | `src/lib/validations/`                     |
| API client services    | `src/services/`                            |
| UI components          | `src/components/`                          |
| Super Admin pages      | `src/app/sa/`                              |
| Admin pages            | `src/app/admin/`                           |
| Resident pages         | `src/app/r/`                               |
| Auth pages             | `src/app/(auth)/`                          |
| API routes             | `src/app/api/v1/`                          |
| Cron routes            | `src/app/api/cron/`                        |
| Feature plans          | `execution_plan/plans/`                    |
| Archived planning docs | `execution_plan/archive/`                  |
