# RWA Connect — Full Product Execution Plan

**Source**: `external_docs/RWA_Connect_Full_Spec_v3.0.docx` (24 Sections, 18 Enum Groups)
**Timeline**: ~12-18 months total (MVP first 3 months, then progressive phases)
**Status**: Planning Complete

---

## Relationship to MVP

The MVP (`execution_plan/MVP/`) covers the **first shippable version** — Phases 1-2 of this plan. This document extends beyond MVP to the complete product vision: festivals, elections, recurring expenses, mobile app, payment gateway, visitor management, white-label, and global expansion.

**Build order**: MVP first → ship → then Phase 3+ features progressively.

```
execution_plan/MVP/         ← What to build FIRST (8-12 weeks)
execution_plan/full_spec/   ← THIS — the complete product roadmap (12-18 months)
```

---

## Phase Overview

| Phase | Name                       | Duration   | Goal                                                                                  | Depends On |
| ----- | -------------------------- | ---------- | ------------------------------------------------------------------------------------- | ---------- |
| 1     | Foundation & Setup         | ~2 weeks   | DB (full schema), auth, layouts, design system, i18n                                  | —          |
| 2     | Core MVP                   | ~8 weeks   | Super Admin + Registration + Fees + Expenses + Notifications + Migration + Reports    | Phase 1    |
| 3     | Financial Advanced         | ~4 weeks   | Festival funds, recurring expenses, resident expense queries, advanced reports        | Phase 2    |
| 4     | Election & Admin Lifecycle | ~3 weeks   | Admin terms, election transitions, property transfers, status management              | Phase 2    |
| 5     | Notifications Advanced     | ~2 weeks   | Per-RWA WhatsApp numbers, push notifications, email channel, notification centre      | Phase 2    |
| 6     | Mobile App & Payments      | ~6 weeks   | React Native app, Razorpay integration, auto-reconciliation                           | Phase 2    |
| 7     | Community Features         | ~4 weeks   | Visitor pre-registration, domestic help, AGM, notice board, vendor management, polls  | Phase 3    |
| 8     | Enterprise & Global        | ~6+ months | White-label, multi-language (8+ langs), international expansion, AI anomaly detection | Phase 6    |

**Total**: ~12-18 months (with buffer and progressive shipping)

---

## Phase Dependencies

```
[Phase 1: Foundation] ──────────────────────────────────────────┐
         │                                                       │
         ▼                                                       │
[Phase 2: Core MVP] ◄── This IS the MVP build                   │
         │                                                       │
         ├──────────────────┬──────────────────┐                 │
         ▼                  ▼                  ▼                 │
[Phase 3: Financial]  [Phase 4: Elections]  [Phase 5: Notif.]   │
         │                  │                  │                 │
         ├──────────────────┘                  │                 │
         ▼                                     │                 │
[Phase 6: Mobile & Payments] ◄─────────────────┘                │
         │                                                       │
         ▼                                                       │
[Phase 7: Community Features] ◄──────────────────────────────────┘
         │
         ▼
[Phase 8: Enterprise & Global]
```

**Parallelisable**: Phases 3, 4, 5 can run concurrently after Phase 2 ships.

---

## What's Different from MVP

| Feature            | MVP                        | Full Spec                                              |
| ------------------ | -------------------------- | ------------------------------------------------------ |
| Admin levels       | 2 (Primary + Supporting)   | 5 positions with configurable permissions              |
| Ownership types    | Owner / Tenant             | Owner / Owner-NRO / Joint Owner / Tenant               |
| Resident statuses  | 12                         | 14 (adds ACTIVE_LIFETIME, MIGRATED_DORMANT)            |
| Fee statuses       | 6                          | 8 (adds ADVANCE_PAID, LIFETIME)                        |
| Payment modes      | 4 (Cash, UPI, Bank, Other) | 5 (adds CHEQUE, ONLINE via gateway)                    |
| Expense categories | 9                          | 11 (adds FESTIVAL, LEGAL)                              |
| Notifications      | 7 triggers, WhatsApp+SMS   | 14+ triggers, WhatsApp+SMS+Push+Email                  |
| WhatsApp account   | Platform-level only        | Per-RWA option in Phase 5                              |
| Festival funds     | Not included               | Full lifecycle (create, collect, spend, settle)        |
| Elections          | Not included               | Full lifecycle (terms, reminders, transitions)         |
| Property transfers | Not included               | 4 types (sale, tenant departure, partial, inheritance) |
| Mobile app         | PWA only                   | React Native (iOS + Android)                           |
| Payments           | Manual ledger only         | Razorpay/PayU gateway with auto-reconciliation         |
| Language           | English only               | English + Hindi + 6 regional + Arabic (RTL)            |
| Visitor management | Not included               | Pre-registration + QR verification                     |
| Reports            | 5 basic                    | 10+ with charts and PDF/Excel                          |
| i18n               | Not included               | next-intl with 8+ locales                              |

---

## Document Index

| Document                                                 | Content                                                                            |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [README.md](README.md)                                   | This file — master overview                                                        |
| [database-design.md](database-design.md)                 | Complete v3.0 schema — all 21+ tables, all enums, RLS, Prisma models               |
| [enums-reference.md](enums-reference.md)                 | All 18 enum groups from Section 19 — single source of truth                        |
| [phase-1-foundation.md](phase-1-foundation.md)           | DB, auth, project structure, design system, i18n, CI                               |
| [phase-2-core.md](phase-2-core.md)                       | Super Admin + Registration + Fees + Expenses + Notifications + Migration + Reports |
| [phase-3-financial.md](phase-3-financial.md)             | Festival funds, recurring expenses, expense queries, advanced reports              |
| [phase-4-elections.md](phase-4-elections.md)             | Admin terms, election lifecycle, property transfers, resident status mgmt          |
| [phase-5-notifications.md](phase-5-notifications.md)     | Per-RWA WhatsApp, push notifications, email, notification centre                   |
| [phase-6-mobile-payments.md](phase-6-mobile-payments.md) | React Native app, Razorpay integration, auto-reconciliation                        |
| [phase-7-community.md](phase-7-community.md)             | Visitors, domestic help, AGM, notice board, vendors, polls                         |
| [phase-8-enterprise.md](phase-8-enterprise.md)           | White-label, multi-language, international, AI anomaly detection                   |

---

## Success Criteria (Full Product)

1. **Phase 2**: MVP shipped — end-to-end flow works for 1 real society
2. **Phase 3**: Festival fund lifecycle complete — create, collect, spend, settle, report
3. **Phase 4**: Admin term expires → auto-downgrade → new admin activated → zero data loss
4. **Phase 5**: Per-RWA WhatsApp sender working, push notifications on PWA
5. **Phase 6**: Resident pays via Razorpay UPI → payment auto-reconciles → receipt sent
6. **Phase 7**: Visitor pre-registers → QR code → gate verifies → host notified
7. **Phase 8**: White-label client sees own branding, UAE society uses AED currency + Arabic RTL

---

## Business Model Integration

| Plan       | Price/mo | Residents         | WhatsApp   | Features                             |
| ---------- | -------- | ----------------- | ---------- | ------------------------------------ |
| Basic      | ₹999     | ≤100              | Email only | Core membership + fees               |
| Standard   | ₹1,999   | ≤500              | 500/mo     | + WhatsApp + festivals + broadcast   |
| Premium    | ₹3,999   | Unlimited         | 2,000/mo   | + API access + custom RWAID branding |
| Enterprise | Custom   | Multi-society     | Unlimited  | + White-label + dedicated support    |
| Trial      | Free/60d | Standard features | —          | No credit card required              |

Revenue at scale: 1% of India's ~1,50,000 RWAs = ~₹30L/month = ₹3.6Cr/year.
