# Subscription Plans — Complete Reference

## Overview

RWA Connect uses a fully dynamic, DB-driven subscription engine. Super Admin creates and manages plans from the UI at `/sa/plans`. Societies select a plan during onboarding or switch later from their detail page.

---

## The 7 Plans

| #   | Plan Name     | Type     | Monthly Price | Resident Limit | Badge                  |
| --- | ------------- | -------- | ------------- | -------------- | ---------------------- |
| 1   | Basic         | Flat Fee | ₹499/mo       | 150 units      | —                      |
| 2   | Basic+        | Flat Fee | ₹999/mo       | 300 units      | —                      |
| 3   | Community     | Flat Fee | ₹1,799/mo     | 750 units      | Most Popular           |
| 4   | Pro           | Flat Fee | ₹2,999/mo     | 2,000 units    | —                      |
| 5   | Enterprise AI | Flat Fee | ₹4,999/mo     | Unlimited      | Best Value             |
| 6   | Flex          | Per-Unit | ₹8/unit/mo    | None (scales)  | —                      |
| —   | Trial         | System   | Free          | 50 units       | (auto, not selectable) |

---

## Billing Cycles & Pricing (Flat Fee Plans)

| Cycle   | Duration  | Price Formula | Effective Discount       |
| ------- | --------- | ------------- | ------------------------ |
| Monthly | 1 month   | Base × 1      | —                        |
| Annual  | 12 months | Base × 10     | ~17% off (2 months free) |
| 2-Year  | 24 months | Base × 20     | ~17% off compounded      |
| 3-Year  | 36 months | Base × 27     | ~25% off (9 months free) |

**Flex plan** only supports Monthly billing (price scales with resident count snapshot).

---

## Plan Features Matrix

| Feature                | Basic | Basic+ | Community | Pro | Enterprise AI | Flex |
| ---------------------- | ----- | ------ | --------- | --- | ------------- | ---- |
| Resident Management    | ✅    | ✅     | ✅        | ✅  | ✅            | ✅   |
| Fee Collection         | ✅    | ✅     | ✅        | ✅  | ✅            | ✅   |
| Expense Tracking       | ✅    | ✅     | ✅        | ✅  | ✅            | ✅   |
| Basic Reports          | ✅    | ✅     | ✅        | ✅  | ✅            | ✅   |
| Advanced Reports       | ❌    | ✅     | ✅        | ✅  | ✅            | ❌   |
| Multi Admin (3+)       | ❌    | ✅     | ✅        | ✅  | ✅            | ❌   |
| WhatsApp Notifications | ❌    | ❌     | ✅        | ✅  | ✅            | ❌   |
| Elections Module       | ❌    | ❌     | ❌        | ✅  | ✅            | ❌   |
| AI Insights            | ❌    | ❌     | ❌        | ❌  | ✅            | ❌   |
| API Access             | ❌    | ❌     | ❌        | ❌  | ✅            | ❌   |

**Trial** uses Basic+ feature access for 30 days.

---

## Pricing Table (All Plans × All Cycles)

### Basic (₹499/mo base)

| Cycle   | Total Price | Saves  |
| ------- | ----------- | ------ |
| Monthly | ₹499        | —      |
| Annual  | ₹4,990      | ₹998   |
| 2-Year  | ₹9,980      | ₹1,996 |
| 3-Year  | ₹13,473     | ₹4,491 |

### Basic+ (₹999/mo base)

| Cycle   | Total Price | Saves  |
| ------- | ----------- | ------ |
| Monthly | ₹999        | —      |
| Annual  | ₹9,990      | ₹1,998 |
| 2-Year  | ₹19,980     | ₹3,996 |
| 3-Year  | ₹26,973     | ₹8,991 |

### Community (₹1,799/mo base)

| Cycle   | Total Price | Saves   |
| ------- | ----------- | ------- |
| Monthly | ₹1,799      | —       |
| Annual  | ₹17,990     | ₹3,598  |
| 2-Year  | ₹35,980     | ₹7,196  |
| 3-Year  | ₹48,573     | ₹16,191 |

### Pro (₹2,999/mo base)

| Cycle   | Total Price | Saves   |
| ------- | ----------- | ------- |
| Monthly | ₹2,999      | —       |
| Annual  | ₹29,990     | ₹5,998  |
| 2-Year  | ₹59,980     | ₹11,996 |
| 3-Year  | ₹80,973     | ₹26,991 |

### Enterprise AI (₹4,999/mo base)

| Cycle   | Total Price | Saves   |
| ------- | ----------- | ------- |
| Monthly | ₹4,999      | —       |
| Annual  | ₹49,990     | ₹9,998  |
| 2-Year  | ₹99,980     | ₹19,996 |
| 3-Year  | ₹1,34,973   | ₹44,991 |

### Flex (₹8/unit/mo)

| Cycle   | Price               | Notes                                             |
| ------- | ------------------- | ------------------------------------------------- |
| Monthly | ₹8 × resident count | Billed monthly, count snapshotted at period start |

---

## Free Trial

- **Duration**: 30 days from society creation
- **Feature access**: Basic+ level (advanced reports, multi-admin)
- **Resident limit**: 50 units maximum
- **Status**: `TRIAL` on `SocietySubscription`
- **How applied**: Auto-created on self-registration (`/register-society`); SA-onboarded societies can optionally skip or be assigned a paid plan immediately
- **After trial ends**: Society moves to `EXPIRED` status; admin must contact SA or upgrade

---

## Discount System

### Discount Types

| Trigger Type        | Description                               | Use Case                           |
| ------------------- | ----------------------------------------- | ---------------------------------- |
| `COUPON_CODE`       | Society enters a code at checkout         | Referral, promotional campaigns    |
| `AUTO_TIME_LIMITED` | Automatically applies within a date range | Launch offers, seasonal discounts  |
| `PLAN_SPECIFIC`     | Auto-applies to specific plans only       | Introductory pricing on new plan   |
| `MANUAL_OVERRIDE`   | SA manually applies to a specific society | Negotiated deals, retention offers |

### Discount Value Types

| Type          | Example | Effect                       |
| ------------- | ------- | ---------------------------- |
| `PERCENTAGE`  | 40      | 40% off the plan price       |
| `FLAT_AMOUNT` | 500     | ₹500 flat off the plan price |

### Discount Scope

- **Applies to all plans**: Discount works on any plan
- **Specific plans**: SA selects which plan IDs the discount applies to
- **Allowed billing cycles**: Optionally restrict to MONTHLY, ANNUAL, etc. (empty = all cycles)

### Discount Limits

- `maxUsageCount`: Max number of times the coupon can be used across all societies (null = unlimited)
- `startsAt` / `endsAt`: Date range (null = open-ended)
- `isActive`: Soft toggle to instantly enable/disable

---

## Plan Switching (Pro-Rata)

When a society switches plans mid-cycle:

```
credit  = (oldPlanPrice / daysInPeriod) × daysRemaining
charge  = (newPlanPrice / daysInPeriod) × daysRemaining
netAmount = charge - credit

netAmount > 0  → Society owes this amount (upgrade)
netAmount < 0  → Credit applied to society (downgrade)
netAmount = 0  → No adjustment needed
```

**Implementation**: `src/lib/utils/pro-rata.ts`

The switch is **immediate** — new plan access takes effect the moment SA confirms. Old subscription is set to `EXPIRED`, new `SocietySubscription` record is created with new plan + billing option.

---

## Database Models

```
PlatformPlan              — Plan definitions (name, type, features, limits)
  └─ PlanBillingOption    — Billing cycles + prices per plan

PlanDiscount              — Discount definitions (all 4 trigger types)

SocietySubscription       — Active subscription for a society (one at a time)
  └─ SocietySubscriptionHistory — Full audit trail of all plan changes
```

### Key Fields — `SocietySubscription`

| Field                | Type     | Purpose                                          |
| -------------------- | -------- | ------------------------------------------------ |
| `societyId`          | FK       | Links to Society                                 |
| `planId`             | FK       | Which plan (null during trial)                   |
| `billingOptionId`    | FK       | Which billing cycle option                       |
| `status`             | Enum     | TRIAL / ACTIVE / EXPIRED / CANCELLED / SUSPENDED |
| `currentPeriodStart` | DateTime | When current billing period started              |
| `currentPeriodEnd`   | DateTime | When current billing period ends                 |
| `discountId`         | FK?      | Applied discount (if any)                        |
| `customDiscountPct`  | Decimal? | Manual override % from SA                        |
| `finalPrice`         | Decimal? | Effective price after discounts                  |
| `unitCountSnapshot`  | Int?     | Resident count at period start (Flex plan)       |

---

## API Endpoints

### Plans (Super Admin)

| Method | Endpoint                                         | Action                     |
| ------ | ------------------------------------------------ | -------------------------- |
| GET    | `/api/v1/super-admin/plans`                      | List all plans             |
| POST   | `/api/v1/super-admin/plans`                      | Create plan                |
| GET    | `/api/v1/super-admin/plans/[id]`                 | Plan detail                |
| PATCH  | `/api/v1/super-admin/plans/[id]`                 | Edit plan                  |
| DELETE | `/api/v1/super-admin/plans/[id]`                 | Archive plan (soft delete) |
| POST   | `/api/v1/super-admin/plans/[id]/billing-options` | Add billing cycle          |
| POST   | `/api/v1/super-admin/plans/reorder`              | Reorder display order      |

### Discounts (Super Admin)

| Method | Endpoint                                 | Action               |
| ------ | ---------------------------------------- | -------------------- |
| GET    | `/api/v1/super-admin/discounts`          | List discounts       |
| POST   | `/api/v1/super-admin/discounts`          | Create discount      |
| PATCH  | `/api/v1/super-admin/discounts/[id]`     | Edit discount        |
| DELETE | `/api/v1/super-admin/discounts/[id]`     | Deactivate discount  |
| POST   | `/api/v1/super-admin/discounts/validate` | Validate coupon code |

### Subscriptions

| Method | Endpoint                                             | Action                 |
| ------ | ---------------------------------------------------- | ---------------------- |
| GET    | `/api/v1/societies/[id]/subscription`                | Current subscription   |
| POST   | `/api/v1/societies/[id]/subscription`                | Assign plan            |
| PATCH  | `/api/v1/societies/[id]/subscription/switch`         | Switch plan (pro-rata) |
| POST   | `/api/v1/societies/[id]/subscription/apply-discount` | Apply manual discount  |
| GET    | `/api/v1/societies/[id]/subscription/history`        | Change history         |

---

## UI Pages

| Page               | Path                 | Purpose                                               |
| ------------------ | -------------------- | ----------------------------------------------------- |
| Plans List         | `/sa/plans`          | Grid of all plans, Active/Archived tabs               |
| Create Plan        | `/sa/plans/new`      | 4-step wizard: Info → Billing → Features → Preview    |
| Plan Detail        | `/sa/plans/[id]`     | Edit plan, manage billing cycles, view subscribers    |
| Discounts          | `/sa/discounts`      | List + inline create/edit all discount types          |
| Society Onboarding | `/sa/societies/new`  | Step 2 of 4 is plan selection                         |
| Society Detail     | `/sa/societies/[id]` | `SubscriptionStatusCard` with Switch / Apply Discount |

---

## Key Files

| File                                                              | Purpose                                    |
| ----------------------------------------------------------------- | ------------------------------------------ |
| `src/types/plan.ts`                                               | TypeScript interfaces + label maps         |
| `src/types/discount.ts`                                           | Discount interfaces + label maps           |
| `src/types/subscription.ts`                                       | Subscription interfaces                    |
| `src/services/plans.ts`                                           | Client fetch wrappers for plans API        |
| `src/services/discounts.ts`                                       | Client fetch wrappers for discounts API    |
| `src/services/subscriptions.ts`                                   | Client fetch wrappers for subscription API |
| `src/lib/utils/pro-rata.ts`                                       | Pro-rata calculation utility               |
| `src/lib/validations/plan.ts`                                     | Zod schemas for plan CRUD                  |
| `src/lib/validations/discount.ts`                                 | Zod schemas for discount CRUD              |
| `src/lib/validations/subscription.ts`                             | Zod schemas for assign/switch/discount     |
| `src/components/features/plans/PlanCard.tsx`                      | Plan display card                          |
| `src/components/features/plans/BillingCycleSelector.tsx`          | Billing cycle picker                       |
| `src/components/features/plans/FeatureFlagGrid.tsx`               | Feature toggle grid                        |
| `src/components/features/subscription/SubscriptionStatusCard.tsx` | Society subscription status                |
| `src/components/features/subscription/PlanSwitchModal.tsx`        | Plan switch dialog                         |
| `supabase/seed/plans.ts`                                          | Seeds all 6 plans + billing options        |
