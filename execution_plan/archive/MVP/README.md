# RWA Connect — MVP Build Plan

## What This Is

The actionable, build-ready plan for the **first shippable version** of RWA Connect. This is NOT the full product vision (that's in `execution_plan/`). This MVP tells us exactly what to build, what to skip, and what to launch with.

**Source**: `external_docs/RWA_Connect_MVP_v2.0.docx`
**Timeline**: 8-12 weeks
**Status**: Build Ready

---

## MVP Scope — What's IN vs OUT

### IN SCOPE (Build This)

- Super Admin dashboard — onboard societies, activate admins (Super Admin in separate `super_admins` table)
- Society setup with **configurable** joining fee and annual fee
- Society Code (**admin-chosen**, not auto-generated) — no QR poster in Phase 1
- 5 society types with dynamic unit address fields
- Resident registration via **invite-link only** (no Society Code self-registration in Phase 1)
- RWAID **string** generation (format: `RWA-...-YEAR-SEQ`) — no PDF card, no QR code, no WhatsApp image
- Admin approval/rejection of registrations
- Pro-rata fee calculation (dynamic formula, configurable per society)
- Payment recording (digital ledger, no gateway)
- PDF receipt generation + WhatsApp delivery
- Expense ledger with categories + running balance
- Festival fund management (basic: create festival, record contributions, running balance)
- Admin roles and election lifecycle (term tracking, expiry reminders, transition)
- Vehicle registration (basic: self-service add/remove, type, reg number, make, model, colour)
- 5 key automated WhatsApp notifications + bulk broadcast (SMS for OTP only, no full SMS fallback)
- Bulk resident import via Excel
- 5 basic reports (PDF + Excel)
- Auth: **email/password for all users** (no OTP/mobile login). Single `/login` for admin+resident, hidden `/super-admin-login` for super admin.

### OUT OF SCOPE (Phase 2+)

- RWAID Card generation (PDF, QR code, WhatsApp image)
- Self-registration via Society Code (Path B) — invite-link only in Phase 1
- Society Code QR poster generation
- Automated tenant end-of-tenure reminders
- Recurring expense templates
- Resident expense query/escalation
- Audit log admin UI
- Emergency broadcast
- Notification history inbox for residents
- Multi-society context switcher UI
- Property transfer: builder floor partial + inheritance
- Vehicle: parking slot approval + sticker management
- Gate guard vehicle search interface
- Annual sticker reconciliation report
- Festival settlement report (PDF)
- Full SMS fallback stack (SMS kept for OTP only)
- Payment gateway / online payments
- React Native mobile app (PWA only)
- Multi-language UI (English only)
- Facility booking, polls, visitor management
- Multiple admin permission levels (only 2 for MVP)

---

## Key MVP Decisions (Different from Full Spec)

| Decision            | Full Spec                              | MVP v2                                                                |
| ------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| Auth                | OTP/mobile for admin+resident          | **Email/password for ALL users** (no OTP/mobile)                      |
| Super Admin         | In `users` table with SUPER_ADMIN role | **Separate `super_admins` table** (not in `users`)                    |
| Society Code        | Auto-generated from name               | **Admin-chosen** (4-8 alphanumeric, unique)                           |
| Registration        | Society Code self-reg + invite-link    | **Invite-link only** (no Society Code Path B)                         |
| RWAID               | String + PDF card + QR code            | **String only** (no PDF card, no QR, no WhatsApp img)                 |
| Fees                | Fixed ₹1,000 joining + ₹1,200 annual   | **Configurable per society**                                          |
| Registration fields | 8+ fields                              | **4 mandatory only** (name, email, unit, ownership). Mobile optional. |
| Admin levels        | 5 positions + configurable permissions | **2 only**: Primary (full) + Supporting (read+notify)                 |
| WhatsApp triggers   | 14+ automated                          | **7 triggers** (5 mandatory + 2 optional)                             |
| WhatsApp account    | Per-RWA option                         | **Platform-level** single account (Option A)                          |
| SMS                 | Full fallback for all notifications    | **OTP only** (no full SMS fallback stack)                             |
| Society types       | 1 generic                              | **5 types** with dynamic unit addressing                              |
| Reports             | 4 detailed reports                     | **5 basic reports**                                                   |
| Language            | English + Hindi                        | **English only**                                                      |
| Mobile              | React Native app                       | **PWA only**                                                          |

---

## Phase Overview

| Phase | Name                   | Duration   | Goal                                                        |
| ----- | ---------------------- | ---------- | ----------------------------------------------------------- |
| 0     | Foundation & Setup     | ~1.5 weeks | DB, auth (email/password), project structure, design system |
| 1     | Super Admin Portal     | ~1.5 weeks | Society onboarding, admin activation (no QR poster)         |
| 2     | Resident Registration  | ~2 weeks   | Invite-link registration, RWAID string (no PDF card)        |
| 3     | Fee Management         | ~2 weeks   | Payment recording, pro-rata, receipts                       |
| 4     | Expense Ledger         | ~1 week    | Expense logging, running balance                            |
| 5     | WhatsApp Notifications | ~1.5 weeks | 7 triggers, bulk broadcast (SMS for OTP only)               |
| 6     | Migration & Reports    | ~1 week    | Bulk Excel import, 5 reports                                |
| 7     | Security & Launch      | ~1 week    | Security hardening, go-live checklist                       |

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
| [phase-0-setup.md](phase-0-setup.md)                         | Foundation, DB schema, auth (email/password), design system    |
| [phase-1-super-admin.md](phase-1-super-admin.md)             | Society onboarding, admin activation (no QR poster)            |
| [phase-2-registration.md](phase-2-registration.md)           | Invite-link registration, edge cases, RWAID string             |
| [phase-3-fees.md](phase-3-fees.md)                           | Pro-rata formula, payment recording, receipts, statuses        |
| [phase-4-expenses.md](phase-4-expenses.md)                   | Expense ledger, categories, running balance, corrections       |
| [phase-5-notifications.md](phase-5-notifications.md)         | WhatsApp setup, 7 triggers, bulk broadcast (SMS for OTP only)  |
| [phase-6-migration-reports.md](phase-6-migration-reports.md) | Excel import, validation, 5 reports                            |
| [phase-7-security-launch.md](phase-7-security-launch.md)     | Security hardening, full go-live checklist                     |

---

## Database Strategy

- Build the **full schema** from `database-design.md` on day 1
- Phase 2 tables (expense_queries, visitor_logs, etc.) exist but stay empty
- Zero migration pain when Phase 2 features are added
- Key adjustments for MVP v2:
  - **New `SuperAdmin` model** — separate table, not in `users` (id, authUserId, email, name, isActive, timestamps)
  - **New `Vehicle` model** — self-service registration (id, unitId, societyId, vehicleType, registrationNumber, make, model, colour, parkingSlot, stickerNumber, evSlot, validFrom, validTo, isActive, timestamps)
  - `users` table: `email` is now **required**, `mobile` is now **optional** (kept for WhatsApp)
  - `UserRole` enum: only `RWA_ADMIN` and `RESIDENT` (no `SUPER_ADMIN` — super admin is separate)
  - `Unit` model: new fields `unitType`, `areaInSqft`, `parkingSlotsAllotted`, `evChargingSlot`, `unitStatus`
  - `societies` table: add `joining_fee` and `annual_fee` columns (configurable per society)
  - `societies` table: `society_code` is admin-chosen, not auto-generated
  - Only 2 admin roles needed: PRIMARY + SUPPORTING (read+notify)

---

## Success Criteria

The MVP is **done** when:

1. Super Admin can onboard a new society in under 5 minutes
2. A resident can register via invite-link in under 3 minutes
3. Admin can approve a registration and RWAID string is generated automatically
4. Admin can record a payment and receipt reaches resident via WhatsApp within 30 seconds
5. Expense ledger shows running balance visible to all residents
6. Residents can self-service add/remove vehicles
7. Basic festival fund management works (create, contribute, view balance)
8. Bulk import processes 100+ rows with validation report
9. All 5 reports download correctly as PDF and Excel
10. End-to-end flow works: Society creation → Admin login (email/password) → Resident registration (invite-link) → Fee recording → Receipt delivery → Expense logging → Report download
