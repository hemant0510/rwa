# Subscription Plans — Hardening, Enforcement & Enterprise Readiness

**Owner:** product/eng
**Created:** 2026-04-23
**Status:** Ready to execute
**Scope:** This plan hardens the already-shipped plans + billing catalog into an enterprise-grade subscription system with runtime feature enforcement, society-facing cycle comparison, a testing playbook, and a prioritised enterprise backlog.

**In scope:** plan catalog UX, which features each plan unlocks, runtime feature gating, plan-switching, add-ons, grandfathering, expiry/suspend lifecycle, and the architecture that supports all of this.

**Out of scope:** the generic platform security baseline (RLS, CSP, session timeout, Sentry install, Privacy/Terms, bulk-upload race safety, etc.). That is shipped and documented in [`../completed/security-and-reliability-hardening.md`](../completed/security-and-reliability-hardening.md) — referenced only where a _subscription-specific surface_ (e.g., the new public plans endpoint) needs to comply with it.

**Reads:** [`subscription_plans.md`](./subscription_plans.md), [`../completed/sa-subscription-billing.md`](../completed/sa-subscription-billing.md). The security baseline is assumed.

### Resolved decisions (2026-04-23)

| Decision                 | Choice                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Feature-gate HTTP status | **402 Payment Required** — distinct from 403 role-denied, clean UpgradePrompt trigger                                                     |
| Add-on pricing model     | **Flat fee per add-on** (e.g., WhatsApp = ₹299/mo) — predictable, easy invoice line                                                       |
| Grandfathering scope     | **Price only — features follow current plan** — `priceLockedAt` on `SocietySubscription`; new features auto-roll to grandfathered cohorts |
| Currency                 | **India-only (INR) for now** — no `currency` column; retrofit later is ~1 week                                                            |

---

## 1. What already exists (audit, 2026-04-23)

The catalog, billing, and cron infrastructure is **already fully shipped**. This plan is about making it _robust_, _enforced_, and _society-facing_.

| Area                                | State                                                                                                       | Evidence                                                                                                                                                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Plan catalog schema                 | ✅ Shipped                                                                                                  | `PlatformPlan` + `PlanBillingOption` + `PlanDiscount` in `supabase/schema.prisma`                                                                                                                                  |
| Feature data model                  | ✅ Shipped                                                                                                  | `PlatformPlan.featuresJson: Json` with keys: `resident_management`, `fee_collection`, `expense_tracking`, `basic_reports`, `advanced_reports`, `whatsapp`, `elections`, `ai_insights`, `api_access`, `multi_admin` |
| Subscription lifecycle              | ✅ Shipped                                                                                                  | `SocietySubscription` + `SocietySubscriptionHistory` with pro-rata                                                                                                                                                 |
| Payments + invoices                 | ✅ Shipped                                                                                                  | `SubscriptionPayment`, `SubscriptionInvoice`, `NotificationLog`                                                                                                                                                    |
| SA plans UI                         | ✅ Shipped                                                                                                  | `src/app/sa/plans/*` (list, new wizard, detail), `src/app/sa/discounts/`                                                                                                                                           |
| SA billing UI                       | ✅ Shipped                                                                                                  | `src/app/sa/billing/{page,invoices,payments}`                                                                                                                                                                      |
| Cron jobs                           | ✅ Shipped                                                                                                  | 9 routes under `src/app/api/cron/*` (expiry, trial, invoice gen, overdue, activation, SLA)                                                                                                                         |
| Seed data                           | ✅ Shipped                                                                                                  | `supabase/seed/plans.ts` — 6 plans × 4 cycles + Flex (monthly only)                                                                                                                                                |
| Core components                     | ✅ Shipped                                                                                                  | `PlanCard`, `FeatureFlagGrid`, `BillingCycleSelector`, `SubscriptionStatusCard`, `PlanSwitchModal`                                                                                                                 |
| **Runtime feature enforcement**     | ❌ **Missing** — features live in `featuresJson` but nothing reads them at request time                     | No matches for `hasFeature` / `FeatureGate` / `requireFeature` outside the Zod schema                                                                                                                              |
| **Society-facing cycle comparison** | ⚠️ Partial — `register-society` page exists but no built UX showing monthly-vs-yearly savings as a headline | `src/app/(auth)/register-society/page.tsx`                                                                                                                                                                         |
| **Testing playbook**                | ❌ Missing                                                                                                  | No documented manual or e2e flow per plan tier                                                                                                                                                                     |

### Difference between the two existing docs

| Doc                                                                               | What it covers                                                                                                                                                 | State in repo                                                                         |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [`plans/subscription_plans.md`](./subscription_plans.md)                          | **Plan catalog + discount engine.** 6 plans, billing cycles, feature matrix, discount types, pro-rata switching, plan CRUD API.                                | Fully shipped — catalog, discounts, switching, seed.                                  |
| [`completed/sa-subscription-billing.md`](../completed/sa-subscription-billing.md) | **Money flow.** `SubscriptionPayment`, `SubscriptionInvoice`, PDF generation, email reminders, cron jobs, 48h correction window, Razorpay (Phase 6, deferred). | Shipped end-to-end except Razorpay (still manual-payment-first as the doc calls out). |

Neither doc covers: **how features actually get enforced in code**, **what the society sees at checkout**, **how SA tests the whole thing end-to-end**, or **what's missing for enterprise customers**. This doc adds those four layers.

---

## 2. Scope (what this plan delivers)

1. **Phase 1 — Society-facing cycle comparison** (Q1). Pricing toggle + savings badges + comparison matrix on `/register-society` and SA onboarding step 2.
2. **Phase 2 — Runtime feature-flag enforcement** (Q2). Single source of truth for feature keys, server guard, React hook, `<FeatureGate>` component, 402 response semantics, upgrade prompts.
3. **Phase 3 — Testing playbook** (Q3). Manual checklist, seed-per-tier helper, cron dry-run endpoints, automated e2e test plan.
4. **Phase 4 — Enterprise robustness backlog** (Q4). Prioritised list of features needed to serve large societies: usage meters, add-ons, custom plans, dunning, GST, grandfathering, revenue analytics.

Out of scope:

- Razorpay integration (covered by `sa-subscription-billing.md` Phase 6).
- Changing the 6 plan prices (product decision).
- Replacing the current discount engine.

---

## 2b. New subscription surfaces that touch the platform baseline

The platform security baseline is [shipped](../completed/security-and-reliability-hardening.md) and assumed. This section is **not** a re-checklist of that baseline — it only lists the few subscription-specific items in this plan that introduce new surfaces and therefore need to comply explicitly.

| New surface                                      | Compliance requirement                                                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/public/plans` (Phase 1 — anonymous) | Documented anonymous-by-design in a file-header comment; rate-limited at 60 req/IP/min.                                                  |
| `GET /api/v1/admin/subscription/me` (Phase 2)    | Uses `getAdminContext` so SA impersonation works (SA-is-GOD).                                                                            |
| SA edit to `PlatformPlan.featuresJson`           | Writes `PLAN_FEATURES_UPDATED` audit log entry with before/after diff. Listed in §4.8 along with other subscription audit action types.  |
| `PlanAddon` + `SocietyAddon` tables (Phase 4)    | Ship with RLS policies in the same migration that creates them — matches the pattern used by existing subscription tables.               |
| 402 on revenue-signalling features               | Emit a Sentry breadcrumb (info level, not error) so sales gets upgrade-wall signal. 402 on a CORE feature pages Sentry as an error.      |
| Subscription E2E paths                           | Phase 3's Playwright suite adds: cross-society subscription isolation, feature-gate bypass with a valid JWT, SA-impersonation coherence. |

Everything not listed above is covered by the existing baseline — no new work.

---

## 2c. Design principles and patterns (SOLID + GoF)

This plan is dense — four phases, two enforcement layers (feature + lifecycle), pricing, add-ons, grandfathering, cron state transitions. Ad-hoc implementation will produce a ball of `if/else` inside route handlers and lose invariants at every layer. Instead, the architecture below decomposes the system along **SOLID** lines and names the **design patterns** used — so reviewers can spot deviations and so new features fit into obvious slots.

### 2c.1 SOLID application

| Principle                     | How it applies here                                                                                                                                                                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S — Single Responsibility** | `PLAN_FEATURES` is pure data (a registry). `FeatureProvider` reads a single source. `FeatureGate` composes providers to answer "is this allowed." Pricing is separate from billing, billing is separate from payments, payments are separate from audit. Each module has one reason to change. |
| **O — Open/Closed**           | Adding a feature ≡ one registry entry. Adding a lifecycle state ≡ one policy file. Adding a pricing model ≡ one `PricingStrategy` implementation. Zero changes to the gate, the middleware, or the routes. The system is extended by _addition_, not modification.                             |
| **L — Liskov Substitution**   | Every `FeatureProvider`, `PricingStrategy`, `LifecyclePolicy` returns the same shape and obeys the same contract. `AddonFeatureProvider` can be swapped for `PlanFeatureProvider` without callers caring. Tests can substitute fakes trivially.                                                |
| **I — Interface Segregation** | `SubscriptionReader` (for gates and UI) is distinct from `SubscriptionWriter` (for commands). Route handlers import only the interface they need — a read-only page never sees a writer handle. Reduces accidental coupling and makes auth surfaces obvious.                                   |
| **D — Dependency Inversion**  | `requireFeature` depends on `FeatureProvider`, not on Prisma. The Prisma-backed implementation is injected at the composition root (`src/lib/subscription/index.ts`). Tests substitute an in-memory provider in two lines — no Prisma mock needed in gate tests.                               |

### 2c.2 Design patterns used (and why)

| Pattern                        | Where                                                                                                                                                    | Why                                                                                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Registry**                   | `PLAN_FEATURES`, `LIFECYCLE_STATES`, `PRICING_STRATEGIES`                                                                                                | Single source of truth per concept. Enforceable via types — the `FeatureKey` type is derived from the registry.                                                                          |
| **Strategy**                   | `PricingStrategy` (flat / per-unit / add-on), `LifecyclePolicy` (one per subscription state), `DiscountTrigger` (coupon / auto / manual / plan-specific) | Algorithms vary; the caller shouldn't care. Swap implementations behind a stable interface.                                                                                              |
| **State**                      | `LifecyclePolicy` encapsulates what each status permits (TRIAL / ACTIVE / EXPIRED / SUSPENDED / CANCELLED / OFFBOARDED)                                  | The status column is inert data; the _policy for that status_ is behaviour that should travel with it.                                                                                   |
| **Chain of Responsibility**    | Feature resolution: `AddonProvider → EntitlementProvider → PlanProvider → Deny`                                                                          | First provider that answers "yes" wins. Lets add-ons and SA-granted entitlements layer on top of the plan without special-casing the gate.                                               |
| **Command**                    | `SwitchPlanCommand`, `RecordPaymentCommand`, `ExpireSubscriptionCommand`, `ReactivateCommand`                                                            | Each mutation has `validate()`, `execute()`, `audit()`. Routes stay thin — they just build and run commands. Auditing is impossible to forget because `audit()` is part of the contract. |
| **Template Method**            | `CronJob` base class for all 9 subscription crons                                                                                                        | Every cron: auth → load → iterate → transition → audit → notify. Concrete jobs fill in the hooks. Eliminates copy-paste drift between crons.                                             |
| **Specification**              | Composable business rules: `IsActive`, `HasFeature`, `UnderResidentLimit`, `WithinGracePeriod`                                                           | Compose with `.and()` / `.or()` instead of nested if-blocks. Each rule is independently testable.                                                                                        |
| **Repository**                 | `SubscriptionRepo`, `PlanRepo`, `InvoiceRepo`, `PaymentRepo`                                                                                             | Prisma calls are contained; route handlers and commands never touch Prisma directly. Enables integration-testing without a DB.                                                           |
| **Facade**                     | `SubscriptionService` in `src/lib/subscription/index.ts`                                                                                                 | Route handlers import one thing. The sprawl inside (`lifecycle/`, `features/`, `pricing/`, `audit/`) is an implementation detail.                                                        |
| **Factory (composition root)** | `createSubscriptionService({ prisma, sentry, logger, clock })`                                                                                           | One place wires concrete implementations. Tests wire in-memory/mock deps without any `jest.mock()` magic.                                                                                |
| **Decorator**                  | Route guards: `requireAuth(requireLifecycle(requireFeature(handler)))`                                                                                   | Each guard wraps the next. Order is explicit and visible in the route file. Works identically for admin, counsellor, SA surfaces.                                                        |
| **Observer / Event emitter**   | Every state transition and every payment fires a typed event consumed by: audit logger, email queue, Sentry breadcrumb, in-app notification log          | Side-effects (email, audit, telemetry) don't contaminate the core transition logic. New consumers plug in without touching command code.                                                 |
| **Clock abstraction**          | `Clock` interface with `now(): Date`, injected everywhere that computes grace/expiry                                                                     | Tests can freeze or fast-forward time. No `new Date()` or `Date.now()` anywhere in domain code. Cron dry-run "as of {date}" is free.                                                     |

### 2c.3 Target module layout

```
src/lib/subscription/
├── features/
│   ├── registry.ts              // PLAN_FEATURES — registry pattern, pure data
│   ├── provider.ts              // interface FeatureProvider
│   ├── plan-provider.ts         // reads PlatformPlan.featuresJson
│   ├── addon-provider.ts        // reads SocietyAddon (Phase 4)
│   ├── entitlement-provider.ts  // reads SocietyEntitlementOverride (§10.4)
│   ├── composite-provider.ts    // chain-of-responsibility resolver
│   └── gate.ts                  // requireFeature / hasFeature / useFeature server helper
├── lifecycle/
│   ├── states.ts                // LIFECYCLE_STATES registry + LifecycleAction type
│   ├── policies/
│   │   ├── index.ts             // map<Status, LifecyclePolicy>
│   │   ├── trial.ts             // state pattern: one file per status
│   │   ├── active.ts
│   │   ├── expired.ts
│   │   ├── suspended.ts
│   │   ├── cancelled.ts
│   │   └── offboarded.ts
│   ├── state-machine.ts         // allowed transitions + validation
│   ├── gate.ts                  // requireLifecycle / isActionAllowed
│   └── commands/                // command pattern
│       ├── expire.ts
│       ├── suspend.ts
│       ├── offboard.ts
│       ├── reactivate.ts
│       └── switch-plan.ts
├── pricing/
│   ├── strategy.ts              // interface PricingStrategy
│   ├── flat.ts                  // for FLAT_FEE plans
│   ├── per-unit.ts              // for Flex
│   ├── addon.ts                 // flat-fee add-ons
│   ├── discount.ts              // applies PlanDiscount to a base price
│   └── calculator.ts            // facade: calculatePrice(plan, cycle, discounts, addons, units)
├── specifications/              // specification pattern
│   ├── index.ts                 // .and() / .or() combinators
│   ├── is-active.ts
│   ├── has-feature.ts
│   ├── under-resident-limit.ts
│   └── within-grace-period.ts
├── repos/                       // repository pattern
│   ├── subscription-repo.ts
│   ├── plan-repo.ts
│   ├── invoice-repo.ts
│   └── payment-repo.ts
├── events/                      // observer / event emitter
│   ├── bus.ts                   // typed event bus
│   ├── types.ts                 // SubscriptionExpired, PaymentRecorded, PlanSwitched, …
│   └── handlers/
│       ├── audit-log-handler.ts
│       ├── email-handler.ts
│       ├── sentry-handler.ts
│       └── in-app-notification-handler.ts
├── clock.ts                     // Clock interface + SystemClock + FrozenClock for tests
├── index.ts                     // composition root: createSubscriptionService({...})
└── types.ts                     // shared domain types
```

Folder structure _is_ the architecture. A reviewer should be able to find "how is the SUSPENDED state's fee-collection rule defined?" → `lifecycle/policies/suspended.ts`. "Where is the flat-fee pricing implemented?" → `pricing/flat.ts`. No hunting.

### 2c.4 Dependency direction (strictly enforced)

```
routes / cron handlers
       │
       ▼
     gates  ──────►  specifications
       │                  │
       ▼                  ▼
  commands ────►  policies (state) ◄──── registries (data)
       │                  │
       ▼                  ▼
      repos             clock
       │
       ▼
    prisma
```

**Rules** (enforced by an ESLint boundary rule):

- Registries and the clock have zero dependencies.
- Policies depend only on registries and the clock.
- Commands depend on repos, policies, and the event bus.
- Gates depend on providers (features) or policies (lifecycle), nothing else.
- Routes depend on gates + commands + the facade. Routes NEVER import Prisma directly.
- Tests can substitute any layer because every layer talks to interfaces, not implementations.

### 2c.5 What this buys us

1. **Extensibility of the subscription layer.** Adding a new plan-gated feature to the catalog = one registry entry + one Zod change + one migration. No gate code changes. **Scope check:** this covers the subscription-plumbing only — building the feature itself (schema, routes, UI, RLS, audit, E2E) still requires the full [security-and-reliability-hardening](../completed/security-and-reliability-hardening.md) baseline. The two checklists are orthogonal and both must be completed. See §11.3 for the honest accounting.
2. **Testability.** Every class is constructor-injected. In-memory fakes everywhere.
3. **Auditability.** Audit calls happen inside commands via the event bus, not inline in routes — so it's impossible to ship a subscription mutation without an audit entry. (For non-subscription mutations, security-doc #3 still applies — `logAudit` is called manually in those routes.)
4. **Consistency.** Every subscription mutation gets the same treatment: validate → execute → audit → notify. No drift between payment-recording and plan-switching code.
5. **Invariant protection.** The state machine rejects illegal transitions at the code boundary (you can't "reactivate" from TRIAL). Prisma-level constraints back this up.
6. **Observable.** The event bus makes adding a new Sentry tag or a new email a 3-line handler, not a code hunt.

### 2c.6 When to break these rules

- Tiny utility modules (e.g. `src/lib/plan-pricing.ts` for a pure savings calculation consumed only by one UI) do not need a full module under `src/lib/subscription/pricing/`. Pragmatism wins — but any code that _mutates_ state or _enforces_ access MUST go through the architecture above.

---

## 3. Phase 1 — Society-facing cycle comparison

**Goal:** when a society registers (self-serve at `/register-society` or via SA at `/sa/societies/new` step 2), the user sees every billing cycle side by side with a headline savings % on yearly and multi-year cycles, so they can make an informed choice.

### 3.1 Savings math — one source of truth

**New file:** `src/lib/plan-pricing.ts`

```typescript
import type { BillingCycle, PlanBillingOption } from "@prisma/client";

export interface CycleSummary {
  cycle: BillingCycle;
  months: number;
  totalPrice: number;
  monthlyEquivalent: number;
  savingsVsMonthly: number; // absolute ₹
  savingsPercent: number; // 0-100, integer
  monthsFree: number; // "2 months free" etc
  isBestValue: boolean; // highest savings % in this plan
}

export function summarizeCycles(options: PlanBillingOption[]): CycleSummary[] {
  /* … */
}
```

Behaviour:

- Monthly row is the baseline: `savingsPercent = 0`, `monthsFree = 0`.
- `savingsPercent = round(100 × (monthlyBase × months − totalPrice) / (monthlyBase × months))`.
- `monthsFree = round((monthlyBase × months − totalPrice) / monthlyBase)`.
- Exactly one cycle across a plan gets `isBestValue = true` — used for the "Best Value" badge.
- Flex plan has only MONTHLY — skip the comparison (show per-unit-per-month note instead).

Unit tests: exhaustive cases using the seed prices from `supabase/seed/plans.ts` so the assertions match production data.

### 3.2 Society-facing plan comparison component

**New component:** `src/components/features/plans/PublicPlanComparison.tsx`

Layout:

```
┌──────────────────────────────────────────────────────────────────┐
│  Choose your billing cycle:  [Monthly] [Annual −17%] [2Y] [3Y −25%]│  ← cycle toggle
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │  Basic   │ │ Basic+   │ │Community │ │   Pro    │ │Entr. AI│ │ ← plan cards
│  │          │ │          │ │Most Pop. │ │          │ │BestVal.│ │
│  │  ₹499/mo │ │  ₹999/mo │ │ ₹1,799/mo│ │ ₹2,999/mo│ │₹4,999/mo│ │
│  │  — or —  │ │  — or —  │ │  — or —  │ │  — or —  │ │ — or — │ │
│  │ ₹4,990/yr│ │ ₹9,990/yr│ │₹17,990/yr│ │₹29,990/yr│ │₹49,990 │ │
│  │ save 17% │ │ save 17% │ │ save 17% │ │ save 17% │ │save 17%│ │
│  │          │ │          │ │          │ │          │ │        │ │
│  │ [Select] │ │ [Select] │ │ [Select] │ │ [Select] │ │[Select]│ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                                  │
│   [▾ Compare features in detail]                                 │  ← collapsible matrix
└──────────────────────────────────────────────────────────────────┘
```

- Cycle toggle at the top is the primary control — switches every card's price simultaneously.
- Each card shows: plan name, badge, resident limit, monthly-equivalent price, total-per-cycle price, savings pill ("Save ₹1,998" or "Save 17%"), top 3–4 features + "N more".
- "Compare features in detail" opens an accordion with the full feature matrix (all 10 features × 6 plans), sticky header.
- "Start Free Trial" CTA below the grid — opt-out of choosing a paid plan today.
- A "Need a custom plan?" link at the bottom → `mailto:sales@…` (enterprise path, §6.3).

### 3.3 Data source for the comparison

**New endpoint:** `GET /api/v1/public/plans`

- Returns only `isActive = true AND isPublic = true` plans with their billing options and `featuresJson`.
- Signed cache: `Cache-Control: public, s-maxage=300` — prices rarely change.
- Shape: `{ plans: Array<{ id, name, slug, badge, residentLimit, features: Record<FeatureKey, boolean>, cycles: CycleSummary[] }> }`.
- **No auth required — explicitly documented as a marketing surface in a file header comment.** Per the security doc's "auth guard on every route" rule, anonymous endpoints must be called out deliberately, not by omission.
- **Rate limited** via `checkRateLimit()` from `src/lib/rate-limit.ts` at 60 req/IP/min to prevent catalog scraping + cache-buster floods. Test: 61st request in the same minute → 429.

### 3.4 Register-society integration

Update `src/app/(auth)/register-society/page.tsx`:

- Add a "Choose your plan" step after "Society basics".
- Default selection: trial (no plan required to complete registration).
- If the user picks a paid plan, they land on `/admin/billing/pay-first-invoice` post-registration with a pre-generated invoice.
- If the user picks trial, create the subscription with `status = TRIAL` and skip payment.

### 3.5 SA onboarding integration

`/sa/societies/new` step 2 already lets SA pick a plan — replace the current dropdown with the same `PublicPlanComparison` component in "SA mode" (shows all plans including `isPublic = false`).

### 3.6 Tests

- Unit: `summarizeCycles` against every seed plan; verify savings percent matches the plan doc table.
- UI: cycle toggle flips prices on every card atomically; feature matrix accordion opens; CTA fires the right mutation; trial CTA bypasses payment.
- Snapshot: one visual-regression snapshot per cycle (monthly / annual / 2Y / 3Y) to catch layout drift.

---

## 4. Phase 2 — Runtime feature-flag enforcement (the big one)

**Goal:** make `featuresJson` actually _do something_. Today it's a data annotation with no enforcement. If a society on Basic opens the WhatsApp page, the page loads — because nothing checks.

This phase builds a **four-layer** enforcement stack so a feature can be introduced, toggled per plan in SA, and the app blocks access automatically.

### 4.1 Layer 1 — Feature registry (single source of truth)

**New file:** `src/lib/plan-features.ts`

```typescript
export const PLAN_FEATURES = {
  RESIDENT_MGMT: {
    key: "resident_management",
    label: "Resident Management",
    description: "Manage residents, units, vehicles, and family members",
    category: "CORE",
    icon: "Users",
    minPlanTier: "BASIC", // cheapest plan that includes this
    editableInSA: false, // locked-on for all paid plans
  },
  FEE_COLLECTION: {
    key: "fee_collection",
    label: "Fee Collection",
    category: "CORE",
    icon: "IndianRupee",
    minPlanTier: "BASIC",
    editableInSA: false,
  },
  EXPENSE_TRACKING: {
    key: "expense_tracking",
    label: "Expense Tracking",
    category: "CORE",
    minPlanTier: "BASIC",
    editableInSA: false,
    icon: "Receipt",
  },
  BASIC_REPORTS: {
    key: "basic_reports",
    label: "Basic Reports",
    category: "REPORTING",
    minPlanTier: "BASIC",
    editableInSA: false,
    icon: "BarChart",
  },
  ADVANCED_REPORTS: {
    key: "advanced_reports",
    label: "Advanced Reports",
    category: "REPORTING",
    minPlanTier: "BASIC_PLUS",
    editableInSA: true,
    icon: "TrendingUp",
  },
  MULTI_ADMIN: {
    key: "multi_admin",
    label: "Multiple Admins (3+)",
    category: "GOVERNANCE",
    minPlanTier: "BASIC_PLUS",
    editableInSA: true,
    icon: "UsersRound",
  },
  WHATSAPP: {
    key: "whatsapp",
    label: "WhatsApp Notifications",
    category: "COMMS",
    minPlanTier: "COMMUNITY",
    editableInSA: true,
    icon: "MessageCircle",
  },
  ELECTIONS: {
    key: "elections",
    label: "Elections Module",
    category: "GOVERNANCE",
    minPlanTier: "PRO",
    editableInSA: true,
    icon: "Vote",
  },
  AI_INSIGHTS: {
    key: "ai_insights",
    label: "AI-Powered Insights",
    category: "AI",
    minPlanTier: "ENTERPRISE",
    editableInSA: true,
    icon: "Sparkles",
  },
  API_ACCESS: {
    key: "api_access",
    label: "API Access",
    category: "INTEGRATIONS",
    minPlanTier: "ENTERPRISE",
    editableInSA: true,
    icon: "Code",
  },
} as const;

export type FeatureKey = (typeof PLAN_FEATURES)[keyof typeof PLAN_FEATURES]["key"];
```

- `key` is the literal string stored in `featuresJson` (matches existing keys — no data migration).
- `minPlanTier` is used by upgrade prompts ("Upgrade to Community to unlock WhatsApp").
- `editableInSA` guards the `FeatureFlagGrid` in SA — CORE features cannot be toggled off.
- `category` powers the grouped UI in the FeatureFlagGrid and the public comparison matrix.

New features get added here first — the rest of the stack picks them up automatically.

### 4.2 Layer 2 — Server guard (SOLID decomposition)

The guard is split into four cooperating units. Each is independently testable; none knows about Prisma except the one implementation at the bottom.

**Interface (`src/lib/subscription/features/provider.ts`):**

```typescript
export interface FeatureProvider {
  has(societyId: string, feature: FeatureKey): Promise<boolean>;
  // Every provider returns the same shape. Substitutable (Liskov).
}
```

**Concrete providers** — each has a single reason to change (Single Responsibility):

```typescript
// src/lib/subscription/features/plan-provider.ts
export class PlanFeatureProvider implements FeatureProvider {
  constructor(private readonly subs: SubscriptionReader) {}
  async has(societyId: string, feature: FeatureKey) {
    const sub = await this.subs.getActive(societyId);
    const flags = (sub?.plan?.featuresJson ?? {}) as Record<string, boolean>;
    return flags[feature] === true;
  }
}

// src/lib/subscription/features/addon-provider.ts  (Phase 4)
export class AddonFeatureProvider implements FeatureProvider {
  constructor(private readonly addons: AddonReader) {}
  async has(societyId: string, feature: FeatureKey) {
    return this.addons.isActive(societyId, feature);
  }
}

// src/lib/subscription/features/entitlement-provider.ts  (§10.4)
export class EntitlementProvider implements FeatureProvider {
  /* … */
}
```

**Chain of responsibility** — composes providers; first "yes" wins (Open/Closed — new providers slot in without touching the gate):

```typescript
// src/lib/subscription/features/composite-provider.ts
export class CompositeFeatureProvider implements FeatureProvider {
  constructor(private readonly chain: FeatureProvider[]) {}
  async has(societyId: string, feature: FeatureKey): Promise<boolean> {
    for (const provider of this.chain) {
      if (await provider.has(societyId, feature)) return true;
    }
    return false;
  }
}
```

**Gate** — the only thing routes call. Depends on `FeatureProvider`, not on any concrete class (Dependency Inversion):

```typescript
// src/lib/subscription/features/gate.ts
export function createFeatureGate(provider: FeatureProvider, subs: SubscriptionReader) {
  return {
    hasFeature: (sid: string, f: FeatureKey) => provider.has(sid, f),
    requireFeature: async (sid: string, f: FeatureKey) => {
      if (await provider.has(sid, f)) return null;
      const sub = await subs.getActive(sid);
      return NextResponse.json(
        {
          error: "FEATURE_NOT_AVAILABLE",
          feature: f,
          currentPlan: sub?.plan?.name ?? null,
          upgradeTo: minPlanForFeature(f),
        },
        { status: 402 },
      );
    },
  };
}
```

**Composition root** — wires concrete implementations once; callers import the facade (`src/lib/subscription/index.ts`):

```typescript
export function createSubscriptionService(deps: {
  prisma: PrismaClient;
  clock: Clock;
  bus: EventBus;
}) {
  const subs = new PrismaSubscriptionRepo(deps.prisma, deps.clock);
  const addons = new PrismaAddonRepo(deps.prisma);

  const featureProvider = new CompositeFeatureProvider([
    new AddonFeatureProvider(addons),
    new EntitlementProvider(new PrismaEntitlementRepo(deps.prisma)),
    new PlanFeatureProvider(subs),
  ]);

  return {
    features: createFeatureGate(featureProvider, subs),
    lifecycle: createLifecycleGate(subs, deps.clock),
    commands: createCommandRegistry({ subs, addons, bus: deps.bus, clock: deps.clock }),
    // …
  };
}

// Singleton for production; tests build their own.
export const subscriptionService = createSubscriptionService({
  prisma,
  clock: systemClock,
  bus: appBus,
});
```

**Route usage** — unchanged ergonomics, fully decoupled internals:

```typescript
import { subscriptionService } from "@/lib/subscription";

export async function POST(req: Request) {
  const auth = await getAdminContext();
  // SA impersonation short-circuits at the auth layer — gate is never asked.
  if (!auth.isSuperAdmin) {
    const gate = await subscriptionService.features.requireFeature(auth.societyId, "whatsapp");
    if (gate) return gate;
  }
  // …
}
```

Key properties:

- **`cache()`** at the `PrismaSubscriptionRepo` level — a single request with 3 feature checks does 1 DB query.
- **402 Payment Required** is the semantically-correct status for "you need to upgrade". Clients distinguish it from 403 (role-denied) — resolved decision at the top of this doc.
- **SUPER_ADMIN bypass** is in the _caller_, not the gate. The gate is pure. Keeps the SA-is-GOD rule explicit in the route.
- **Test strategy** — gate tests inject a `Map<societyId, Set<FeatureKey>>`-backed fake provider. No Prisma mock needed.

**Usage in a route:**

```typescript
// src/app/api/v1/admin/whatsapp/send/route.ts
export async function POST(req: Request) {
  const auth = await getAdminContext();
  const gate = await requireFeature(auth.data.societyId, "whatsapp");
  if (gate) return gate;
  // …normal handler
}
```

**Middleware option (for larger surface areas):** wrap entire route groups via a `matchers` config when the whole route tree belongs to one feature (e.g. `/api/v1/admin/elections/**` → `ELECTIONS`).

### 4.3 Layer 3 — Client hook + component

**New hook:** `src/hooks/useFeature.ts`

```typescript
export function useFeature(feature: FeatureKey): {
  enabled: boolean;
  isLoading: boolean;
  currentPlan: string | null;
  upgradeTo: string | null;
} {
  const { data, isLoading } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => fetch("/api/v1/admin/subscription/me").then((r) => r.json()),
    staleTime: 5 * 60 * 1000, // 5 minutes — plan rarely changes
  });
  const flags = data?.plan?.featuresJson ?? {};
  return {
    enabled: Boolean(flags[feature]),
    isLoading,
    currentPlan: data?.plan?.name ?? null,
    upgradeTo: flags[feature] ? null : getMinPlanForFeature(feature),
  };
}
```

**New endpoint:** `GET /api/v1/admin/subscription/me` — returns the caller's current plan + flags. Uses `getAdminContext` so SA impersonation works.

**New component:** `src/components/features/plans/FeatureGate.tsx`

```tsx
export function FeatureGate({
  feature,
  fallback,
  children,
}: {
  feature: FeatureKey;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { enabled, isLoading, upgradeTo } = useFeature(feature);
  if (isLoading) return <Skeleton />;
  if (!enabled) return fallback ?? <UpgradePrompt feature={feature} upgradeTo={upgradeTo} />;
  return <>{children}</>;
}
```

**New component:** `<UpgradePrompt>` — the default fallback. Shows the feature name, a "Upgrade to {plan}" CTA that deep-links into `/admin/billing?switchTo={planId}`, and a "Contact sales" fallback for enterprise.

**Usage in a page:**

```tsx
export default function WhatsAppSettingsPage() {
  return (
    <FeatureGate feature="whatsapp">
      <WhatsAppSettings />
    </FeatureGate>
  );
}
```

### 4.4 Layer 4 — Navigation shaping

Hide/lock feature-gated menu items in the sidebar so users don't click dead ends.

Update `src/components/layout/AdminSidebar.tsx` (or equivalent):

- Every nav entry gets an optional `feature?: FeatureKey`.
- If set and `!enabled`, the item renders with a lock icon and routes to `UpgradePrompt` instead of the real page.
- Keeps the item visible — _discoverability matters_; hiding entirely kills upsell.

### 4.5 SA edit — respect `editableInSA` + audit every change

Update `src/components/features/plans/FeatureFlagGrid.tsx`:

- For features with `editableInSA: false`, the toggle is rendered locked-on with a tooltip: "Core feature — required on all paid plans."
- Prevents an SA from accidentally shipping a Basic plan with no Resident Management.

Update the plan-update API route (`PATCH /api/v1/super-admin/plans/[id]`):

- Any change to `featuresJson` writes a `logAudit()` entry with:
  - `actionType: "PLAN_FEATURES_UPDATED"` (new — add to enum, §4.8)
  - `resourceType: "PLATFORM_PLAN"`, `resourceId: planId`
  - `metadata: { before: oldFeaturesJson, after: newFeaturesJson, diff: [...changed keys] }`
- This closes security-doc issue #3 for the plans surface. Future audits can answer "when did WhatsApp become available on Basic+?" without archaeology.
- Server validates `editableInSA: false` keys cannot be flipped off — UI lock is defence in depth, not the enforcement boundary.

### 4.6 Observability — Sentry breadcrumbs for upgrade-wall hits

Per security-doc #8, Sentry is the production error layer. `requireFeature` should emit signals too:

- Every 402 on a **revenue-signalling feature** (`api_access`, `elections`, `ai_insights`, `whatsapp`) emits a Sentry breadcrumb with `{ societyId, feature, currentPlan }` — **not** an error (it's expected behaviour). Tagged `level: "info"`, `category: "feature-gate"`.
- Aggregation of these breadcrumbs becomes the "upgrade-wall hit rate" signal sales uses to prioritise outreach.
- Every 402 additionally increments a counter in the in-DB `NotificationLog`-style table scoped to `(societyId, feature, monthKey)` so the SA dashboard can show "Society X bumped the WhatsApp wall 17 times this month — good upsell candidate."
- 402s on **core** features (should never happen — every paid plan has them) ARE errors and page Sentry.

### 4.7 Introducing a new feature (e.g. "Visitor Management")

The whole flow when product adds a new feature:

1. Add entry to `PLAN_FEATURES` in `src/lib/plan-features.ts` with `minPlanTier`.
2. Add the key to `planFeaturesSchema` in `src/lib/validations/plan.ts`.
3. Write a migration script that sets the flag to the right default for each seeded plan (based on `minPlanTier`).
4. Build the feature itself. Wrap server routes with `requireFeature("visitor_mgmt")` and UI with `<FeatureGate feature="visitor_mgmt">`.
5. SA can now toggle it on/off per plan from the existing `FeatureFlagGrid`.

No changes needed to the enforcement plumbing, the comparison matrix, or the SA UI — it all picks up from the registry automatically.

### 4.8 Audit-log action types added by this phase

Add to the `AuditAction` enum in `src/lib/audit.ts`:

| Action type                   | When it fires                                                      |
| ----------------------------- | ------------------------------------------------------------------ |
| `PLAN_FEATURES_UPDATED`       | SA changes `PlatformPlan.featuresJson`                             |
| `PLAN_ADDON_PURCHASED`        | Society buys an add-on (Phase 4.T1)                                |
| `PLAN_ADDON_CANCELLED`        | Society cancels an add-on (Phase 4.T1)                             |
| `SUBSCRIPTION_PRICE_LOCKED`   | SA grandfathers a society's price (Phase 4.T1)                     |
| `SUBSCRIPTION_PRICE_UNLOCKED` | Grandfathering released (plan switch or SA action)                 |
| `FEATURE_ENTITLEMENT_GRANTED` | SA grants a society a feature outside its plan (Phase 4.T2, §10.4) |
| `FEATURE_ENTITLEMENT_REVOKED` | SA revokes an entitlement override                                 |

Each entry carries structured `metadata` (before/after, actor id, reason). Every mutating endpoint added in Phases 2–4 asserts the `logAudit` call in its happy-path test, per the CLAUDE.md rule.

### 4.9 Tests

- `hasFeature`: returns false when no active subscription; true/false based on `featuresJson`; SA impersonation always returns true.
- `requireFeature`: 402 response shape includes `feature` + `upgradeTo`; passes through when enabled.
- `useFeature` hook: returns loading → enabled → not-enabled across state transitions.
- `<FeatureGate>`: renders children when enabled, fallback when not, skeleton when loading.
- Navigation: locked items route to upgrade prompt, not the real page.
- `FeatureFlagGrid` SA edit: core features cannot be toggled off (UI + server validation).

---

## 4B. Phase 2.5 — Subscription lifecycle enforcement (expiry UX)

**Why this phase exists:** today the subscription system _tracks_ expiry but does not _enforce_ it. The cron at [`src/app/api/cron/subscription-expiry-check/route.ts:92-128`](../../src/app/api/cron/subscription-expiry-check/route.ts#L92-L128) correctly flips `SocietySubscription.status` to `EXPIRED` on the period-end date and to `SUSPENDED` seven days later, and both transitions audit to `SocietySubscriptionHistory`. But beyond the status column change, **nothing in the product actually restricts an expired society**. Admins keep writing, residents keep logging in, fees keep getting collected. The only visible signal is a red badge on the SA dashboard.

That means: once a society's yearly plan lapses, there is zero business pressure on the RWA admin to pay. This phase fixes that.

### 4B.1 Audit of current behaviour (2026-04-23)

| Surface                                 | Today                                                                              | File                                                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Status transition (period-end)          | ✅ Works                                                                           | `src/app/api/cron/subscription-expiry-check/route.ts:92-128`                                           |
| Status transition (grace → SUSPENDED)   | ✅ Works (day 7)                                                                   | same file, lines 114-125                                                                               |
| Trial expiry                            | ✅ Works (no grace — trial goes straight to EXPIRED)                               | `src/app/api/cron/trial-expiry-check/route.ts:79-85`                                                   |
| New-resident registration blocked       | ✅ SUSPENDED / OFFBOARDED societies reject new residents                           | `src/app/api/v1/residents/register/route.ts:50`, `src/app/api/v1/societies/by-code/[code]/route.ts:24` |
| Trial banner                            | ✅ Shown on `/admin/*` when trial expired                                          | `src/components/features/TrialBanner.tsx:15-27`                                                        |
| Paid-plan expiry banner                 | ❌ **Missing.** Badge turns red on SA page only — no admin-facing warning          | —                                                                                                      |
| Admin write restrictions when EXPIRED   | ❌ **None.** Admin can create expenses, broadcasts, exemptions, etc. as if ACTIVE  | —                                                                                                      |
| Admin write restrictions when SUSPENDED | ❌ **None.** Same as ACTIVE for logged-in admins                                   | —                                                                                                      |
| Resident restrictions when EXPIRED      | ❌ **None.** Resident login + fee payment + event registration all work            | —                                                                                                      |
| Resident restrictions when SUSPENDED    | ❌ **None.** Same as ACTIVE                                                        | —                                                                                                      |
| Auto-reactivation on payment            | ❌ **Missing.** SA must manually reactivate even after recording a renewal payment | `src/app/api/v1/super-admin/societies/[id]/reactivate/route.ts`                                        |
| Data preservation on expiry             | ✅ No data deleted — all records intact                                            | verified by schema inspection                                                                          |

**The gist:** an expired society today operates at 100% capacity. The business loses leverage the moment a cron flips a status column that the app then ignores.

### 4B.2 The enforcement state machine

This phase defines what each status _means_ for the product, and wires every surface to match.

| Status       | Who can read?     | Admin writes?                                    | Resident writes?                 | Admin banner                                                                                                   | Resident banner                                                |
| ------------ | ----------------- | ------------------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `TRIAL`      | All               | All                                              | All                              | "Trial: N days left. Pick a plan →"                                                                            | None                                                           |
| `ACTIVE`     | All               | All                                              | All                              | None                                                                                                           | None                                                           |
| `EXPIRED`    | All               | **All except upgrades / new residents**          | All                              | **Red banner, non-dismissible**: "Subscription expired. Renew by {suspendDate} to avoid suspension." CTA → pay | None — residents keep full access during grace                 |
| `SUSPENDED`  | All (read-only)   | **Blocked except subscription + billing routes** | **Blocked except view-own-data** | **Blocking modal**: "Society suspended. Contact super admin to reactivate." No dismiss.                        | "Your society's subscription is inactive. Ask your RWA admin." |
| `CANCELLED`  | SA only           | Blocked                                          | Blocked                          | Admin redirected to `/admin/billing/cancelled`                                                                 | "Your society is inactive." — no resident login allowed        |
| `OFFBOARDED` | SA only (archive) | Blocked                                          | Blocked — no login               | Login forbidden                                                                                                | Login forbidden                                                |

Key design decisions (flagged, recommended defaults):

1. **Grace period length.** Currently 7 days. **Recommend: make it plan-specific** via new `PlatformPlan.gracePeriodDays` column — Basic 7d, Pro 14d, Enterprise 30d. Reason: enterprise RWAs have slower finance cycles. See §10 open question on dunning.
2. **Read-only vs blocking in SUSPENDED.** Recommend **blocking modal** on admin side (not read-only). Read-only is tempting but creates a weird in-between UX where admins can browse stale data forever. A hard block drives the conversation with SA faster.
3. **Resident fee collection during EXPIRED.** Recommend **keep open** during the grace window — blocking fee collection punishes the society's _residents_ for the _admin's_ late payment. Cut it off only at SUSPENDED. This is the crucial one for the business model: fee collection is the RWA's primary tool, so "we'll suspend it if you don't pay" is the real lever.
4. **Auto-reactivation on payment.** Recommend **yes, automatic**: when SA records a subscription payment that fully covers an outstanding invoice, the cron-free path also flips `EXPIRED`/`SUSPENDED` back to `ACTIVE` and extends `currentPeriodEnd`. Removes a manual SA step and closes the loop.

### 4B.3 Implementation — State pattern + Strategy

The `switch(sub.status)` inside a single function breaks Open/Closed — every new state forces a file edit and risks missed cases. We apply the **State pattern**: one policy file per status, encapsulating that status's behaviour.

**Actions (`src/lib/subscription/lifecycle/states.ts`):**

```typescript
export type LifecycleAction =
  | "READ" // view own data
  | "ADMIN_WRITE" // create/edit/delete by admin
  | "RESIDENT_WRITE" // resident actions (register for event, update profile)
  | "FEE_COLLECTION" // collect fees from residents — the leverage
  | "ADMIN_UPGRADE" // switch plan, buy add-ons
  | "RESIDENT_LOGIN" // resident opens /r
  | "ADMIN_LOGIN"; // admin opens /admin
```

**Policy interface (`src/lib/subscription/lifecycle/policies/index.ts`):**

```typescript
export interface LifecyclePolicy {
  readonly status: SubscriptionStatus;
  readonly bannerKind: BannerKind;   // NONE / INFO / WARNING / BLOCKING / FORBIDDEN
  readonly allows(action: LifecycleAction): boolean;
  readonly suggestedRedirect?(action: LifecycleAction): string | null;
}
```

**One file per state** (Single Responsibility — the only reason `suspended.ts` changes is if the SUSPENDED rules change):

```typescript
// src/lib/subscription/lifecycle/policies/active.ts
export const activePolicy: LifecyclePolicy = {
  status: "ACTIVE",
  bannerKind: "NONE",
  allows: () => true,
};

// src/lib/subscription/lifecycle/policies/expired.ts
export const expiredPolicy: LifecyclePolicy = {
  status: "EXPIRED",
  bannerKind: "WARNING",
  allows: (action) => action !== "ADMIN_UPGRADE", // everything else open during grace
};

// src/lib/subscription/lifecycle/policies/suspended.ts
export const suspendedPolicy: LifecyclePolicy = {
  status: "SUSPENDED",
  bannerKind: "BLOCKING",
  allows: (action) => action === "READ" || action === "ADMIN_LOGIN" || action === "RESIDENT_LOGIN",
  suggestedRedirect: (action) =>
    action === "ADMIN_WRITE"
      ? "/admin/billing/inactive"
      : action === "RESIDENT_WRITE"
        ? "/r/inactive"
        : null,
};

// src/lib/subscription/lifecycle/policies/offboarded.ts
export const offboardedPolicy: LifecyclePolicy = {
  status: "OFFBOARDED",
  bannerKind: "FORBIDDEN",
  allows: () => false, // even reads blocked — admin redirected to SA contact
};
// …cancelled.ts, trial.ts analogous
```

**Registry** (`index.ts`):

```typescript
export const LIFECYCLE_POLICIES: Record<SubscriptionStatus, LifecyclePolicy> = {
  TRIAL: trialPolicy,
  ACTIVE: activePolicy,
  EXPIRED: expiredPolicy,
  SUSPENDED: suspendedPolicy,
  CANCELLED: cancelledPolicy,
  OFFBOARDED: offboardedPolicy,
};
```

TypeScript's exhaustiveness check on the `Record<SubscriptionStatus, …>` means a new status added to the Prisma enum fails the build until a policy is defined — the compiler enforces the "no forgotten state" invariant.

**Gate** (`src/lib/subscription/lifecycle/gate.ts`) — depends only on the policy registry and the subscription reader:

```typescript
export function createLifecycleGate(subs: SubscriptionReader, clock: Clock) {
  return {
    isActionAllowed: async (sid: string, action: LifecycleAction) => {
      const sub = await subs.getActiveOrLatest(sid);
      if (!sub) return { allowed: false, reason: "NO_SUBSCRIPTION" as const };
      const policy = LIFECYCLE_POLICIES[sub.status];
      return policy.allows(action)
        ? { allowed: true, status: sub.status }
        : {
            allowed: false,
            status: sub.status,
            redirect: policy.suggestedRedirect?.(action) ?? null,
          };
    },

    requireLifecycle: async (sid: string, action: LifecycleAction) => {
      const check = await this.isActionAllowed(sid, action);
      if (!check.allowed) {
        return NextResponse.json(
          {
            error: "SUBSCRIPTION_INACTIVE",
            subscriptionStatus: check.status,
            redirect: check.redirect,
          },
          { status: 402 },
        );
      }
      return null;
    },
  };
}
```

**State machine** (`src/lib/subscription/lifecycle/state-machine.ts`) — validates _transitions_ (complementary to the policies, which validate _actions within a state_):

```typescript
const LEGAL_TRANSITIONS: ReadonlyMap<SubscriptionStatus, readonly SubscriptionStatus[]> = new Map([
  ["TRIAL", ["ACTIVE", "EXPIRED", "CANCELLED"]],
  ["ACTIVE", ["EXPIRED", "CANCELLED"]],
  ["EXPIRED", ["ACTIVE", "SUSPENDED", "CANCELLED"]],
  ["SUSPENDED", ["ACTIVE", "OFFBOARDED", "CANCELLED"]],
  ["CANCELLED", ["ACTIVE"]], // manual SA reactivation only
  ["OFFBOARDED", []], // terminal
]);

export function assertLegalTransition(from: SubscriptionStatus, to: SubscriptionStatus): void {
  if (!LEGAL_TRANSITIONS.get(from)?.includes(to)) {
    throw new IllegalTransitionError(from, to);
  }
}
```

Every `SubscriptionStatus` mutation in any command goes through `assertLegalTransition` before the DB write. Catches "reactivate from TRIAL" bugs at the function boundary, not in production.

**Commands** for transitions (Command pattern — each transition is a reified object with `validate` + `execute` + emits events):

```typescript
// src/lib/subscription/lifecycle/commands/expire.ts
export class ExpireSubscriptionCommand {
  constructor(private deps: { subs: SubscriptionRepo; bus: EventBus; clock: Clock }) {}

  async execute(input: { subscriptionId: string; reason: "PERIOD_END" | "TRIAL_END" }) {
    const sub = await this.deps.subs.findById(input.subscriptionId);
    if (!sub) throw new NotFoundError();
    assertLegalTransition(sub.status, "EXPIRED");
    const updated = await this.deps.subs.transitionStatus(sub.id, "EXPIRED", {
      performedBy: "SYSTEM",
      reason: input.reason,
      at: this.deps.clock.now(),
    });
    this.deps.bus.emit({ type: "SUBSCRIPTION_EXPIRED", payload: updated });
    return updated;
  }
}
```

Every command emits an event. Audit log, Sentry breadcrumb, and email are event handlers — bolted on via the Observer pattern, not woven into transition logic.

**Middleware integration** (`src/middleware.ts`):

- On every `/admin/*` request, resolve `societyId` from the session, call `isActionAllowed(societyId, "ADMIN_WRITE")` for non-GET methods. If blocked with status `SUSPENDED` / `CANCELLED`, redirect to `/admin/billing/inactive` with the status in a query param.
- On every `/r/*` request, same pattern with `"RESIDENT_WRITE"`. Blocked SUSPENDED residents land on `/r/inactive`.
- GETs to `/admin/*` and `/r/*` always allowed (preserve read access — this is the "you always get your data back" guarantee).
- SA impersonation (`/admin/dashboard?sid=...`) bypasses the gate entirely (SA-is-GOD).

**Allowlist routes** that must work even in SUSPENDED (admin side):

- `/admin/billing/*` — so admin can see what's owed and where to pay
- `/admin/profile` — admin's own account
- `/api/v1/admin/subscription/me` — status fetching
- `GET /api/v1/admin/residents` — read-only access preserved
- Logout

**Blocklist routes in SUSPENDED** (admin side): everything else under `/admin/*` (writes) + every `POST/PATCH/DELETE` on `/api/v1/admin/*` except the allowlisted billing/profile routes.

### 4B.4 UI — banners, modals, inactive pages

Three new components:

1. **`<ExpiryBanner>`** — non-dismissible red banner at the top of `/admin/*` when status is `EXPIRED`. Shows "Subscription expired on {date}. Suspend in {N} days. Contact super admin →". Links to `/admin/billing`.
2. **`<SuspendedModal>`** — full-screen blocking modal on `/admin/*` for `SUSPENDED`. No dismiss, no escape. Shows contact info + "What happens to my data" reassurance. Logout button.
3. **`/admin/billing/inactive`** — landing page for middleware-redirected admins. Explains current status, shows outstanding invoice, CTA to "Contact super admin" or (once Razorpay ships) "Pay now to reactivate".

Resident side:

4. **`<ResidentSuspendedBanner>`** — on `/r/*` when society is `SUSPENDED` or `CANCELLED`: "Your society's subscription is inactive. Please ask your RWA admin to renew." Residents can view their profile and history; they cannot pay new fees or register for events.

### 4B.5 Auto-reactivation on payment

Update `POST /api/v1/societies/[id]/subscription/payments` (the route that records a payment):

After a successful payment that brings an outstanding invoice to fully paid, if the society's `SocietySubscription.status` is `EXPIRED` or `SUSPENDED` and the invoice covers the current/next period:

1. In the same transaction that updates the invoice, flip subscription status → `ACTIVE`.
2. Also flip `Society.status` → `ACTIVE` (was set to `SUSPENDED` by the day-7 cron).
3. Extend `currentPeriodStart` / `currentPeriodEnd` based on the invoice's period.
4. Write `SocietySubscriptionHistory` with `changeType: "AUTO_REACTIVATED_ON_PAYMENT"` (new, add to enum).
5. Fire the existing `payment-received` email + a new `subscription-reactivated` email to the RWA admin.

SA no longer needs to click "Reactivate" after recording a payment. Manual reactivation remains available for edge cases (waived invoices, contract adjustments).

### 4B.6 Data retention / OFFBOARDED

Today `OFFBOARDED` exists in the schema but no cron walks `SUSPENDED` → `OFFBOARDED`. Recommendation:

- After **30 days in SUSPENDED** with no payment, cron flips society to `OFFBOARDED`.
- `OFFBOARDED` blocks logins for admins and residents. Data remains intact for **90 days after offboarding** — SA can still restore via a hard reactivation.
- Day 120 after offboarding: admin gets a "data deletion in 30 days" email. Day 150: data is hard-deleted (residents, fees, payments, all PII) — only the `Society` row and audit log survive for compliance.
- All four dates (`suspendedAt`, `offboardedAt`, `deletionWarningAt`, `deletedAt`) are tracked on the `Society` row.

This is the only part of the expiry flow that destroys data. Every earlier state is reversible.

### 4B.7 Tests

- `isActionAllowed`: exhaustive — (5 statuses × 5 actions = 25 cases). Specific: `EXPIRED + FEE_COLLECTION` allowed; `SUSPENDED + FEE_COLLECTION` blocked; `SUSPENDED + READ` allowed.
- Middleware: `/admin/expenses/new` under `SUSPENDED` redirects to `/admin/billing/inactive`; `GET /admin/residents` under `SUSPENDED` loads normally.
- Auto-reactivation: recording a payment that covers the outstanding invoice flips status + writes the history entry + fires email.
- Offboarded-cron: after 30 days SUSPENDED, transitions to OFFBOARDED + resident logins rejected.
- Data-deletion-cron: after 150 days, resident PII is deleted, society row + audit log survive.
- E2E (Phase 3): register Society A → let cron expire it in dry-run → admin sees banner → SA records payment → banner gone, writes re-enabled.

### 4B.8 Acceptance criteria (additions for this phase)

- [ ] Expired society admin sees a non-dismissible red banner on every `/admin/*` page, with remaining grace days counting down.
- [ ] Suspended society admin cannot create expenses, broadcasts, or fee sessions; they land on `/admin/billing/inactive` with clear next steps.
- [ ] Suspended society residents see their dashboard read-only — no new fee payments, no event registration.
- [ ] Grace period during EXPIRED keeps fee collection open (residents still pay) — shut off only at SUSPENDED.
- [ ] SA recording a payment that fully covers the outstanding invoice auto-reactivates the subscription — no manual SA click required.
- [ ] OFFBOARDED cron flips SUSPENDED societies after 30d; data deletion cron fires 150d after offboarding with a 30d email warning at 120d.
- [ ] Every status transition emits `SocietySubscriptionHistory` + a platform audit log entry.
- [ ] All routes under `/admin/billing/*` and `/admin/profile` remain accessible in every status except OFFBOARDED (the admin can always find the way to pay).
- [ ] SA impersonation (`?sid=<expired-society>`) bypasses the gate and can access every page of an EXPIRED or SUSPENDED society (SA-is-GOD rule).

### 4B.9 Policy knobs surfaced to SA

Add to the SA plan editor (`/sa/plans/[id]`):

- `gracePeriodDays: number` (default 7) — days between EXPIRED and SUSPENDED.
- `residentAccessInSuspended: "READ_ONLY" | "BLOCKED"` (default `READ_ONLY`) — lets SA choose harsher posture for certain plan tiers.
- `autoOffboardAfterDays: number` (default 30) — days SUSPENDED before OFFBOARDED.

Per-plan tuning avoids one-size-fits-all decisions about very different customers.

---

## 5. Phase 3 — Testing playbook

**Goal:** a step-by-step runbook a tester (human or CI) can follow to verify the entire subscription surface.

This phase produces **two artefacts**:

1. A new doc: [`plans/subscription_testing_playbook.md`](./subscription_testing_playbook.md) — detailed manual + automated test guide.
2. Code infrastructure: seed-per-tier helper, cron dry-run endpoints, test data fixtures.

### 5.1 Seed-per-tier helper (for local + staging)

**New file:** `supabase/seed/test-societies.ts`

Creates 7 test societies, one per plan tier (Basic → Enterprise + Flex + Trial), each with:

- A deterministic RWA admin (`rwa-{plan-slug}@test.rwaconnect.dev`) — password `Test@1234`.
- 10 seeded residents (so resident limits are well below caps).
- A predictable subscription: Basic → MONTHLY, Basic+ → ANNUAL, Community → 2Y, Pro → 3Y, Enterprise → ANNUAL, Flex → MONTHLY, Trial → TRIAL.
- One seeded invoice (paid or unpaid, alternating) so billing UI has data.

Run via `npm run db:seed:test-tiers`. Idempotent (uses `upsert`).

### 5.2 Manual test matrix (abbreviated — full version in the playbook doc)

| #   | Scenario                                    | Tester role | Expected                                                                         |
| --- | ------------------------------------------- | ----------- | -------------------------------------------------------------------------------- |
| 1   | SA creates a new plan (wizard)              | SA          | Plan visible in list; feature flags editable per registry; billing options saved |
| 2   | Society registers → picks trial             | Anon        | Trial subscription created, 30d limit, Basic+ features enforced                  |
| 3   | Society registers → picks Basic annual      | Anon        | Invoice pre-generated, payment-due banner visible                                |
| 4   | RWA admin on Basic clicks WhatsApp          | RWA admin   | Hits `<UpgradePrompt>`; CTA links to switch-plan modal                           |
| 5   | SA switches society from Basic → Pro        | SA          | Pro-rata calc preview visible; on confirm, new sub ACTIVE, feature flags flip    |
| 6   | SA records a payment                        | SA          | Invoice status → PAID, next period starts, confirmation email queued             |
| 7   | SA reverses payment within 48h              | SA          | Reversal row created, sub reverts to pre-state                                   |
| 8   | SA tries to correct payment after 48h       | SA          | Blocked with "correction window expired"                                         |
| 9   | Society hits resident limit                 | RWA admin   | New-resident creation blocked with upgrade nudge                                 |
| 10  | Cron: expiry check at T-30/7/1/0            | System      | Reminder emails sent, dedup honoured, status flips on T=0                        |
| 11  | Cron: trial expiry                          | System      | Trial moves to EXPIRED, admin banner shown                                       |
| 12  | Cron: invoice generation                    | System      | Next-period invoice generated 30d (ANNUAL+) or 7d (MONTHLY) ahead                |
| 13  | Discount: coupon + manual override combined | SA          | Exactly one discount applies per the priority rules in `subscription_plans.md`   |
| 14  | API access feature — Enterprise only        | Developer   | 402 response on all `/api/public/*` routes for non-Enterprise                    |
| 15  | SA impersonation bypasses feature gate      | SA          | SA on `/admin/dashboard?sid=<basic-society>` can open WhatsApp settings          |

### 5.3 Cron dry-run endpoints

Add a `?dryRun=true&asOf=YYYY-MM-DD` query param to every cron route, guarded behind `NODE_ENV !== "production" || request has `x-cron-dryrun-secret` header`:

- Runs the same logic with `asOf` replacing "today".
- Writes nothing — returns a JSON report of what _would_ have happened (emails queued, status changes, invoices generated).
- Lets SA validate the expiry flow by fast-forwarding dates without mutating data.

Surface this as a "Run cron dry-run" button in `/sa/billing` (dev/staging only).

### 5.4 Automated e2e test harness

**New file:** `tests/e2e/subscription-lifecycle.spec.ts` (Playwright)

Covers the golden paths:

1. Register society → select annual Basic+ → pay via mock → see invoice.
2. Log in as SA → switch that society to Pro → verify pro-rata preview + confirmation.
3. Cron dry-run 30d ahead → assert reminder email logged.
4. SA records payment → invoice flips to PAID → next period starts.
5. Feature gate: Basic society → WhatsApp page → UpgradePrompt visible → switch plan → WhatsApp page now loads.

**Security-doc critical paths covered in the same suite** (per security-doc #9, critical paths #12 + additions):

6. **Cross-society isolation on subscription data.** Log in as RWA admin of Society A. Attempt `GET /api/v1/societies/<B-id>/subscription` → 403. Attempt to switch Society B's plan → 403. Verify the 403 has no body leakage (no plan names, no society names).
7. **Feature-gate bypass attempt.** Take a valid Basic-plan JWT, directly call `POST /api/v1/admin/whatsapp/send` → expect 402 with `{ feature: "whatsapp", upgradeTo: "Community" }`. Confirm the handler did NOT execute (spy on downstream side effects).
8. **SA impersonation coherence.** SA with `?sid=<basic-society>` opens WhatsApp page → allowed (SA-is-GOD). Same SA signs out, logs in as RWA admin of the same society → WhatsApp page shows `<UpgradePrompt>`. Verifies the two auth paths don't conflate.
9. **Rate-limit on `/api/v1/public/plans`.** 61 requests in 60s from same IP → 429 on the 61st.

### 5.5 The testing playbook doc

The full testing doc lives at `execution_plan/plans/subscription_testing_playbook.md` and is authored as Phase 3 ships. It contains:

- 60+ manual test steps (covers every scenario in 5.2, expanded).
- A "test data reset" script (`npm run db:reset-test-data`).
- Screenshot references for each UI state.
- A CI runbook for the Playwright e2e.

Until it's written, §5.2 above is the interim checklist.

---

## 6. Phase 4 — Enterprise robustness backlog

**Goal:** the features that separate a "small-society tool" from an "enterprise-grade RWA platform serving 10,000-unit townships and multi-society management firms." Prioritised for incremental rollout.

### 6.1 Tier 1 — ship within 6 weeks (high impact, moderate effort)

| Feature                         | Problem it solves                                                        | Shape                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Usage meters + soft limits**  | Residents hit their cap and see "blocked" — no warning                   | Show "148 of 150 residents used" from 80% usage. Email RWA admin at 80% / 100%. Block at 110%.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Add-ons**                     | Society on Basic wants WhatsApp but doesn't want to upgrade to Community | New `PlanAddon` model (catalog) + `SocietyAddon` (purchase) with **flat monthly fee** (e.g., WhatsApp = ₹299/mo, independent of plan/size). Society can buy `whatsapp` as an add-on; appears as a separate line on the invoice. Add-on billing cycle always matches the parent subscription's cycle for consolidated invoices. **Both new tables ship with RLS policies in the same migration** (security-doc #1): `PlanAddon` readable by anyone, writable SA-only; `SocietyAddon` scoped to society-isolation like every other society-owned table. `hasFeature()` checks the add-on table before falling through to the plan's `featuresJson`. |
| **Grandfathering (price-only)** | Price changes shouldn't hurt existing customers                          | `SocietySubscription.priceLockedAt` (DateTime) + `priceLockedAmount` (Decimal) — locks only the price. **New features auto-roll to grandfathered cohorts** (no feature fork). Lock released on plan switch; customer can voluntarily accept a new price.                                                                                                                                                                                                                                                                                                                                                                                          |
| **GST handling**                | Indian B2B customers need GST invoices with their GSTIN                  | Add `Society.gstin` + `stateCode`. Invoice PDF splits `baseAmount / cgst / sgst / igst / total`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Upgrade/downgrade preview**   | Society can't see pro-rata impact before confirming                      | `POST /api/v1/societies/[id]/subscription/preview-switch` returns credit/charge/net without mutating.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Revenue analytics dashboard** | Founder has no idea what MRR / ARR / churn is                            | New `/sa/analytics/revenue` — MRR, ARR, new-MRR, churned-MRR, net-new, plan-mix chart, cohort LTV.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

### 6.2 Tier 2 — ship within 3 months (important, larger effort)

| Feature                          | Problem it solves                                                              |
| -------------------------------- | ------------------------------------------------------------------------------ |
| **Custom plans**                 | Enterprise prospect wants bespoke pricing — don't pollute the public catalog   |
| **Dunning workflow**             | Failed-payment retries: day-1 email, day-3 email, day-7 suspend, day-14 cancel |
| **Trial extension**              | SA can extend a trial for a prospect in sales conversation                     |
| **Seat-based add-on billing**    | "Extra admins at ₹199/admin/month" for societies that need more than 3         |
| **Price-lock guarantee**         | Contract-style: "Your price won't change for 24 months"                        |
| **Credit notes + refunds**       | SA can issue a credit note against an invoice; applies to next renewal         |
| **Multi-society org billing**    | A property-mgmt firm running 50 societies gets one consolidated invoice        |
| **Referral / affiliate program** | Societies refer other societies, get a month free                              |
| **Invoice customisation**        | Enterprise wants their logo / branding on the invoice PDF                      |

### 6.3 Tier 3 — enterprise contracts (on-demand, deal-driven)

| Feature                                | Problem it solves                                                     |
| -------------------------------------- | --------------------------------------------------------------------- |
| **SSO (SAML / OIDC)**                  | Enterprise IT requires SSO through their identity provider            |
| **SLA tiers**                          | 99.9% uptime commitment, credit on breach                             |
| **Dedicated support contract**         | Named account manager, priority queue, phone support                  |
| **Data residency choice**              | "Our data must stay in AP-South-1"                                    |
| **Audit log export**                   | SOC2 / ISO27001 compliance — weekly audit trail exports in CSV / JSON |
| **GDPR data export + purge**           | "Forget this resident" — cascading deletion + export bundle           |
| **Sandbox / staging for enterprise**   | A parallel environment SA can reset weekly                            |
| **Dedicated sub-domain / white-label** | `rwa.bigsociety.com` instead of `rwa.rwaconnect.com`                  |

### 6.4 UX / workflow improvements (any time)

- **Plan recommender wizard** — 3 questions (# units, #admins, WhatsApp yes/no) → recommends a plan.
- **"Why Community?" comparison tooltip** — hover a plan badge, see a 2-sentence recommendation.
- **Checkout analytics** — funnel: view plans → pick plan → start checkout → complete. Drop-off report.
- **In-app upgrade banner** — banner on any page gated by a missing feature, not just the feature's own page.
- **Renewal self-service** — RWA admin can renew online (depends on Razorpay Phase 6).
- **Billing contacts** — separate `billingEmail` / `billingContactName` from the admin account; invoices go there.
- **Tax-inclusive display toggle** — Indian buyers prefer "all-inclusive" pricing visible up-front.
- **Yearly-vs-monthly savings calculator** — "You'd save ₹X / year by switching to annual."

---

## 7. Phased Implementation

| Phase | Scope                                                                                                  | Est. effort |
| ----- | ------------------------------------------------------------------------------------------------------ | ----------- |
| 1     | Public cycle comparison UI + `GET /api/v1/public/plans` + pricing util                                 | 2 days      |
| 2     | Feature registry + `requireFeature` + `useFeature` + `<FeatureGate>` + UpgradePrompt + sidebar locking | 3 days      |
| 3     | Testing playbook doc + seed-per-tier + cron dry-run + Playwright e2e                                   | 2 days      |
| 4.T1  | Usage meters + add-ons + grandfathering + GST + switch preview + revenue dashboard                     | 2 weeks     |
| 4.T2  | Custom plans + dunning + trial extension + seat add-ons + credit notes + multi-society billing         | 3 weeks     |
| 4.T3  | SSO + SLAs + audit export + GDPR + white-label (deal-driven, not sprint-driven)                        | on-demand   |

**Phases 1–3 are the immediate work.** Phase 4 is the enterprise backlog — triaged into the roadmap as sales/contracts dictate.

---

## 8. Testing & Quality Gates

Per CLAUDE.md:

- **95% per-file coverage** on every new/changed source file.
- `vi.hoisted()` for all API route mocks.
- Simulate the pre-commit hook before declaring "ready to commit":
  ```bash
  npx vitest related <files> --run --coverage --coverage.provider=v8 --coverage.reporter=text --coverage.thresholds.perFile=true --coverage.thresholds.lines=95 --coverage.thresholds.branches=95 --coverage.thresholds.functions=95 --coverage.thresholds.statements=95
  ```
- New API routes require 3 explicit auth tests (401, 403 / 402, 200-happy-path).
- `requireFeature` + `useFeature` must have exhaustive tests for: no-subscription, TRIAL, ACTIVE, EXPIRED, SUSPENDED, SA-impersonation.
- The public cycle-comparison component needs snapshot tests per cycle + accessibility assertions (keyboard nav through the cycle toggle).

---

## 9. Acceptance Criteria

Done when all of the following hold on staging:

### Phase 1 — Cycle comparison

- [ ] `/register-society` shows all 6 public plans with a working cycle toggle (Monthly / Annual / 2Y / 3Y) that flips every card's price atomically.
- [ ] Every yearly / multi-year card shows "Save ₹X" or "Save N%" relative to monthly.
- [ ] Flex plan shows "₹8 / unit / month" without a misleading cycle comparison.
- [ ] "Compare all features" accordion opens the full 10 × 6 matrix with a sticky header.
- [ ] `GET /api/v1/public/plans` returns all active + public plans, cacheable, no auth required.
- [ ] SA onboarding step 2 uses the same component in "SA mode" (shows `isPublic = false` plans too).

### Phase 2 — Feature enforcement

- [ ] `PLAN_FEATURES` is the single source for every feature key in the codebase.
- [ ] A Basic society hitting `POST /api/v1/admin/whatsapp/send` receives 402 with `{ feature: "whatsapp", upgradeTo: "Community" }`.
- [ ] A Basic society navigating to the WhatsApp page sees `<UpgradePrompt>` — not the real page, not a blank screen.
- [ ] SA impersonation (`/admin/dashboard?sid=<basic-society>`) bypasses every gate and sees every feature.
- [ ] The SA feature-flag grid locks "core" features on (Resident Mgmt, Fee Collection, Expense Tracking, Basic Reports).
- [ ] Adding a new feature key requires touching only `plan-features.ts` + `validations/plan.ts` + one seed migration — no enforcement plumbing changes.

### Phase 3 — Testing

- [ ] `npm run db:seed:test-tiers` creates 7 societies, one per plan, with deterministic logins.
- [ ] Every cron route supports `?dryRun=true&asOf=YYYY-MM-DD` in non-prod and returns a JSON "what-would-happen" report.
- [ ] `execution_plan/plans/subscription_testing_playbook.md` exists and covers the 15 scenarios in §5.2 expanded to 60+ manual steps.
- [ ] Playwright e2e suite (`tests/e2e/subscription-lifecycle.spec.ts`) covers registration → switch → cron → payment → feature-gate in a single run and is CI-wired.

### Phase 4 — Enterprise Tier 1 (stretch)

- [ ] Usage meters: resident-count widget visible at 80% usage with email reminders at 80% / 100%.
- [ ] Add-ons: a Basic society can buy WhatsApp as an add-on without upgrading plan.
- [ ] Pro-rata preview: `POST /api/v1/societies/[id]/subscription/preview-switch` returns credit / charge / net without mutating.
- [ ] GST invoices: PDF splits base/CGST/SGST/IGST based on `Society.stateCode`.
- [ ] Revenue dashboard: `/sa/analytics/revenue` live with MRR, ARR, churn, plan-mix pie chart.

### Quality

- [ ] All new source files hit 95% per-file coverage (pre-commit hook passes for every file).
- [ ] `npm run lint` and `npx tsc --noEmit` are clean.
- [ ] `npm run build` succeeds with no new warnings.

### Architecture (from §2c SOLID + §11 reference)

- [ ] `src/lib/subscription/` directory structure matches §2c.3 exactly — `features/`, `lifecycle/`, `pricing/`, `specifications/`, `repos/`, `events/` each with the files listed.
- [ ] Every interface in §11.1 has exactly one `.ts` file defining it and at least one production + one test implementation.
- [ ] ESLint boundary rule (§11.5) blocks Prisma imports outside `src/lib/subscription/repos/` — CI fails on violation.
- [ ] `LIFECYCLE_POLICIES` registry uses `Record<SubscriptionStatus, LifecyclePolicy>` so TypeScript refuses to compile if a new status lacks a policy.
- [ ] Every command class has `validate()` + `execute()` + emits exactly one event type.
- [ ] No `new Date()` or `Date.now()` anywhere under `src/lib/subscription/` — the ESLint rule catches it; all time flows through the injected `Clock`.
- [ ] Gate tests use `InMemoryFeatureProvider` — no Prisma mock inside gate tests.
- [ ] Adding a new feature touches exactly 3 files: registry, Zod schema, one seed migration. Verified by a `git diff --name-only` on the "Visitor Management" demo PR.
- [ ] `assertLegalTransition` is called by every command that changes `SocietySubscription.status`. Verified by a grep-based test in CI.

### Subscription-specific compliance (from §2b)

- [ ] `GET /api/v1/public/plans` has a file-header comment marking it anonymous-by-design and is rate-limited at 60 req/IP/min.
- [ ] Every SA edit to `PlatformPlan.featuresJson` writes a `PLAN_FEATURES_UPDATED` audit log entry — asserted in the happy-path test.
- [ ] Server-side validation prevents `editableInSA: false` core features from being flipped off, independent of UI lock.
- [ ] 402 on revenue-signalling features emits a Sentry breadcrumb (info level); 402 on a CORE feature pages Sentry as an error.
- [ ] `PlanAddon` and `SocietyAddon` ship with RLS policies in their creation migration.
- [ ] All new subscription audit action types from §4.8 are in the `AuditAction` enum and covered by tests.

---

## 10. Open Questions / Follow-ups

The four headline policy decisions (feature-gate code, add-on pricing, grandfathering scope, currency) are resolved — see the "Resolved decisions" table at the top of this doc. These remain:

1. **Custom plan visibility.** Should bespoke enterprise plans be visible to every SA, or scoped to the specific society? Argues for a `scope: "PUBLIC" | "PRIVATE"` + `restrictedToSocietyId` field on `PlatformPlan`. Needs decision before Tier-2 custom-plans work.
2. **Dunning tone / grace period.** 7-day grace before suspend may be too short for B2B RWAs, where finance cycles are slower. Consider plan-specific (e.g., Enterprise = 30d, Basic = 7d) as a `gracePeriodDays` column on `PlatformPlan`. Decide during Tier-2 dunning design.
3. **Audit trail on plan-features edit.** Every SA change to `featuresJson` should land in the audit log so we can reconstruct "when did feature X become available on plan Y?" — verify existing `logAudit` is wired into the plan-update endpoint during Phase 2; add if missing.
4. **SA override for feature flags.** Should an SA be able to turn on a single feature for a single society without changing their plan (an "entitlement override")? Related to add-ons but operationally distinct — add-ons are self-serve and billed; entitlements are SA-granted and free. Decide before building the SA society-detail page's "Grant feature" workflow.

---

## 11. Architecture reference

This section is the permanent reference for implementers. Everything a reviewer needs to confirm a PR conforms to the architecture is here.

### 11.1 Interface contracts

Every abstraction has exactly one interface in a `.ts` file alongside its implementations. No hidden contracts.

| Interface            | Purpose                                | Implementations (production / test)                                                                                                | Depended on by                           |
| -------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `FeatureProvider`    | Answer "does society have feature X?"  | `PlanFeatureProvider`, `AddonFeatureProvider`, `EntitlementProvider`, `CompositeFeatureProvider`, `InMemoryFeatureProvider` (test) | `FeatureGate`                            |
| `SubscriptionReader` | Read-only subscription access          | `PrismaSubscriptionRepo`, `InMemorySubscriptionRepo` (test)                                                                        | Gates, commands, UI services             |
| `SubscriptionWriter` | Mutating subscription access           | `PrismaSubscriptionRepo` (same class exposes both; interfaces split at the import site per ISP)                                    | Commands only                            |
| `LifecyclePolicy`    | What a status permits                  | one per status: `trialPolicy`, `activePolicy`, `expiredPolicy`, `suspendedPolicy`, `cancelledPolicy`, `offboardedPolicy`           | `LifecycleGate`                          |
| `PricingStrategy`    | Compute price for a plan+cycle+context | `FlatPricingStrategy`, `PerUnitPricingStrategy`, `AddonPricingStrategy`                                                            | `PricingCalculator` facade               |
| `DiscountTrigger`    | Decide if a discount applies           | `CouponCodeTrigger`, `AutoTimeLimitedTrigger`, `PlanSpecificTrigger`, `ManualOverrideTrigger`                                      | `DiscountEvaluator`                      |
| `Specification<T>`   | Composable business rule               | `IsActiveSpec`, `HasFeatureSpec`, `UnderResidentLimitSpec`, `WithinGracePeriodSpec`, `.and()`, `.or()`, `.not()`                   | UI + server (any "can they do X?" check) |
| `EventBus`           | Pub/sub for domain events              | `InProcessEventBus` (prod — handlers run synchronously on emit), `CapturingEventBus` (test — asserts emissions)                    | Commands (emitters), handlers            |
| `Clock`              | Current time                           | `SystemClock`, `FrozenClock` (test)                                                                                                | Every module that computes time          |
| `AuditEmitter`       | Write an entry to the audit log        | `PrismaAuditEmitter`, `CapturingAuditEmitter` (test)                                                                               | Subscribes to `EventBus`                 |

### 11.2 Invariants enforced (and where)

| Invariant                                                                                                                        | Enforcement layer                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A society has at most one `ACTIVE` or `TRIAL` subscription                                                                       | DB partial unique index + `assertLegalTransition` in state machine                                |
| A `SocietySubscription` status can only change via legal transitions                                                             | `assertLegalTransition` before every DB write                                                     |
| Every mutation writes an audit log                                                                                               | `logAudit` is called inside the command's `execute()` — routes cannot skip it                     |
| Core features (`resident_management`, `fee_collection`, `expense_tracking`, `basic_reports`) cannot be toggled off on paid plans | `editableInSA: false` in registry + server-side validation in plan-update route                   |
| SUPER_ADMIN impersonation bypasses feature and lifecycle gates                                                                   | The bypass is in the route handler (explicit), never inside the gate                              |
| Pricing math uses integer paisa, not floating rupees                                                                             | `PricingStrategy` contract returns `{ paisa: number }`; conversion at the UI boundary             |
| A status column flip always pairs with a `SocietySubscriptionHistory` row                                                        | Enforced inside `SubscriptionRepo.transitionStatus()` — repo wraps both writes in one transaction |
| Clock is never read directly                                                                                                     | ESLint rule bans `new Date()` and `Date.now()` under `src/lib/subscription/`                      |

### 11.3 Checklists — how to extend

Every extension has a checklist. A PR that adds a feature without touching `registry.ts` is failing review.

**Add a plan feature (e.g. Visitor Management) — subscription wiring only:**

This checklist only covers making a feature **plan-gated**. Building the feature itself (schema, routes, UI, tests) is normal app work and follows the shipped platform baseline — not repeated here.

- [ ] Add entry to `PLAN_FEATURES` registry in `src/lib/subscription/features/registry.ts`
- [ ] Add the key to `planFeaturesSchema` (Zod) in `src/lib/validations/plan.ts`
- [ ] Write a data migration that sets the flag per seed plan based on `minPlanTier`
- [ ] Wrap server routes with `subscriptionService.features.requireFeature("visitor_mgmt")`
- [ ] Wrap UI with `<FeatureGate feature="visitor_mgmt">`
- [ ] If the feature has a menu item, add `feature` prop to the sidebar config
- [ ] Extend `PublicPlanComparison` feature matrix — picks up automatically from registry
- [ ] Test: 3 gate cases (no sub, plan-with-feature, plan-without-feature)

The 3-file "registry + Zod + seed migration" core is the part this doc guarantees. Everything beyond that (the feature's own tables, routes, tests) is feature work, not subscription work.

**Add a lifecycle state:**

- [ ] Add the enum value in Prisma schema + migration
- [ ] Add the policy file `src/lib/subscription/lifecycle/policies/<status>.ts`
- [ ] Add it to the `LIFECYCLE_POLICIES` registry map (TypeScript will refuse to compile until you do)
- [ ] Update `LEGAL_TRANSITIONS` in `state-machine.ts` with the in/out edges
- [ ] If the state has UI implications, add to `BannerKind` switch in `<LifecycleBanner>`
- [ ] Extend cron jobs that move subscriptions into / out of this state
- [ ] Test: every legal transition + every illegal transition rejected

**Add a pricing strategy (e.g. seat-based):**

- [ ] Add a `planType` enum value in Prisma (if not already covered by FLAT_FEE / PER_UNIT)
- [ ] Implement `PricingStrategy` in `src/lib/subscription/pricing/<strategy>.ts`
- [ ] Register it in the `PRICING_STRATEGIES` factory map keyed by `planType`
- [ ] Extend `PlanBillingOption` schema if the strategy needs per-option config
- [ ] Test: price calculation across all cycles + edge cases (zero units, max units)

**Add a command (new subscription mutation):**

- [ ] Create the command class in `src/lib/subscription/lifecycle/commands/<name>.ts`
- [ ] Implement `validate()` (pure), `execute()` (transactional + emits event)
- [ ] Define the typed event in `src/lib/subscription/events/types.ts`
- [ ] Register the command in `createCommandRegistry` (composition root)
- [ ] Add audit action type to `AuditAction` enum (§4.8)
- [ ] Add Sentry breadcrumb in `sentry-handler.ts` if the command is revenue-signalling
- [ ] Test: happy path, validation failure, illegal-transition rejection, audit fires, event fires

**Add a domain event handler (e.g. "email the counsellor on plan switch"):**

- [ ] Implement the handler in `src/lib/subscription/events/handlers/<name>.ts`
- [ ] Subscribe it to the relevant event types in the composition root
- [ ] The handler MUST be idempotent (events may replay during retries)
- [ ] Test: handler reacts to the event and nothing else

### 11.4 Layered testing strategy

Each layer has a distinct test style — no layer leaks into another's test type.

| Layer              | Test type                 | What gets mocked                                        |
| ------------------ | ------------------------- | ------------------------------------------------------- |
| Registries         | Pure unit                 | Nothing — data tables                                   |
| Policies (State)   | Pure unit                 | Nothing — each policy is a pure function                |
| Specifications     | Pure unit                 | Nothing                                                 |
| Pricing strategies | Pure unit                 | Nothing                                                 |
| Providers          | Unit with fake repos      | Repos (via interface)                                   |
| Gates              | Unit with fake providers  | Providers (via interface)                               |
| Commands           | Integration               | Clock (frozen), EventBus (capturing), repos (in-memory) |
| Event handlers     | Unit with captured events | External services (SMTP, Sentry)                        |
| Repos              | Integration (real Prisma) | Nothing — hit a real Postgres in CI                     |
| Routes             | API route test            | `subscriptionService` (fully in-memory composition)     |
| E2E (Playwright)   | Full stack                | Nothing — real DB, real cron, real emails to MailHog    |

No test ever reaches across layers. A gate test does not need a DB. A command test does not need HTTP. This keeps test runtime under 60s for the whole unit tier.

### 11.5 ESLint boundary rule

Add to `.eslintrc.cjs`:

```js
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [
        {
          "group": ["@/lib/prisma", "@prisma/client"],
          "message": "Subscription domain code must go through SubscriptionRepo. Import from src/lib/subscription instead.",
          "importNames": ["PrismaClient", "prisma"]
        }
      ]
    }]
  },
  "overrides": [
    {
      "files": ["src/lib/subscription/repos/**"],
      "rules": { "no-restricted-imports": "off" }
    }
  ]
}
```

Only `repos/` may import Prisma. Everything else depends on interfaces. If a future refactor moves off Prisma, only `repos/` changes — the rest of the system is untouched.

### 11.6 Design decisions that look wrong but aren't

- **Synchronous event bus.** Handlers run inside the command's transaction. Trade-off: if an email handler fails, the transition can roll back. Alternative (async queue) introduces "transition happened but audit didn't" windows — which is exactly the class of bug the Command pattern is preventing. Pick synchronous until volume forces otherwise; then introduce an outbox pattern.
- **`CompositeFeatureProvider` order matters.** `addon → entitlement → plan` is deliberate — a more-specific grant wins over a less-specific one. Flipping the order silently changes semantics (e.g., a plan downgrade would suddenly strip an SA-granted entitlement).
- **Policies are plain objects, not classes.** No `new ActivePolicy()` — a policy is pure configuration. Classes would add ceremony without behaviour.
- **State-machine transition validation is separate from policy-action validation.** "Can I go from EXPIRED to ACTIVE?" (state machine) is a different question from "Can an admin write in EXPIRED?" (policy). Merging them was tempting; keeping them split means each concern has exactly one source of truth.
- **Specifications use `.and()` / `.or()` method chaining, not functional combinators.** Stylistic — the specification pattern reads closer to business language ("active AND under limit") than `and(active, underLimit)`. Both work; keep the codebase consistent.

---

## 12. Cross-References

- [`plans/subscription_plans.md`](./subscription_plans.md) — Plan catalog, cycle math, discount engine, pro-rata formula.
- [`completed/sa-subscription-billing.md`](../completed/sa-subscription-billing.md) — Payments, invoices, email reminders, cron jobs, 48h correction window.
- [`completed/security-and-reliability-hardening.md`](../completed/security-and-reliability-hardening.md) — Platform-wide RLS / auth / audit / rate-limit / Sentry / E2E / CSP baseline. §2b aligns this plan with it.
- [`plans/counsellor_improved.md`](./counsellor_improved.md) — Similar single-source-of-truth + enforcement pattern applied to counsellor assignments.
- `CLAUDE.md` — 95% per-file coverage rule, SA-is-GOD impersonation, signed-URL test triple.
