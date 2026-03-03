# RWA Connect — MVP Build Plan

## What This Is

The actionable, build-ready plan for the **first shippable version** of RWA Connect. This is NOT the full product vision (that's in `execution_plan/`). This MVP tells us exactly what to build, what to skip, and what to launch with.

**Source**: `external_docs/RWA_Connect_MVP_v1.0.docx`
**Timeline**: 8-12 weeks
**Status**: Build Ready

---

## MVP Scope — What's IN vs OUT

### IN SCOPE (Build This)

- Super Admin dashboard — onboard societies, activate admins
- Society setup with **configurable** joining fee and annual fee
- Society Code (**admin-chosen**, not auto-generated) + QR poster
- 5 society types with dynamic unit address fields
- Resident self-registration (4 mandatory fields only)
- RWAID generation + digital ID card (PDF, QR code)
- Admin approval/rejection of registrations
- Pro-rata fee calculation (dynamic formula, configurable per society)
- Payment recording (digital ledger, no gateway)
- PDF receipt generation + WhatsApp delivery
- Expense ledger with categories + running balance
- 5 key automated WhatsApp notifications + bulk broadcast
- Bulk resident import via Excel
- 5 basic reports (PDF + Excel)

### OUT OF SCOPE (Phase 2+)

- Festival fund management
- Election automation (term expiry lockout)
- Payment gateway / online payments
- React Native mobile app (PWA only)
- Multi-language UI (English only)
- Recurring expense templates
- Facility booking, polls, visitor management
- Multiple admin permission levels (only 2 for MVP)
- Resident expense query/dispute module

---

## Key MVP Decisions (Different from Full Spec)

| Decision            | Full Spec                              | MVP                                                   |
| ------------------- | -------------------------------------- | ----------------------------------------------------- |
| Society Code        | Auto-generated from name               | **Admin-chosen** (4-8 alphanumeric, unique)           |
| Fees                | Fixed ₹1,000 joining + ₹1,200 annual   | **Configurable per society**                          |
| Registration fields | 8+ fields                              | **4 mandatory only** (name, mobile, unit, ownership)  |
| Admin levels        | 5 positions + configurable permissions | **2 only**: Primary (full) + Supporting (read+notify) |
| WhatsApp triggers   | 14+ automated                          | **7 triggers** (5 mandatory + 2 optional)             |
| WhatsApp account    | Per-RWA option                         | **Platform-level** single account (Option A)          |
| Society types       | 1 generic                              | **5 types** with dynamic unit addressing              |
| Reports             | 4 detailed reports                     | **5 basic reports**                                   |
| Language            | English + Hindi                        | **English only**                                      |
| Mobile              | React Native app                       | **PWA only**                                          |

---

## Phase Overview

| Phase | Name                   | Duration   | Goal                                            |
| ----- | ---------------------- | ---------- | ----------------------------------------------- |
| 0     | Foundation & Setup     | ~1.5 weeks | DB, auth, project structure, design system      |
| 1     | Super Admin Portal     | ~1.5 weeks | Society onboarding, admin activation, QR poster |
| 2     | Resident Registration  | ~2 weeks   | Self-registration, RWAID, digital card          |
| 3     | Fee Management         | ~2 weeks   | Payment recording, pro-rata, receipts           |
| 4     | Expense Ledger         | ~1 week    | Expense logging, running balance                |
| 5     | WhatsApp Notifications | ~1.5 weeks | 7 triggers, bulk broadcast, SMS fallback        |
| 6     | Migration & Reports    | ~1 week    | Bulk Excel import, 5 reports                    |
| 7     | Security & Launch      | ~1 week    | Security hardening, go-live checklist           |

**Total**: ~12 weeks (with buffer)

---

## Phase Dependencies

```
[Phase 0: Foundation] ────────────────────────────────────┐
         │                                                 │
         ▼                                                 │
[Phase 1: Super Admin] ──→ [Phase 2: Registration]        │
                                    │                      │
                                    ▼                      │
                           [Phase 3: Fees]                 │
                                    │                      │
                          ┌─────────┼──────────┐           │
                          ▼         ▼          ▼           │
               [Phase 4: Expenses]  [Phase 5: Notifications]
                          │         │                      │
                          ▼         ▼                      │
               [Phase 6: Migration & Reports] ◄────────────┘
                          │
                          ▼
               [Phase 7: Security & Launch]
```

**Note**: Phase 4 (Expenses) and Phase 5 (Notifications) can run in parallel.

---

## Document Index

| Document                                                     | Content                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| [database-design.md](database-design.md)                     | Complete MVP schema — all 22 tables, enums, RLS, Prisma models |
| [phase-0-setup.md](phase-0-setup.md)                         | Foundation, DB schema, auth, design system, project structure  |
| [phase-1-super-admin.md](phase-1-super-admin.md)             | Society onboarding, admin activation, Society Code QR          |
| [phase-2-registration.md](phase-2-registration.md)           | Self-registration, edge cases, RWAID, digital ID card          |
| [phase-3-fees.md](phase-3-fees.md)                           | Pro-rata formula, payment recording, receipts, statuses        |
| [phase-4-expenses.md](phase-4-expenses.md)                   | Expense ledger, categories, running balance, corrections       |
| [phase-5-notifications.md](phase-5-notifications.md)         | WhatsApp setup, 7 triggers, bulk broadcast, SMS fallback       |
| [phase-6-migration-reports.md](phase-6-migration-reports.md) | Excel import, validation, 5 reports                            |
| [phase-7-security-launch.md](phase-7-security-launch.md)     | Security hardening, full go-live checklist                     |

---

## Database Strategy

- Build the **full schema** from `database-design.md` on day 1 — all 22 tables
- Phase 2 tables (festivals, admin_terms, expense_queries, visitor_logs) exist but stay empty
- Zero migration pain when Phase 2 features are added
- Key adjustments for MVP:
  - `societies` table: add `joining_fee` and `annual_fee` columns (configurable per society)
  - `societies` table: `society_code` is admin-chosen, not auto-generated
  - `users` table: only 4 mandatory fields enforced at registration
  - Only 2 admin roles needed: PRIMARY + SUPPORTING (read+notify)

---

## Success Criteria

The MVP is **done** when:

1. Super Admin can onboard a new society in under 5 minutes
2. A resident can self-register using a Society Code in under 3 minutes
3. Admin can approve a registration and RWAID card generates automatically
4. Admin can record a payment and receipt reaches resident via WhatsApp within 30 seconds
5. Expense ledger shows running balance visible to all residents
6. Bulk import processes 100+ rows with validation report
7. All 5 reports download correctly as PDF and Excel
8. End-to-end flow works: Society creation → Admin login → Resident registration → Fee recording → Receipt delivery → Expense logging → Report download
