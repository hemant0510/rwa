# Pre-Auth Experience — Home Page Redesign + Marketing Site + Auth Navigation Fix

**Owner:** product/eng
**Created:** 2026-04-27
**Status:** Ready to execute
**Scope:** Everything an unauthenticated visitor sees — home page, supporting marketing pages, the public site shell (header/footer), the navigation bug between auth and home, public SEO metadata, and the legal/trust pages that round out a credible B2B SaaS landing experience.

**Reads:** [`subscription_plans.md`](../completed/subscription_plans.md) (plans + pricing source of truth), [`subscription_plans_hardening.md`](./subscription_plans_hardening.md) (Phase 1 cycle comparison overlaps with the public pricing page).

---

## 1. Why this plan exists

Two concrete symptoms drove this work:

1. **The home page is functional but flat.** A single hero, a 6-card feature grid, and a one-line footer. No social proof, no pricing, no screenshots, no contact, no FAQ, no testimonials, no story. For a platform that handles residents' money and PII, this looks like a side project, not a product an RWA secretary trusts with their society.
2. **There is no way back from `/login` or `/register-society` to `/`.** The auth layout ([`src/app/(auth)/layout.tsx`](<../../src/app/(auth)/layout.tsx>)) is a centered card with no header. Once you click "Sign In" or "Register Society" from the home page, the only way back is the browser back button. The Building2 logo on the login form is a static `<div>`, not a `<Link>`. The privacy page's only back-link points to `/login`, not `/`.

The fix is not just one extra link — it is to treat the unauthenticated experience as a first-class product surface with its own layout, its own information architecture, and its own quality bar. This plan defines that surface end-to-end.

## 2. Audit of current state (2026-04-27)

| Surface         | File                                                                                           | State                                                                                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home page       | [`src/app/page.tsx`](../../src/app/page.tsx)                                                   | Single-file. Inline header, hero, 6-card grid, one-line footer. No navigation to feature/pricing/about pages — none exist.                                                          |
| Auth layout     | [`src/app/(auth)/layout.tsx`](<../../src/app/(auth)/layout.tsx>)                               | 7 lines. No header, no logo link, no back-to-home link.                                                                                                                             |
| Login page      | [`src/app/(auth)/login/page.tsx`](<../../src/app/(auth)/login/page.tsx>)                       | Building2 icon + "RWA Connect" text rendered as static markup, not a `<Link>`.                                                                                                      |
| Register page   | [`src/app/(auth)/register-society/page.tsx`](<../../src/app/(auth)/register-society/page.tsx>) | Has a polished left-side `BrandingPanel` with emerald→teal→cyan gradient — strong design seed for the rest of the marketing site. Logo is a `<div>`, not a `<Link>`.                |
| Privacy page    | [`src/app/privacy/page.tsx`](../../src/app/privacy/page.tsx)                                   | Lives at top-level `/privacy` (not under a marketing layout). "← Back to Login" is its only nav link — wrong destination for a public visitor who arrived via the home page footer. |
| Terms page      | [`src/app/terms/page.tsx`](../../src/app/terms/page.tsx)                                       | Same shape as privacy — top-level, no shared header.                                                                                                                                |
| Marketing pages | —                                                                                              | None. No `/features`, `/pricing`, `/about`, `/contact`, `/security`, `/for-residents`.                                                                                              |
| Public APIs     | —                                                                                              | No `/api/v1/public/*`. The register-society wizard fetches plans via `/api/v1/auth/plans` (auth namespace, but anonymous-by-design — confirmed by reading the wizard).              |
| SEO / sitemap   | [`src/app/layout.tsx`](../../src/app/layout.tsx)                                               | Has `metadata` with title + description but no Open Graph image, no canonical, no `sitemap.ts`, no `robots.ts`.                                                                     |
| Brand tokens    | [`src/app/globals.css`](../../src/app/globals.css)                                             | Teal primary `oklch(0.55 0.15 175)`. Geist Sans + Mono. Comment in CSS calls it "Eden Estate brand". Dark mode already wired via `next-themes`.                                     |
| Hero imagery    | `public/`                                                                                      | Only Next.js scaffold SVGs (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`). No product screenshots, no logo asset.                                                |

**Three latent invariants worth naming up-front:**

- **Plans data is dynamic.** Six plans live in `PlatformPlan` and are seeded by `supabase/seed/plans.ts`. Hardcoding prices on the marketing site will rot the moment SA edits a plan. The public pricing page MUST read from a public endpoint.
- **The teal brand is inconsistent.** Globals.css uses an oklch teal as `--primary`. The register-page BrandingPanel uses Tailwind's `emerald-600 → teal-600 → cyan-700` gradient (different colour family). Pick one canonical brand palette and stick to it everywhere.
- **`(auth)` route group is for forms only.** Putting marketing pages in `(auth)` would be wrong — they are not authenticated flows. Marketing belongs in its own `(marketing)` route group with its own shared layout (header + footer).

## 3. Design principles (the rule book this plan obeys)

1. **Public site = real product surface.** Treat home + marketing pages with the same care as the admin app — typed Zod inputs on forms, Suspense boundaries, real loading/error states, accessibility, SEO, OG images.
2. **One brand, one palette.** Drop the inline emerald-teal-cyan gradient and use design-token-driven gradients (`from-primary to-chart-2` etc.) so light/dark mode and future re-skins are trivial.
3. **One layout per concern.** `(marketing)` for unauth pages, `(auth)` for forms, `admin/`, `r/`, `counsellor/`, `sa/` for authed surfaces. Cross-linking happens via `<Link>`, never via shared layouts.
4. **Logo is always a link to `/`.** Anywhere `RWA Connect` appears in a header — auth, marketing, error pages — the logo wraps in a `<Link href="/">`. This single rule fixes the user's reported bug and prevents its recurrence.
5. **Server components by default.** Marketing pages render on the server. Use `"use client"` only where interactivity demands it (mobile nav drawer, pricing-cycle toggle, FAQ accordion).
6. **Performance over decoration.** Lazy-load below-the-fold imagery. Above-the-fold uses `next/image` with `priority`. Lighthouse Performance ≥ 90 is a hard target.
7. **Public endpoints are anonymous, rate-limited, and audited.** Anything served to unauth visitors goes under `/api/v1/public/*` with a documented rate limit and a header comment marking it anonymous-by-design (per `subscription_plans_hardening.md` § 2b).
8. **Compliance is shipped, not promised.** DPDP Act compliance lives in `/privacy`. Razorpay onboarding requires terms + refund policy at known URLs. `robots.txt` + `sitemap.xml` go live with the redesign, not later.

## 4. Shipped feature inventory — what we can honestly claim

Every marketing claim in this plan is grounded in a feature that is **already in the codebase**. This table is the source-of-truth for hero copy, feature pages, comparison matrices, and FAQ. If a row is not here, the marketing site cannot mention it.

### 4.A Resident-facing capabilities

| Capability                                       | Source                                                                        | Marketing claim                                                                                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| QR-based resident onboarding                     | MVP / register-society-ux                                                     | "Residents join in 60 seconds by scanning the society QR code."                                                                      |
| Digital RWAID cards                              | MVP / household registry                                                      | "Every resident gets a digital RWAID — usable for gate pass, gym, amenity check-in."                                                 |
| Household registry — family members with sub-IDs | [resident-household-registry.md](../completed/resident-household-registry.md) | "Add family, pets, vehicles, and domestic helpers under one household. Each gets its own ID for gate pass and amenities."            |
| Vehicle registry with owner attribution          | resident-household-registry                                                   | "Track every vehicle in the society. Search by plate number."                                                                        |
| Pet & domestic helper registry                   | resident-household-registry                                                   | "Stop chasing PG-13 forms — pets, helpers, and visitors are tracked digitally."                                                      |
| Resident directory with vehicle search           | resident-household-registry-ui                                                | "Find any neighbour by name, unit, or vehicle."                                                                                      |
| Resident profile + photo                         | MVP                                                                           | "Residents own their profile, photo, and contact details."                                                                           |
| Fee dashboard + payment history                  | MVP                                                                           | "See every fee, every payment, every receipt — across years."                                                                        |
| UPI QR payments (₹0 fee)                         | [online_payment_upi.md](../completed/online_payment_upi.md)                   | "Pay society dues by scanning your society's UPI QR. Zero gateway fees, direct bank-to-bank."                                        |
| Resident support tickets (9 types)               | [resident-support-tickets.md](../completed/resident-support-tickets.md)       | "Raise maintenance, security, noise, parking, billing, or amenity issues — and watch your neighbours' issues too, for transparency." |
| Society-wide ticket visibility                   | resident-support-tickets                                                      | "See if a neighbour already reported the leak before you raise a duplicate."                                                         |
| Petition signing — draw or upload signature      | [petition-signed-doc.md](../completed/petition-signed-doc.md)                 | "Sign society petitions digitally — draw on your phone or upload a scanned signature."                                               |
| Vote to escalate a ticket to a Counsellor        | [counsellor-role.md](../completed/counsellor-role.md)                         | "Stuck with the committee? Rally 10 neighbours and a platform-appointed ombudsperson steps in."                                      |
| Community event RSVP                             | [community-engagement.md](../completed/community-engagement.md)               | "Tap 'I'm In' for Holi, AGM, yoga workshops, or any community event."                                                                |

### 4.B Admin-facing capabilities

| Capability                                                         | Source                                                                                      | Marketing claim                                                                                                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Society onboarding wizard                                          | register-society-ux                                                                         | "Set up your society in three steps: info, plan, admin account."                                                                                                           |
| Resident approval workflow                                         | improve-residents-page-for-admins                                                           | "Vet every new resident with documents, ID proof, ownership proof, before they enter the directory."                                                                       |
| Multi-admin with permissions                                       | subscription_plans                                                                          | "Bring your secretary, treasurer, and IT volunteer in as admins — separate roles, audit trail per action."                                                                 |
| Admin residents page (search, filter, bulk)                        | improve-residents-page-for-admins                                                           | "Filter, search, bulk-approve, bulk-export — your residents page actually scales past 200 units."                                                                          |
| Vehicle plate lookup                                               | resident-household-registry                                                                 | "Gate logs flagged a plate? Type it in. Find the owning unit in one second."                                                                                               |
| Fee sessions with pro-rata                                         | MVP                                                                                         | "Mid-year resident? Pro-rata calculated automatically. No more manual ₹/month maths."                                                                                      |
| Multiple payment modes                                             | MVP + UPI plans                                                                             | "Cash, bank transfer, UPI claim — record every mode. Online gateway optional (when you want it)."                                                                          |
| UPI claim verification                                             | online_payment_upi                                                                          | "Resident scans your UPI QR, pays, submits UTR. You verify against bank statement and confirm — auto receipt + WhatsApp."                                                  |
| Expense tracking with categories                                   | MVP                                                                                         | "Categorise every expense, attach receipts, run quarterly reports. Show residents where their money went."                                                                 |
| 48-hour correction window on payments                              | sa-subscription-billing                                                                     | "Made a typo on a payment entry? Edit within 48 hours, after that it's locked for audit."                                                                                  |
| Auto-receipts as PDF                                               | MVP                                                                                         | "Every confirmed payment generates a PDF receipt — emailed and downloadable."                                                                                              |
| Announcements + WhatsApp broadcasts                                | MVP                                                                                         | "Push an announcement once. WhatsApp, email, and in-app — all three fire."                                                                                                 |
| Community events with 4 fee models                                 | community-engagement                                                                        | "Free RSVPs (AGM), fixed-price events (workshops), poll-then-price (Holi), open contributions (Mata ki Chowki) — one module covers them all."                              |
| Petition admin: PDF upload, signature aggregation, compiled report | [petitions.md](../completed/petitions.md) + petition-signed-doc                             | "Draft a petition, upload the formal letter, collect signatures digitally, download the signed compiled PDF — submit to the municipality without printing a single sheet." |
| Resident-support ticket triage with priorities                     | resident-support-tickets                                                                    | "Triage tickets by priority. Convert any complaint into a formal petition with one click."                                                                                 |
| Designations (President, Treasurer, etc.)                          | MVP                                                                                         | "Surface your committee on the residents app — names, photos, designations."                                                                                               |
| Governing body roster                                              | MVP                                                                                         | "Office-bearer terms, photos, contact — all in one place."                                                                                                                 |
| Audit log of every action                                          | [security-and-reliability-hardening.md](../completed/security-and-reliability-hardening.md) | "Every approval, every payment edit, every resident change — logged with who, when, what."                                                                                 |
| Dashboard impersonation as Super Admin                             | [superadmin_bugs.md](../completed/superadmin_bugs.md)                                       | (Internal — not a marketing claim)                                                                                                                                         |

### 4.C Platform & operations

| Capability                                          | Source                                                                    | Marketing claim                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 6 plans + Flex + Trial                              | [subscription_plans.md](../completed/subscription_plans.md)               | "From ₹499/month for 150 units to per-unit Flex. 14-day free trial. No credit card."                                                  |
| Pro-rata plan switching                             | subscription_plans                                                        | "Upgrade or downgrade mid-cycle. The system calculates the credit/charge for you."                                                    |
| Subscription billing with UPI QR                    | [sa-subscription-billing.md](../completed/sa-subscription-billing.md)     | "Pay your platform subscription via UPI — no auto-debit lock-in until you opt for Razorpay."                                          |
| Counsellor program — platform ombudsperson          | counsellor-role                                                           | "When residents and admins deadlock, a platform-appointed Counsellor mediates. Available across all plans."                           |
| PWA — installable, offline read                     | [pwa-phase1-installability.md](../completed/pwa-phase1-installability.md) | "Add to home screen on Android and iOS. Open instantly. Read your data even on a flaky network."                                      |
| Role-based access (SA, Admin, Counsellor, Resident) | MVP + counsellor-role                                                     | "Four roles, scoped exactly. Residents never see admin pages. Admins never see other societies. Counsellors never see your finances." |
| DPDP compliance + privacy policy                    | security-and-reliability-hardening                                        | "Compliant with the Digital Personal Data Protection Act, 2023."                                                                      |
| Postgres RLS for tenant isolation                   | security-and-reliability-hardening                                        | "Database-level isolation between societies — a query for Eden Estate cannot accidentally return Green Valley's rows."                |
| Audit log retention                                 | security-and-reliability-hardening                                        | "Every privileged action logged with actor, target, before/after."                                                                    |
| Rate limiting on auth + login                       | security-and-reliability-hardening                                        | "Brute-force resistance built in."                                                                                                    |
| Sentry error monitoring (when configured)           | pre-launch-checklist                                                      | "Production errors surface in seconds — we know about issues before you report them."                                                 |

### 4.D Things we cannot claim yet (do not put on the marketing site)

- Razorpay card / netbanking — see [`online_payment_razorpay.md`](./online_payment_razorpay.md) (not started).
- UPI deep-link / intent — see [`online_pay_deeplink.md`](./online_pay_deeplink.md) (not started).
- Push notifications — PWA Phase 3 not shipped.
- Offline writes — PWA Level 3, deferred.
- AI insights / chatbot — Enterprise AI plan exists but the AI features are not built.
- Elections module — placeholder in plan matrix; not implemented.
- Mobile native apps (Play / App Store) — only PWA today.
- Full WhatsApp wiring — templates registered, only some triggers automated. Pitch as "WhatsApp on supported events" rather than "every event".

Marketing copy that promises any of the above is dishonest until those plans ship. Re-audit this section before any landing-page copy edit.

---

## 5. Information architecture

```
/                       Home — value prop, social proof, features, plans, FAQ, CTA
├── /features           Deep feature breakdown by module (residents, fees, expenses, comms, governance)
├── /pricing            Public pricing — all plans, monthly/annual toggle, FAQ
├── /for-residents      Value prop for residents (they don't sign up — they're invited)
├── /for-admins         Value prop for RWA admins (the buyer persona)
├── /about              Story, team, mission, contact us
├── /contact            Lead form + WhatsApp + email
├── /security           Trust page — DPDP, RLS, audit logs, encryption, hosting
├── /privacy            (existing — re-parented under (marketing) layout)
├── /terms              (existing — re-parented under (marketing) layout)
└── /refund-policy      NEW — required by Razorpay KYC and customer trust
```

**Sitemap rules:**

- Every page in this tree is in `app/sitemap.ts`.
- Every page has a unique `<title>` and `<meta description>`.
- Every page has an OG image — the home page gets a custom one; others share a brand fallback.
- Footer surfaces every page above (grouped: Product, Resources, Legal, Company).
- Header surfaces only the top-level marketing pages: Features, Pricing, For Residents, For Admins. About / Contact go in the footer or as a "More" dropdown.

## 6. Phased implementation

Five phases. Phases are independently shippable; **Phase 1 is load-bearing for everything else** (introduces the marketing layout). Order matters.

| Phase | Goal                                                                        | Effort | Ship-on                                                          |
| ----- | --------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------- |
| 1     | Marketing layout + auth nav fix + home redesign skeleton                    | 2 days | Solves the reported bug, gives every later phase a place to live |
| 2     | Pricing page + Features page + public plans API                             | 2 days | Public revenue surface                                           |
| 3     | Persona pages — For Residents + For Admins                                  | 1 day  | Sales tooling                                                    |
| 4     | About + Contact + Security + Refund Policy                                  | 2 days | Compliance + trust                                               |
| 5     | Home polish — testimonials, screenshots, motion, OG images, SEO, perf, a11y | 2 days | Final paint                                                      |

Total: ~9 working days for one engineer. Each phase ends with `/quality-gate` passing.

---

## Phase 1 — Marketing layout, auth nav fix, home redesign skeleton

**Goal:** stand up a real marketing route group, fix the navigation bug, and redesign the home page with all section slots in place (with placeholder content where Phase 5 will fill in).

### 1.1 New `(marketing)` route group

Create [`src/app/(marketing)/layout.tsx`](<../../src/app/(marketing)/layout.tsx>) as the shared shell for all unauth pages.

**Components rendered by the layout:**

- `<MarketingHeader />` — sticky, glass effect, logo links to `/`, nav links (Features, Pricing, For Residents, For Admins), right-aligned `Sign In` ghost button + `Get Started` primary button. On mobile collapses to a sheet drawer.
- `{children}` — page body
- `<MarketingFooter />` — 4-column grid (Product / Resources / Legal / Company) + bottom strip with copyright + theme toggle + social links.

**Files created:**

| File                                                    | Purpose                                                                                                  |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/app/(marketing)/layout.tsx`                        | Shared layout (header + footer + main wrapper)                                                           |
| `src/components/features/marketing/MarketingHeader.tsx` | Sticky header with desktop nav + mobile drawer                                                           |
| `src/components/features/marketing/MarketingFooter.tsx` | 4-column footer                                                                                          |
| `src/components/features/marketing/MobileNavDrawer.tsx` | shadcn `Sheet`-based mobile menu                                                                         |
| `src/components/features/marketing/Logo.tsx`            | Reusable wordmark — wraps in `<Link>` by default; accepts `as?: "div"` for cases where it shouldn't link |
| `src/components/features/marketing/ThemeToggle.tsx`     | Sun/moon toggle bound to `next-themes`                                                                   |

**Files moved:**

| From                       | To                                     |
| -------------------------- | -------------------------------------- |
| `src/app/page.tsx`         | `src/app/(marketing)/page.tsx`         |
| `src/app/privacy/page.tsx` | `src/app/(marketing)/privacy/page.tsx` |
| `src/app/terms/page.tsx`   | `src/app/(marketing)/terms/page.tsx`   |

The privacy page's "← Back to Login" link is replaced by the marketing header (which links to `/`). Same for terms.

### 1.2 Auth navigation fix

Update [`src/app/(auth)/layout.tsx`](<../../src/app/(auth)/layout.tsx>) from a bare wrapper to a proper auth shell:

```tsx
// src/app/(auth)/layout.tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/features/marketing/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 flex min-h-screen flex-col">
      <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Logo />
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
```

This single change fixes the reported bug across **all 9 pages under `(auth)`** (login, register-society, super-admin-login, forgot-password, reset-password, check-email, verify-email, select-society, plus any future ones).

**Additionally:**

- Replace the static Building2 + "RWA Connect" markup in [`login/page.tsx`](<../../src/app/(auth)/login/page.tsx>) with `<Logo size="lg" />` so the in-form logo also links home.
- Update the `BrandingPanel` in [`register-society/page.tsx`](<../../src/app/(auth)/register-society/page.tsx>) — the logo block at the top of the gradient column wraps in a `<Link href="/">` (unobtrusive, keeps the gradient design).
- Replace the privacy page's "← Back to Login" with no inline back-link (the marketing header now does that) — or change it to "← Back to home" if a duplicate back-link is desired.

### 1.3 Home page redesign — section skeleton

The new home page is a server component composed of section components. Each section is its own file so it can be unit-tested and re-ordered without diff-noise. Phase 5 fills the polish; Phase 1 lands every section with sensible placeholder content.

```
src/app/(marketing)/page.tsx
└── renders, in order:
    ├── <Hero />                           — value prop + CTA + dashboard mockup
    ├── <SocialProofBar />                 — "Trusted by NN societies, NN,NNN homes"
    ├── <ProblemSolution />                — pain → fix narrative
    ├── <FeatureShowcase />                — 6 hero modules (see §1.4.1) with screenshots
    ├── <HowItWorks />                     — 3-step onboarding visual (§1.4.2)
    ├── <PricingPreview />                 — 3 plans + "See all plans" link
    ├── <Differentiators />                — what makes RWA Connect different (§1.4.3)
    ├── <Testimonials />                   — 3 society admin quotes (Phase 5)
    ├── <FAQ />                            — 6 common questions (§1.4.4)
    └── <CtaBand />                        — "Ready to digitize?" + Get Started
```

#### 1.4.1 FeatureShowcase — the 6 hero modules on the home page

Six cards, two rows of three, each card linking to its anchor on `/features`. Picks the modules that are most differentiating to lead with on the home page (full module list lives on `/features`).

| #   | Title                             | One-line claim (sourced from §4)                                                                                      | Icon            | Screenshot                                  |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------- |
| 1   | Household Registry                | Family, vehicles, pets, helpers — under one household with sub-IDs for gate pass and amenities.                       | `Users`         | Resident profile with family + vehicle tabs |
| 2   | Zero-fee UPI Payments             | Residents scan your society's UPI QR, pay, submit UTR. You verify in one click. ₹0 gateway.                           | `QrCode`        | Admin claim verification queue              |
| 3   | Fee + Expense Ledger              | Pro-rata maths handled. Categorised expenses with receipts. Residents see exactly where the money went.               | `Receipt`       | Resident expense view                       |
| 4   | Resident Support Tickets          | 9 categories. Society-wide visibility. One-click convert to formal petition.                                          | `LifeBuoy`      | Ticket detail with status lifecycle         |
| 5   | Petitions with Digital Signatures | Upload the formal letter. Residents sign on screen. Download a compiled PDF report.                                   | `FileSignature` | Petition signing screen                     |
| 6   | Counsellor Program                | When admin and residents deadlock, a platform-appointed ombudsperson steps in. 10 resident votes triggers escalation. | `ShieldCheck`   | Counsellor escalation card                  |

#### 1.4.2 HowItWorks — 3-step onboarding visual

Real onboarding sequence from `register-society-ux.md`:

1. **Register your society** — name, type, plan, admin account. Three steps. ~2 minutes. _(refs: `register-society-ux.md`)_
2. **Invite residents** — share the society QR code on WhatsApp. Residents scan, fill profile, submit. _(refs: §4.A · QR onboarding)_
3. **You approve, they belong** — vet documents, approve, RWAID issued, household registry unlocked. _(refs: §4.B · approval workflow)_

#### 1.4.3 Differentiators — "Why RWA Connect"

Four blocks. Lead with claims competitors don't ship today:

1. **Zero-fee payments by default** — most competitors push you straight to a gateway with 2% MDR. UPI QR claim is free. Razorpay is opt-in. _(refs: `online_payment_upi.md`)_
2. **Petitions built into the platform** — not a forum, not a poll — formal letters with digital signatures and a submission-ready PDF. _(refs: `petition-signed-doc.md`)_
3. **Independent escalation channel** — when residents and admins deadlock, a Counsellor mediates. We're the only platform that ships this. _(refs: `counsellor-role.md`)_
4. **Database-level isolation, not "trust us"** — Postgres RLS ensures one society's query cannot leak another's data, audit log on every privileged action. _(refs: `security-and-reliability-hardening.md`)_

#### 1.4.4 FAQ — six honest questions

| Question                                 | Answer source                                                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| What does it cost?                       | "From ₹499/month for 150 units. 14-day free trial. No credit card." (link to `/pricing`)                             |
| Can residents pay online?                | "Yes — UPI QR is included on every plan, with zero gateway fees. Card / netbanking via Razorpay is on the roadmap."  |
| Is my society's data safe?               | "Database-level isolation per society, audit logs, DPDP-compliant. Details on `/security`."                          |
| Do residents need to install an app?     | "No — RWA Connect is a Progressive Web App. Add it to home screen on Android or iOS, or just open the link."         |
| What if my admin and committee disagree? | "Either side can escalate to a platform-appointed Counsellor. Residents need 10 votes; admin can escalate directly." |
| Do you offer support?                    | "Yes — email, WhatsApp, or in-app ticket. SLAs vary by plan." (link to `/contact`)                                   |

**Files created in Phase 1 (one component per file):**

| File                                                             | Server / Client                              |
| ---------------------------------------------------------------- | -------------------------------------------- |
| `src/components/features/marketing/sections/Hero.tsx`            | Server                                       |
| `src/components/features/marketing/sections/SocialProofBar.tsx`  | Server                                       |
| `src/components/features/marketing/sections/ProblemSolution.tsx` | Server                                       |
| `src/components/features/marketing/sections/FeatureShowcase.tsx` | Server                                       |
| `src/components/features/marketing/sections/HowItWorks.tsx`      | Server                                       |
| `src/components/features/marketing/sections/PricingPreview.tsx`  | Server (fetches from `/api/v1/public/plans`) |
| `src/components/features/marketing/sections/Differentiators.tsx` | Server                                       |
| `src/components/features/marketing/sections/Testimonials.tsx`    | Server                                       |
| `src/components/features/marketing/sections/FAQ.tsx`             | Client (accordion needs interactivity)       |
| `src/components/features/marketing/sections/CtaBand.tsx`         | Server                                       |

### 1.4 Hero spec (Phase 1 — gets visual polish in Phase 5)

Copy is grounded in §4.A–C. Every claim below maps to a row in that table.

```
┌────────────────────────────────────────────────────────────────────┐
│  HEADER (sticky)                                                    │
│  Logo  Features  Pricing  For Residents  For Admins   [Sign In] [Get Started] │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Eyebrow:  Built for Indian housing societies                       │
│                                                                     │
│  H1:       The operating system for your                            │
│            housing society.                                         │
│                                                                     │
│  Sub:      Onboard residents in 60 seconds. Collect fees over UPI   │
│            with zero gateway charges. Run elections, petitions,     │
│            community events, and resident support — from one app    │
│            your secretary, treasurer, and residents will actually   │
│            use.                                                     │
│                                                                     │
│  CTAs:     [Get started — 14-day trial]  [See pricing →]            │
│                                                                     │
│  Trust:    14-day free trial · No credit card · DPDP-compliant ·    │
│            ₹0 UPI fees                                              │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │  [Dashboard screenshot — admin overview, ~16:10]         │       │
│  │  Lazy-loaded; first paint shows blurred placeholder      │       │
│  └──────────────────────────────────────────────────────────┘       │
└────────────────────────────────────────────────────────────────────┘
```

**Differentiator strip** (4 short pills under hero CTAs — picks the strongest claims that competitors don't lead with):

1. **Zero-fee UPI** — direct bank-to-bank, NPCI rails (§4.A · `online_payment_upi.md`).
2. **Petitions with digital signatures** — draw or upload, compiled PDF download (§4.B · `petitions.md`).
3. **Counsellor program** — platform ombudsperson when admin/resident deadlock (§4.C · `counsellor-role.md`).
4. **Household registry with sub-IDs** — family, vehicles, pets, helpers under one household (§4.A · `resident-household-registry.md`).

**Notes:**

- Background: subtle radial gradient using `--primary` at 8% opacity (no inline emerald hex).
- CTAs: primary uses brand teal; secondary is outline.
- Dashboard mockup: in Phase 1 ship as a placeholder `<div>` with proportional height; Phase 5 replaces with `next/image` + actual screenshot.
- `priority` on hero image when it lands in Phase 5.

### 1.5 Tests for Phase 1

| File                                                  | What it tests                                                                                 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `tests/components/marketing/MarketingHeader.test.tsx` | Logo links to `/`; nav links exist; mobile drawer opens on small screens                      |
| `tests/components/marketing/MarketingFooter.test.tsx` | All 4 columns render; legal page links resolve; theme toggle present                          |
| `tests/components/marketing/Logo.test.tsx`            | Default renders `<a>` to `/`; `as="div"` skips link; aria-label present                       |
| `tests/app/(auth)/layout.test.tsx`                    | "Back to home" link points to `/`; logo points to `/`                                         |
| `tests/app/(marketing)/page.test.tsx`                 | All 9 section components are rendered in order; no client-only code in server-rendered output |

### 1.6 Quality gate (Phase 1)

- `npm run lint` — zero errors
- `npm run test:coverage` — 95% per-file on every new component
- `npx tsc --noEmit` — clean
- `npm run build` — succeeds; bundle delta < 30 KB on the home page
- Manual: clicking the logo or "Back to home" from `/login`, `/register-society`, `/privacy`, `/terms` all land on `/`.

---

## Phase 2 — Pricing page + Features page + public plans API

**Goal:** ship a public pricing page powered by real data, and a public features page that goes deeper than the home page's section.

### 2.1 Public plans API

Currently the wizard fetches `/api/v1/auth/plans` — that endpoint is already anonymous-friendly but its name is confusing. Add `/api/v1/public/plans` as the canonical public endpoint and proxy the existing logic.

**File:** `src/app/api/v1/public/plans/route.ts`

```ts
// Anonymous by design — serves the public pricing page.
// Rate limit: 60 req / IP / minute (per subscription_plans_hardening.md §2b).
//
// Returns: { plans: PublicPlan[] } where PublicPlan exposes:
//   id, slug, name, description, planType, residentLimit, pricePerUnit,
//   featuresJson, badgeText, displayOrder, isPopular,
//   billingOptions: { id, billingCycle, price }[]
//
// Excludes: any internal flags (isActive, archivedAt, internalNotes, etc.)
```

- Returns only `isActive = true` plans.
- Sorted by `displayOrder asc`.
- Cached at the edge for 5 minutes (`Cache-Control: s-maxage=300, stale-while-revalidate=86400`).
- Rate limit via the existing `checkRateLimit` helper, keyed by IP.

**Tests:** `tests/api/public-plans.test.ts` — anonymous request returns 200; rate-limit returns 429; archived plans excluded; sort order preserved.

### 2.2 Pricing page — `/pricing`

**File:** `src/app/(marketing)/pricing/page.tsx`

**Sections:**

1. **Header / hero** — "Honest pricing. No hidden fees."
2. **Cycle toggle** — Monthly / Annual / 2-Year / 3-Year. Annual is selected by default. Cycle toggle is a client component (`<PricingCycleToggle />`).
3. **Plan grid** — 6 plans (5 flat-fee + 1 Flex). Each card shows: name, badge (Most Popular / Best Value), price for selected cycle, savings vs monthly, resident limit, top 5 features, full features link, "Start trial" CTA. Most-popular card is visually elevated.
4. **Feature comparison matrix** — collapsible "Compare all features" table. Renders as a server component for SEO; rows highlight checkmark per plan.
5. **Add-ons** — placeholder for future add-ons (covered in `subscription_plans_hardening.md` Phase 4).
6. **FAQ** — pricing-specific FAQ (taxes? cancel anytime? annual refunds?).
7. **CTA band** — re-uses `<CtaBand />` from home.

**Files created:**

| File                                                                    | Type                                            |
| ----------------------------------------------------------------------- | ----------------------------------------------- |
| `src/app/(marketing)/pricing/page.tsx`                                  | Server component — fetches plans server-side    |
| `src/components/features/marketing/pricing/PricingCycleToggle.tsx`      | Client — billing cycle switcher                 |
| `src/components/features/marketing/pricing/PricingCard.tsx`             | Server                                          |
| `src/components/features/marketing/pricing/FeatureComparisonMatrix.tsx` | Server                                          |
| `src/components/features/marketing/pricing/PricingFAQ.tsx`              | Client (accordion)                              |
| `src/services/public-plans.ts`                                          | Server-side fetcher (used by Server Components) |
| `src/types/public-plan.ts`                                              | TypeScript types for the public plan shape      |

**SEO:** title "Pricing — RWA Connect", description "Plans starting at ₹499/month. 14-day free trial.", canonical, OG image.

### 2.3 Features page — `/features`

**File:** `src/app/(marketing)/features/page.tsx`

The features page is the long-form companion to the home FeatureShowcase. Every bullet is sourced from §4 (the shipped feature inventory). Modules without shipped capabilities (Razorpay gateway, push notifications, Elections module) are deliberately absent.

**Sections (one per product module):**

1. **Resident management & household registry** _(refs: §4.A · `resident-household-registry.md`)_
   - QR-based onboarding (60-second resident join)
   - Digital RWAID cards, usable for gate pass, gym, amenity check-in
   - Family members under one household with sub-IDs (`-M1`, `-M2`)
   - Vehicle registry with owner attribution + plate-number search for admins
   - Pet & domestic helper registry
   - Resident profile, photo, contact details — owned by the resident

2. **Fee collection** _(refs: §4.A–B · `online_payment_upi.md`, MVP)_
   - Pro-rata calculations for mid-cycle joiners
   - Multiple payment modes: cash, bank transfer, UPI, manual
   - **Zero-fee UPI QR flow**: resident scans → pays via GPay/PhonePe/Paytm → submits UTR → admin verifies → auto receipt + WhatsApp
   - Resident fee dashboard + payment history across years
   - PDF receipts auto-generated and emailed
   - 48-hour correction window on payment entries (then locked for audit)

3. **Expense tracking & financial transparency** _(refs: §4.B · MVP)_
   - Categorise expenses, attach receipts, run quarterly reports
   - Resident-visible expense ledger — show where the money went
   - Correction window on entries (48 hours)

4. **Resident support tickets** _(refs: §4.A–B · `resident-support-tickets.md`)_
   - 9 ticket types: maintenance, security, noise, parking, cleanliness, billing, amenity, neighbour dispute, suggestion
   - Society-wide ticket visibility — see if a neighbour already raised the same issue
   - Status lifecycle: OPEN → IN_PROGRESS → AWAITING_RESIDENT → RESOLVED → reopen window
   - Admin triage with priority assignment
   - One-click conversion of any ticket into a formal petition

5. **Petitions & complaints** _(refs: §4.A–B · `petitions.md`, `petition-signed-doc.md`)_
   - Three types: COMPLAINT, PETITION, NOTICE
   - Admin uploads the formal letter (PDF)
   - Residents sign digitally — **draw on screen** or **upload signature image**
   - Live signature counter, configurable target
   - Compiled PDF report with all signatures inline — submission-ready
   - Mark as Submitted; signatories notified via WhatsApp

6. **Community events** _(refs: §4.A–B · `community-engagement.md`)_
   - Four fee models in one module:
     - **FREE** — RSVP only (AGM, cleanup drive)
     - **FIXED** — set price upfront (workshop, swimming pool pass)
     - **FLEXIBLE** — poll first, set price after based on interest (Holi, Diwali party)
     - **CONTRIBUTION** — open voluntary donation (Mata ki Chowki, charity)
   - Per-person or per-household charge unit
   - Event expense ledger — show collected vs spent

7. **Counsellor program** _(refs: §4.C · `counsellor-role.md`)_
   - Platform-appointed ombudsperson with portfolio of societies
   - Two escalation paths: admin-initiated, or **10 resident votes** (configurable threshold)
   - Counsellor sees only escalated tickets — never your finances
   - Audit log of every counsellor action
   - Available across all plans

8. **Governance** _(refs: §4.B · MVP)_
   - Governing body roster (President, Treasurer, Secretary, Members)
   - Designations with terms, photos, contact
   - Office-bearer history

9. **Communication** _(refs: §4.B · MVP)_
   - Announcements (in-app + WhatsApp + email — single push, three channels)
   - WhatsApp templates registered for key events (registration, approval, payment, fee reminder, broadcast, event published, petition published)

10. **Platform & trust** _(refs: §4.C · `security-and-reliability-hardening.md`, PWA Phase 1)_
    - Role-based access: SA, Admin, Counsellor, Resident — scoped exactly
    - Postgres RLS for tenant isolation between societies
    - Audit log of every privileged action
    - DPDP Act 2023 compliance
    - Rate-limited auth, brute-force resistance
    - PWA — installable on Android & iOS, offline read

Each section: heading, two-column layout (text + screenshot), 4–6 bullet feature list. Alternating left/right per section. Anchor link per module so the home FeatureShowcase can deep-link.

**Files created:**

| File                                                                  | Type                          |
| --------------------------------------------------------------------- | ----------------------------- |
| `src/app/(marketing)/features/page.tsx`                               | Server                        |
| `src/components/features/marketing/features/FeatureModuleSection.tsx` | Server — re-usable per module |

### 2.4 Tests for Phase 2

- `tests/api/public-plans.test.ts` — endpoint contract
- `tests/app/(marketing)/pricing/page.test.tsx` — renders all plans, toggle changes prices, FAQ expands
- `tests/components/marketing/pricing/PricingCard.test.tsx` — popular badge, savings calc, CTA
- `tests/components/marketing/pricing/PricingCycleToggle.test.tsx` — cycle switch fires callback
- `tests/components/marketing/pricing/FeatureComparisonMatrix.test.tsx` — matrix rows for each feature
- `tests/services/public-plans.test.ts` — server-side fetcher

### 2.5 Quality gate (Phase 2)

Same as Phase 1, plus: pricing page Lighthouse Performance ≥ 90 on mobile.

---

## Phase 3 — Persona pages

**Goal:** dedicated landing pages for the two end-user personas (residents and admins). These exist to be linked from outbound messaging — "share `rwaconnect.in/for-admins` with your secretary."

### 3.1 `/for-admins`

**File:** `src/app/(marketing)/for-admins/page.tsx`

**Audience:** society secretaries, treasurers, presidents.

**Sections:**

1. Hero — "Run your society without spreadsheets, WhatsApp groups, and Excel hell."
2. The 3 jobs RWA admins hate — fee chasing, expense reconciliation, AGM logistics.
3. How RWA Connect kills each — feature cluster per pain point.
4. Trust strip — "Compliant with DPDP Act. Audit logs. Role-based access."
5. CTA — "Start a 14-day trial" + "See pricing".

### 3.2 `/for-residents`

**File:** `src/app/(marketing)/for-residents/page.tsx`

**Audience:** residents who land here when an admin shares the URL ("look, this is what we're switching to").

**Sections:**

1. Hero — "Pay your society dues in 30 seconds. Read announcements. Vote. From your phone."
2. What residents get — fee dashboard, payment history, complaints, elections, household registry.
3. "I'm not signing up — my admin will invite me." callout — explains the invite flow.
4. CTA — "If you're an admin, [Get Started]. If you're a resident, ask your secretary about RWA Connect."

### 3.3 Tests for Phase 3

- `tests/app/(marketing)/for-admins/page.test.tsx` — sections render, CTAs link correctly
- `tests/app/(marketing)/for-residents/page.test.tsx` — same, plus the "I'm a resident" callout

### 3.4 Quality gate (Phase 3)

Standard.

---

## Phase 4 — About, Contact, Security, Refund Policy

**Goal:** the four pages that close the trust loop for B2B SaaS — story, lead capture, security posture, and refund/cancellation policy.

### 4.1 `/about`

**File:** `src/app/(marketing)/about/page.tsx`

**Sections:**

1. Mission — one paragraph.
2. Origin story — why this exists (Eden Estate's own pain).
3. Team — placeholder cards (founder + key engineers); team page can grow over time.
4. Values — privacy, transparency, simplicity, fairness.
5. Contact CTA — "Talk to us" link to `/contact`.

### 4.2 `/contact`

**File:** `src/app/(marketing)/contact/page.tsx`

**Sections:**

1. Three contact channels: WhatsApp (deep link `https://wa.me/91...`), email (`hello@rwaconnect.in`), phone.
2. Lead form — name, email, phone, society name, # of units, message. Posts to `/api/v1/public/leads` (Phase 4 also creates this endpoint).
3. Office address (if applicable) — Eden Estate registered address.

**Files created:**

| File                                                     | Purpose                                                                                                                      |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(marketing)/contact/page.tsx`                   | Page                                                                                                                         |
| `src/components/features/marketing/contact/LeadForm.tsx` | Client — RHF + Zod                                                                                                           |
| `src/lib/validations/lead.ts`                            | Zod schema: `leadSchema`                                                                                                     |
| `src/services/leads.ts`                                  | Client wrapper                                                                                                               |
| `src/app/api/v1/public/leads/route.ts`                   | POST handler — rate-limited, anti-spam token, sends email via existing `sendEmail` util, optionally writes to a `Lead` table |
| `supabase/schema.prisma`                                 | Add `model Lead` (fields: id, name, email, phone, societyName, unitCount, message, source, createdAt, status)                |

**Anti-spam:** add a honeypot field + rate limit (5 / IP / hour). Skip captcha for v1.

### 4.3 `/security`

**File:** `src/app/(marketing)/security/page.tsx`

**Sections:**

1. Data protection — DPDP Act compliance summary, data residency (Supabase ap-south-1), encryption (TLS in transit, AES-256 at rest).
2. Access control — role-based access, audit logs, MFA for SA + Counsellor.
3. Database isolation — Postgres RLS, tenant scoping, cross-society leak prevention.
4. Operational — backups (Supabase Pro), monitoring (Sentry), incident response email.
5. Compliance — DPDP, RBI/NPCI rules for payment surfaces, refund policy (link).
6. Responsible disclosure — `security@rwaconnect.in`.

This page is mostly static markdown-style content. Render as a server component with a sidebar table of contents.

### 4.4 `/refund-policy`

**File:** `src/app/(marketing)/refund-policy/page.tsx`

Razorpay's KYC requires a refund-policy URL. The content covers:

- Subscription refunds — pro-rata for plan switches; no refund on partial periods after cancellation.
- Payment disputes — 48-hour correction window for fee-payment entries.
- Force-majeure clause.
- Contact `support@rwaconnect.in` for disputes.

### 4.5 Tests for Phase 4

- `tests/app/(marketing)/about/page.test.tsx` — sections render
- `tests/app/(marketing)/contact/page.test.tsx` — form submits, validates, shows success toast
- `tests/components/marketing/contact/LeadForm.test.tsx` — RHF validation, honeypot blocks bots
- `tests/api/public-leads.test.ts` — rate-limit, validation, email dispatch, DB write
- `tests/lib/validations/lead.test.ts` — zod schema cases
- `tests/app/(marketing)/security/page.test.tsx` — TOC links resolve to in-page anchors
- `tests/app/(marketing)/refund-policy/page.test.tsx` — renders

### 4.6 Quality gate (Phase 4)

Same as Phase 1. Additionally: `prisma migrate` for the new `Lead` table is applied (use `/db-change` skill, direct connection per CLAUDE.md).

---

## Phase 5 — Polish, motion, OG, SEO, performance, accessibility

**Goal:** turn the skeleton from Phases 1–4 into a paint-and-polish marketing site that earns trust in the first 5 seconds.

### 5.1 Visual polish

1. **Hero illustration / dashboard mockup** — produce an SVG or PNG screenshot of the admin dashboard. Lossless export (Figma → SVG preferred). Place at `public/marketing/hero-dashboard.png` and `@2x.png` for retina. Use `next/image` with `priority`.
2. **Feature screenshots** — 6 screenshots, one per module. Ship at `public/marketing/features/<module>.png` + WebP.
3. **Custom OG images** — programmatically generated via `next/og` route handler at `src/app/api/og/route.tsx`. Each marketing page has its own OG title rendered on the same brand template (teal gradient + product name + page subtitle).
4. **Subtle motion** — Framer Motion for one-shot fade-up on section enter (respects `prefers-reduced-motion`). Single shared variant. No carousels in v1.

### 5.2 Testimonials

`<Testimonials />` ships with three real or representative quotes from RWA admins. Each quote: photo (or initials avatar), name, role, society name, city, quote. Stored as static data in [`src/components/features/marketing/data/testimonials.ts`](../../src/components/features/marketing/data/testimonials.ts). Rotate by adding new entries to the file.

### 5.3 SEO

| Surface               | What ships                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/sitemap.ts`  | Lists `/`, `/features`, `/pricing`, `/for-admins`, `/for-residents`, `/about`, `/contact`, `/security`, `/privacy`, `/terms`, `/refund-policy` |
| `src/app/robots.ts`   | Allows all marketing routes; disallows `/admin/*`, `/r/*`, `/sa/*`, `/counsellor/*`, `/api/*`                                                  |
| `metadata` per page   | Unique title (≤60 chars), description (≤155 chars), canonical, OG image, twitter:card                                                          |
| Structured data       | JSON-LD `Organization` + `Product` on home, `FAQPage` on home FAQ + pricing FAQ                                                                |
| `viewport` themeColor | Already wired in root layout (teal `#0d9488`) — confirm matches the new brand token                                                            |

### 5.4 Performance

- Lazy-load all images below the fold.
- Preconnect to Supabase storage in root layout (`<link rel="preconnect">`).
- Defer non-critical fonts.
- Audit bundle: marketing pages should be ≤ 100 KB JS (server components keep client JS minimal).
- Lighthouse targets: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95 on mobile, all marketing pages.

### 5.5 Accessibility

- Every interactive element keyboard-reachable.
- Logo has `aria-label="RWA Connect — home"`.
- Mobile drawer traps focus while open.
- Pricing cycle toggle uses `<RadioGroup>` semantics (not raw buttons).
- Colour contrast meets WCAG AA at 4.5:1 (test light + dark).
- All images have alt text or `alt=""` if decorative.
- Skip link at the top of `<MarketingHeader />` ("Skip to main content").

### 5.6 Tests for Phase 5

- `tests/app/sitemap.test.ts` — sitemap includes every public route
- `tests/app/robots.test.ts` — disallows authed routes
- `tests/app/api/og/route.test.tsx` — OG endpoint returns image
- Updates to existing section tests for any motion-wrapped components (assert reduced-motion fallback)

### 5.7 Quality gate (Phase 5)

Phase 1 quality gate + Lighthouse audit run + visual diff snapshot review.

---

## 7. File summary (created across all phases)

### New routes (15 pages)

```
src/app/(marketing)/
├── layout.tsx
├── page.tsx                        (moved from src/app/page.tsx)
├── features/page.tsx
├── pricing/page.tsx
├── for-admins/page.tsx
├── for-residents/page.tsx
├── about/page.tsx
├── contact/page.tsx
├── security/page.tsx
├── privacy/page.tsx                (moved from src/app/privacy/page.tsx)
├── terms/page.tsx                  (moved from src/app/terms/page.tsx)
└── refund-policy/page.tsx

src/app/sitemap.ts                  NEW
src/app/robots.ts                   NEW
src/app/api/og/route.tsx            NEW
src/app/api/v1/public/plans/route.ts   NEW
src/app/api/v1/public/leads/route.ts   NEW
```

### New components

```
src/components/features/marketing/
├── Logo.tsx
├── MarketingHeader.tsx
├── MarketingFooter.tsx
├── MobileNavDrawer.tsx
├── ThemeToggle.tsx
├── data/testimonials.ts
├── sections/
│   ├── Hero.tsx
│   ├── SocialProofBar.tsx
│   ├── ProblemSolution.tsx
│   ├── FeatureShowcase.tsx
│   ├── HowItWorks.tsx
│   ├── PricingPreview.tsx
│   ├── Differentiators.tsx
│   ├── Testimonials.tsx
│   ├── FAQ.tsx
│   └── CtaBand.tsx
├── pricing/
│   ├── PricingCycleToggle.tsx
│   ├── PricingCard.tsx
│   ├── FeatureComparisonMatrix.tsx
│   └── PricingFAQ.tsx
├── features/
│   └── FeatureModuleSection.tsx
└── contact/
    └── LeadForm.tsx
```

### New libs / services / types

```
src/services/public-plans.ts
src/services/leads.ts
src/lib/validations/lead.ts
src/types/public-plan.ts
src/types/lead.ts
```

### Schema additions

```prisma
model Lead {
  id           String   @id @default(uuid()) @db.Uuid
  name         String   @db.VarChar(120)
  email        String   @db.VarChar(120)
  phone        String?  @db.VarChar(20)
  societyName  String?  @map("society_name") @db.VarChar(200)
  unitCount    Int?     @map("unit_count")
  message      String?  @db.Text
  source       String   @default("contact_page") @db.VarChar(40)
  status       String   @default("NEW") @db.VarChar(20)
  createdAt    DateTime @default(now()) @map("created_at")

  @@index([status, createdAt])
  @@map("leads")
}
```

### Modified files

```
src/app/layout.tsx                   — extend metadata (OG defaults), preconnect
src/app/(auth)/layout.tsx            — add header + back-to-home
src/app/(auth)/login/page.tsx        — replace static logo markup with <Logo />
src/app/(auth)/register-society/page.tsx  — wrap BrandingPanel logo in <Link>
src/app/globals.css                  — confirm/normalise brand gradient tokens
public/marketing/                    — new folder with hero + feature + OG assets
```

---

## 8. Conventions (lifted from CLAUDE.md)

- **95% per-file coverage** enforced by `scripts/test-staged.mjs`.
- **`vi.hoisted()`** mock pattern for any API route test.
- **Server components** unless interactivity is required.
- **No emojis** in source unless explicitly requested.
- **Path alias** `@/*` → `./src/*`.
- **Public endpoints** documented in a header comment as "anonymous by design", rate-limited, and audited (per `subscription_plans_hardening.md` § 2b).
- **All forms** use RHF + Zod.

---

## 9. Risks and mitigations

| Risk                                                                                               | Mitigation                                                                                                            |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Pricing page renders stale plans if `/api/v1/public/plans` cache outpaces a SA edit                | Cache `s-maxage=300, stale-while-revalidate=86400`; SA edit page shows "Cache will refresh within 5 min" hint         |
| Marketing layout duplicates auth-page header → looks like two headers stacked when navigating away | Auth layout uses its own minimal header; visually distinct (no nav links, just Logo + back link)                      |
| Brand-colour drift between teal token and inline emerald gradient in BrandingPanel                 | Phase 1 introduces a `from-primary to-chart-2` Tailwind utility for gradients; BrandingPanel migrates to it           |
| Testimonials are aspirational rather than real → legal exposure                                    | Phase 5 testimonials must be either real (with written consent) or labelled "representative — based on user research" |
| Lead form abuse                                                                                    | Honeypot + rate limit + simple Zod validation. If abuse persists, add hCaptcha in a follow-up                         |
| Breaking SEO when moving `/privacy` and `/terms` under `(marketing)`                               | Route group `(marketing)` does NOT change URL paths — `/privacy` stays at `/privacy`. No redirects needed             |
| `next/og` image generation adds runtime cost                                                       | Cache OG endpoint at the edge (24h); regenerate only on deploy                                                        |

---

## 10. Acceptance criteria

This plan is "done" when all of the following are true on staging:

- [ ] Clicking the logo or "Back to home" from `/login`, `/register-society`, `/super-admin-login`, `/forgot-password`, `/reset-password`, `/check-email`, `/verify-email`, `/select-society`, `/privacy`, `/terms` lands on `/`.
- [ ] `/features`, `/pricing`, `/for-admins`, `/for-residents`, `/about`, `/contact`, `/security`, `/refund-policy` all return 200, render the marketing layout, and pass keyboard navigation.
- [ ] `/pricing` displays the live plan list from `/api/v1/public/plans` with a working monthly/annual/2-year/3-year toggle.
- [ ] Lighthouse mobile audit on `/` returns Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95.
- [ ] `/sitemap.xml` and `/robots.txt` are reachable and correct.
- [ ] OG image preview (Twitter card validator + LinkedIn post inspector) shows the brand template for `/`, `/pricing`, and `/features`.
- [ ] `/contact` lead submission writes a row to `Lead`, sends an email to `hello@rwaconnect.in`, and shows a success toast to the user.
- [ ] `/refund-policy` URL is added to Razorpay KYC submission flow (per `online_payment_razorpay.md` when that ships).
- [ ] All quality-gate checks pass on the final phase commit.
- [ ] Dark mode renders correctly on every marketing page.

---

## 11. Out of scope (explicit)

- Localisation (i18n) — single-language launch (English). Hindi / regional languages in a follow-up.
- Blog or content marketing — defer until product-market fit on the core.
- Public counsellor directory — covered by `counsellor-role.md` § 14 (deferred).
- Live chat widget — can layer in later (Crisp / Intercom).
- A/B testing of hero copy — ship one version, measure, iterate.
- Pre-rendered case studies / customer stories — needs real customers.
- Video demos — record after the home redesign settles.
- AI gateway / chatbot — not relevant to landing page UX.
- App store listings (Play / App Store) — covered by `pwa-level2.md`'s level 3 follow-up.

---

## 12. Open questions

1. **Domain.** Will the production domain be `rwaconnect.in` or kept on `rwa-gamma.vercel.app`? If the former, register the domain and configure DNS during Phase 5 so OG images and canonical tags are correct.
2. **Brand asset ownership.** The current "Eden Estate brand" comment in `globals.css` ties the platform to one society. Does RWA Connect have its own brand identity (logo, wordmark) separate from Eden Estate? If yes, ship those assets in Phase 1.
3. **Testimonials.** Do we have written consent from at least three RWA admins to use their name + society name + photo? If no, Phase 5 ships representative testimonials labelled as such.
4. **Lead routing.** Lead form submissions email `hello@rwaconnect.in` — is that mailbox monitored, or should they go to a Slack channel / CRM?
5. **Counsellor program landing.** The counsellor role is shipped but residents and admins have no public-facing explanation of it. Add `/counsellor-program` in a follow-up?

---

## 13. Self-review checklist

- [x] Every user concern is addressed: home redesign (§5 Phase 1, 5), nav bug (§5 Phase 1.2), additional pages (§4 IA + §5 Phases 2–4).
- [x] No phase has more than 7 source files.
- [x] Phase order respects dependencies (layout before pages; public API before pricing page).
- [x] Every new endpoint has its auth level explicit (anonymous, rate-limited).
- [x] Every page has its navigation entry point specified (header, footer, or both).
- [x] No backwards-incompatible URL changes — `/privacy` stays at `/privacy`, etc.
- [x] DB additions (the `Lead` model) are additive, defaulted, and don't break existing migrations.
- [x] Acceptance criteria are observable by a tester without source access.
- [x] Out-of-scope and open questions are explicit.
