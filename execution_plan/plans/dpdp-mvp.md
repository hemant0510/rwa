# DPDP MVP — The Must-Have Before First Real Society

**Owner:** product/eng (Hemant)
**Created:** 2026-04-27
**Status:** Ready to execute — **MUST land before the first paying society goes live with real residents**
**Sister doc:** [`dpdp-full.md`](./dpdp-full.md) — everything else, deferred to Phase 2 with pre-questions
**Authoritative source:** Bare Act PDF, DPDP Act 2023 (Act No. 22 of 2023, assented 11-Aug-2023, Gazette of India)

---

## 0. ⚠️ Two non-code red flags to address BEFORE code work starts

These are not engineering tasks but block the legal value of every code change below.

### 0.1 Entity structure — sole proprietorship is the wrong vehicle for this product

Today, **Navara Tech is a sole proprietorship**. RWA Connect 360 is about to hold PII (name, mobile, email, photo, ID proof, vehicle plate, payment record) of _thousands of residents across multiple societies_.

**Why this is a problem:**

| Risk under sole prop                                                                                                                                                                            | Same risk under Pvt Ltd / LLP                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personal unlimited liability.** A DPDP penalty (₹50 cr–₹250 cr per Schedule, ₹10K duty breaches) lands on Hemant personally. Your house, bank balance, future income are exposed.             | The corporation absorbs the penalty. Director liability exists for specific breaches but it's bounded and defensible.                        |
| **§17(3) startup exemption is unreachable** — DPIIT recognition (the likely gateway) requires Pvt Ltd, LLP, or Partnership Firm. Sole props are ineligible by DPIIT rules.                      | Eligible to apply for DPIIT recognition; if the exemption notification names DPIIT-recognised startups, ~40% of the Phase-2 plan disappears. |
| **Vendor DPAs (§8(2))** — Supabase, Vercel, Razorpay, etc. typically sign Data Processing Agreements with companies, not individuals. Some won't sign with sole props at all.                   | Routine — you sign as authorised signatory of the company.                                                                                   |
| **Society contracts** — RWAs are formal entities with managing committees and legal counsel; they're often unwilling to sign B2B contracts with sole proprietors holding their residents' data. | Standard B2B vendor relationship.                                                                                                            |
| **Funding / future investment** — No VC will invest in a sole prop.                                                                                                                             | Standard.                                                                                                                                    |

**Recommendation (not legal advice — confirm with a CA/CS):**

Incorporate **Navara Tech Private Limited** before signing the first paying society. Typical timeline: 10–15 working days through MCA. Cost: ~₹15,000–₹30,000 all-in via a Company Secretary or via a service like Razorpay Rize / Vakilsearch / Cleartax. Apply for DPIIT recognition immediately after (free, ~2 weeks).

The trademark stays valid through the assignment process when the sole prop transfers it to the Pvt Ltd.

**This is the highest-leverage decision in this entire DPDP plan. Without it, the rest reduces personal protection but cannot eliminate it.**

### 0.2 Designate the Grievance Officer (§13) — via env vars

Even before code lands, the privacy page needs a **named human** as the Grievance Officer with a real email and a 30-day SLA promise. Today the page says `privacy@navaratech.in` — a generic mailbox with no name.

For MVP the GO can be Hemant himself (named). It's not ideal long-term (single point of failure), but it's defensible at v1 scale and removes the "no named officer" §13 violation immediately.

**Implementation:** GO contact is read from server-side env vars so values can change without a deploy and aren't hard-coded in source. Set these in `.env.local` (dev) and Vercel project env (prod):

```bash
DPDP_GO_NAME="Hemant Bhagat"
DPDP_GO_EMAIL="go@navaratech.in"
DPDP_GO_PHONE=""              # optional; leave empty if not provided
DPDP_GO_SLA_DAYS="30"         # placeholder until DPDP Rules prescribe
DPDP_DATA_RESIDENCY="India (Supabase Mumbai region — AWS ap-south-1)"
```

A small helper `src/lib/dpdp/grievance-officer.ts` reads these and:

- Throws at module load in `NODE_ENV=production` if `DPDP_GO_NAME` or `DPDP_GO_EMAIL` is unset (fail fast, not silent fall-back to "TBD").
- In dev, falls back to `"GO_NAME"` / `"go@example.test"` so local dev doesn't break.
- Is consumed by: M5 grievance form & email templates, M6 privacy page, the lead/contact-form consent notice, and any erasure-request email.

Server components (privacy page, marketing pages) call the helper directly. Client components (the consent notice variant inside `LeadForm`) receive the values as props from their server-rendered parent. **No `NEXT_PUBLIC_*` prefixes — the values are public-facing but rendered server-side, which keeps the client bundle smaller and avoids leaking the raw env var name.**

---

## 1. Why this MVP exists and what it deliberately does NOT cover

Every obligation in the full DPDP Act maps to two buckets:

| Bucket             | What's in it                                                                                                                                                                                                                          | Where it lives                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **MVP (this doc)** | Anything where a launch with real residents creates legal/financial exposure if not done. The spine: persisted consent, named GO, vendor DPAs, PII out of logs, parental consent for minors, basic erasure channel, soft-delete only. | Here — **must ship before first society**                 |
| **Full (Phase 2)** | Everything else: full data export, multi-language consent, retention cron, breach automation, re-consent on policy change, nominee UI, SDF readiness, Consent Manager, etc.                                                           | [`dpdp-full.md`](./dpdp-full.md) — gated by pre-questions |

**Guiding principle for MVP:** _"If a single resident complains to the Board on day 31, can we present evidence we tried to comply?"_ That's the bar. Not "perfect compliance" — that's Phase 2. **"Defensible posture under audit"**.

What MVP deliberately does NOT include:

- Full data-export endpoint (manual export via GO email is acceptable at <5K residents)
- Multi-language consent (English-only at MVP; Hindi in Phase 2)
- Re-consent modal on policy change (manual notification email is acceptable until Phase 2)
- Retention auto-purge cron (manual quarterly purge is acceptable until Phase 2)
- Right-to-nominate UI (low-frequency request; manual handling via GO email)
- Breach notification automation (runbook + email template only)
- Versioned policy with checked-in shasum (single hard-coded version is fine for MVP)

---

## 2. DPDP Act fundamentals — read once before any DPDP work

This section gives a developer everything they need to understand the Act without re-reading the Bare Act. Cite the section number in code comments when the rule isn't obvious.

### 2.1 Glossary (citations to §2 Definitions)

| Term                                 | §2 ref            | What it means in our app                                                                                                                                                                                                                                                                   |
| ------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Data Principal**                   | §2(j)             | The individual whose data we hold — usually a resident, sometimes an admin. **Includes parents/guardian for a child, and lawful guardian for a person with disability.**                                                                                                                   |
| **Data Fiduciary**                   | §2(i)             | The entity that decides why & how the data is used — **Navara Tech** (us).                                                                                                                                                                                                                 |
| **Data Processor**                   | §2(k)             | Anyone we hand data to — Supabase, Vercel, Razorpay, Sentry, SMTP provider. Each requires a §8(2) contract (DPA).                                                                                                                                                                          |
| **Significant Data Fiduciary (SDF)** | §2(z), §10        | A class notified by Central Govt based on §10(1) factors (volume, sensitivity, risk, sovereignty, electoral democracy, security, public order). We are **not** SDF today. SDF triggers DPO + independent auditor + DPIA + periodic audit. Tracked in [`dpdp-full.md`](./dpdp-full.md) F11. |
| **Data Protection Officer (DPO)**    | §2(l), §10(2)(a)  | Mandatory only for SDFs. India-based, accountable to the Board of Directors, point of contact for grievance. **We do NOT appoint a DPO** — but §6(3)/§8(9) still require us to publish business contact info of "a person who is able to answer" — that's our Grievance Officer.           |
| **Consent Manager**                  | §2(g), §6(7)–(9)  | A Board-registered intermediary that lets a Data Principal manage consent across many Fiduciaries. Optional pathway. **Out of scope for MVP**, see [`dpdp-full.md`](./dpdp-full.md) F12.                                                                                                   |
| **Personal Data**                    | §2(t)             | Any data about an _identifiable_ individual — name, email, mobile, photo, vehicle plate, payment record, IP, identity proof.                                                                                                                                                               |
| **Personal Data Breach**             | §2(u)             | "Unauthorised processing or accidental disclosure, acquisition, sharing, use, alteration, destruction or loss of access to personal data" that compromises confidentiality, integrity OR **availability** (extended downtime that loses access counts).                                    |
| **Processing**                       | §2(x)             | Wholly or partly automated operations: collection, recording, organisation, structuring, storage, retrieval, use, sharing, disclosure, erasure, destruction.                                                                                                                               |
| **Notice**                           | §5                | The plain-language statement at/before consent. Required content per §5(1): (i) personal data + purpose, (ii) how to exercise §6(4) withdrawal + §13 grievance, (iii) how to complain to the Board. Distinct from the privacy policy.                                                      |
| **Consent**                          | §6(1)             | Free, specific, informed, unconditional, unambiguous, with clear affirmative action, **limited to data necessary for the specified purpose**.                                                                                                                                              |
| **Certain Legitimate Uses**          | §2(d), §7         | The other lawful basis (besides consent) — see § 2.2 below.                                                                                                                                                                                                                                |
| **Specified Purpose**                | §2(za)            | The purpose mentioned in the notice — defines the boundary of lawful processing.                                                                                                                                                                                                           |
| **Grievance Officer (GO)**           | §6(3), §8(9), §13 | The person who answers DP queries, named in the consent notice and on the privacy page. Hemant for MVP. Responds within 30-day SLA (placeholder until Rules prescribe).                                                                                                                    |
| **Data Protection Board (DPB)**      | §2(c), §18–§26    | The regulator. Established by Central Govt. Receives breach intimations under §8(6) and DP complaints; can issue directions and impose Schedule penalties. Functions as a _digital office_ (§28(1)).                                                                                       |
| **Appellate Tribunal**               | §2(a), §29        | Telecom Disputes Settlement and Appellate Tribunal (TDSAT) under TRAI Act 1997. Appeals from Board within 60 days.                                                                                                                                                                         |

### 2.2 Lawful basis map — §6 consent vs §7 certain legitimate uses

The Act gives us TWO lawful bases. Misclassifying a flow leads to either over-asking-for-consent (UX cost) or under-asking (regulatory risk). Each flow in our app maps to ONE basis.

| Our flow                                         | Lawful basis                                                                                                         | Reasoning                                                                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Society admin signs up via `/register-society`   | **§6 consent**                                                                                                       | Voluntary registration creating a long-term, multi-purpose account.                                                    |
| Resident registers via `/register/[societyCode]` | **§6 consent**                                                                                                       | Same — multi-purpose: notifications, financial records, family/vehicle/pet registry.                                   |
| Resident submits a support ticket                | **§7(a)** voluntary provision for specified purpose                                                                  | DP voluntarily provides data to resolve an issue. No fresh §6 consent needed if signup notice covered support tickets. |
| Resident updates profile photo / mobile          | **§7(a)**                                                                                                            | Voluntary provision to keep account current.                                                                           |
| Lead form on `/contact`                          | **§6 consent**                                                                                                       | Pre-account; explicit consent required for marketing/contact follow-up.                                                |
| Society admin downloads resident report          | Already-collected; **no new processing** requiring new consent. §8(4) accountability still applies — log the access. |                                                                                                                        |
| Sending invoice email                            | **§7(a)** — contractual fulfilment, already disclosed at signup                                                      |                                                                                                                        |
| Sending WhatsApp message                         | **§6 consent** — granular `consentWhatsapp` already captured                                                         |                                                                                                                        |
| Razorpay payment processing                      | **§7(a)** — voluntary provision to complete a transaction                                                            |                                                                                                                        |
| Onward sharing with law enforcement              | **§7(d)** compliance with law / §17(1)(c) exemption                                                                  |                                                                                                                        |
| Counsellor viewing escalated ticket              | **§7(a)** — resident voluntarily escalated                                                                           |                                                                                                                        |

**Rule we follow:** if a flow processes data **already collected** under signup consent and stays within the disclosed purpose, no new consent prompt — but the original notice must have covered it. M1's notice copy is therefore broad enough to cover all routine internal flows; specific _new_ purposes (WhatsApp, marketing email, parental processing) get their own granular consent records.

### 2.3 Burden of proof (§6(10)) — why persistence is mandatory

> "Where a consent given by the Data Principal is the basis of processing of personal data and a question arises in this regard in a proceeding, the Data Fiduciary shall be obliged to **prove** that a notice was given by her to the Data Principal and consent was given by such Data Principal to the Data Fiduciary in accordance with the provisions of this Act and the rules made thereunder." — §6(10)

This single sub-section is the legal driver for the entire MVP M1. We must, on demand, produce: **what notice was shown, what version, what the user did, when, and from where.** That is exactly what `ConsentRecord` (§ 3.1) captures. Every M1 file traces back to §6(10).

### 2.4 Penalties — verified verbatim from the Schedule of the Bare Act

| #   | Failure                                                         | Max penalty                           |
| --- | --------------------------------------------------------------- | ------------------------------------- |
| 1   | Breach of §8(5) — reasonable security safeguards                | **₹250 crore**                        |
| 2   | Breach of §8(6) — breach notification to Board AND affected DPs | **₹200 crore**                        |
| 3   | Breach of §9 — children's data obligations                      | **₹200 crore**                        |
| 4   | Breach of §10 — SDF additional obligations                      | **₹150 crore**                        |
| 5   | Breach of §15 — Data Principal duties (false complaints etc.)   | **₹10,000**                           |
| 6   | Breach of voluntary undertaking under §32                       | up to the underlying breach's penalty |
| 7   | Any other breach of the Act or Rules                            | **₹50 crore**                         |

§33(2) lists the factors the Board considers in setting the actual amount. §28(12) lets the Board impose costs on false/frivolous complaints (this is why M5 surfaces §15 duties on the grievance form). §42 lets Govt double any penalty by notification. **For a sole proprietorship, ALL of these land on Hemant personally** — see § 0.1.

### 2.5 §15 Data Principal Duties — surface them in user-facing flows

§15 imposes 5 duties on the Data Principal, with up to ₹10,000 penalty for breach (Schedule item 5). The Act expects Fiduciaries to surface these duties at appropriate points:

1. **Comply with all applicable laws** while exercising rights (§15(a))
2. **No impersonation** while providing personal data (§15(b))
3. **No suppression of material information** when providing data for State documents (§15(c))
4. **No false or frivolous grievance/complaint** with us or with the Board (§15(d))
5. **Only verifiably authentic information** when exercising correction/erasure (§15(e))

MVP M5 surfaces (4) on the `/grievance` form. M6 lists all 5 on the privacy page. Phase 2 F8 generalises this with a `<DutiesDisclosure />` component.

### 2.6 §37 service-blocking risk — the second-strike danger

> "[…] on receipt of a reference in writing from the Board that — (a) intimates the imposition of monetary penalty by the Board on a Data Fiduciary in **two or more instances**; and (b) advises […] the **blocking for access by the public** to […] the Data Fiduciary […] the Central Government […] may […] direct any agency of the Central Government or any intermediary to block for access by the public […]" — §37(1)

**Translation:** two adverse Board orders, and the Govt can ask Vercel/our DNS/ISPs to block our service. This is service-existence risk, not just money. Our incident response treats the FIRST Board order as a near-existential event and the SECOND as terminal. This is also why MVP launch checklist insists on counsel review of the privacy policy.

---

## 3. The MVP non-negotiable list (mapped to Act sections)

| #   | Obligation                                                                                                            | Act ref                 | MVP implementation                                                                                                                | Phase 2 upgrade                                  |
| --- | --------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | Persisted T&C + Privacy + WhatsApp consent at signup with timestamp + IP + UA                                         | §6(10) burden of proof  | `ConsentRecord` table; insert on every consent moment                                                                             | Versioned with sha + multi-language              |
| 2   | Notice rendered at consent time (purpose, withdrawal, complaint)                                                      | §5(1)                   | `<ConsentNotice />` component, English                                                                                            | Multi-language (§5(3))                           |
| 3   | Named Grievance Officer + 30-day SLA on privacy page + complaint endpoint                                             | §8(9), §13              | Hemant named; `/grievance` form → `GrievanceTicket` table → email Hemant                                                          | Inbox UI for GO, auto-escalation, SLA cron       |
| 4   | Vendor DPAs on file for Supabase, Vercel, Razorpay, SMTP                                                              | §8(2)                   | `ProcessorContract` table; rows seeded on day 0                                                                                   | Sentry, future processors                        |
| 5   | PII out of `console.*` logs in API routes                                                                             | §8(4), §8(5)            | `safeLog` wrapper + delete known offender in `leads/route.ts`                                                                     | ESLint rule prevents recurrence                  |
| 6   | Sentry configured to NOT capture IP / PII                                                                             | §8(4), §8(5)            | `sendDefaultPii: false` + `beforeSend` PII scrubber                                                                               | Custom redaction patterns                        |
| 7   | Parental consent on adding under-18 Dependent                                                                         | §9(1), §9(2)            | DOB-driven checkbox, blocks submit, persists `Dependent.parentalConsentAt`                                                        | "Verifiable" mechanism per Rules when prescribed |
| 8   | Withdraw WhatsApp consent UI                                                                                          | §6(4)                   | Toggle on resident settings page; `consentWhatsapp = false` + `ConsentRecord(action=WITHDRAWN)`                                   | Withdraw any consent artefact                    |
| 9   | Audit row on every admin read of resident PII                                                                         | §8(4)                   | `auditPiiAccess()` called from admin GET endpoints                                                                                | Field-level granularity                          |
| 10  | Erasure REQUEST channel (manual fulfillment OK)                                                                       | §12(3)                  | "Delete my account" button → email to GO + `ErasureRequest(status=PENDING)` row → GO manually performs soft-delete within 30 days | Self-serve + retention cron                      |
| 11  | Soft-delete only — no hard delete from any UI/admin path                                                              | §8(7) + audit integrity | `User.deletedAt` field; `get-current-user.ts` returns null for deleted                                                            | Hard-delete cron in Phase 2                      |
| 12  | Privacy page rewritten — named GO, no "continued use = consent" clause, India-residency disclosure, §15 duties listed | §6(2), §13, §15, §16    | Static page rewrite                                                                                                               | Versioned in `policy/versions.ts`                |
| 13  | Touch `User.lastApproachedAt` on every authenticated request                                                          | §8(8)                   | Middleware-level update with hourly debounce                                                                                      | Cron consumes for inactive-account purge         |

That's 13 items. Everything else is Phase 2.

---

## 4. Design principles (apply to every M-group below)

1. **Burden-of-proof is the design driver (§6(10)).** Every notice we show, every consent the user gives, must be reproducible months later on demand. This is why `ConsentRecord` is append-only and stores artefact version + IP + UA.
2. **Every PII access leaves an audit row.** Reads, writes, exports, deletions. The `auditLog` table grows; we accept that. Use a `PII_ACCESS` action prefix for cheap filtering. (§8(4) accountability.)
3. **Consent is versioned and immutable.** A `ConsentRecord` row is created — never updated — when a user accepts or withdraws. The active state is derived from the latest row.
4. **Erasure is soft-delete only at MVP.** Immediate hard delete breaks audit trails (who created Fee X). Soft delete sets `deletedAt`, anonymises display fields, preserves financial records. Hard-delete cron is Phase 2. (§8(7) + §12(3).)
5. **Notice ≠ Policy.** At consent time we render a short, plain-language **notice** (purpose, withdrawal, complaint route) — not a wall of policy text. The policy is linked. The notice version is what we record consent against. (§5(1).)
6. **Grievance is internal-first (§13(3)).** Our `/grievance` page is the primary CTA. The Board's complaint route is mentioned but as a secondary "after-you-have-tried-us-first" route.
7. **The GO is a person, not a queue — sourced from env vars.** Privacy page shows `${DPDP_GO_NAME} <${DPDP_GO_EMAIL}>` via the `getGrievanceOfficer()` helper. Footer of every authed page links to `/grievance`. Complaints land in `GrievanceTicket` table with `DPDP_GO_SLA_DAYS` SLA. See § 0.2 for env var contract.
8. **No invalid consent clauses (§6(2)).** Privacy page, terms, consent text — none may purport to waive a Data Principal's right (e.g., the right to complain to the Board). M6 includes a copy-review step.
9. **PII never enters logs.** `safeLog(message, ctx)` allow-lists keys; everything else rejected. Manual grep at MVP, custom ESLint rule in Phase 2. (§8(4).)
10. **Children's data is strictly mediated.** Adding a Dependent under 18 requires parent's `parentalConsent` checkbox. **No tracking pixels or analytics events fire for any data subject under 18** (§9(3)).
11. **Processors only under contract (§8(2)).** `ProcessorContract` registry is populated on day 0 with all 4 vendors.
12. **"Purpose deemed served" is observable (§8(8)).** Every authed request bumps `User.lastApproachedAt`. Phase 2 cron consumes it; MVP just captures the signal.
13. **English at MVP, Hindi-ready.** §5(3) requires offering English or any 8th-Schedule language. English alone is permissible; Hindi lands in Phase 2 F9.
14. **Incorporate before scale.** MVP code can ship as sole prop, but the legal value of every consent record is materially weaker until the entity is Pvt Ltd. See § 0.1.

---

## 5. Schema changes — single migration `0042_dpdp_mvp`

### 5.1 New table — `ConsentRecord`

```prisma
model ConsentRecord {
  id              String          @id @default(uuid())
  userId          String?         @map("user_id")
  leadId          String?         @map("lead_id")
  artefact        ConsentArtefact                    // TNC | PRIVACY | WHATSAPP | PARENTAL | MARKETING_EMAIL
  artefactVersion String          @map("artefact_version")  // "1.0" hard-coded for MVP
  action          ConsentAction                      // GIVEN | WITHDRAWN
  ipAddress       String?         @map("ip_address")
  userAgent       String?         @map("user_agent")
  createdAt       DateTime        @default(now())

  @@index([userId, artefact, createdAt])
  @@map("consent_records")
}

enum ConsentArtefact { TNC PRIVACY WHATSAPP PARENTAL MARKETING_EMAIL }
enum ConsentAction { GIVEN WITHDRAWN }
```

(Phase 2 adds `artefactSha`, `language`, `REAFFIRMED` action.)

### 5.2 New table — `GrievanceTicket`

```prisma
model GrievanceTicket {
  id            String           @id @default(uuid())
  userId        String?          @map("user_id")
  contactEmail  String           @map("contact_email")
  contactPhone  String?          @map("contact_phone")
  category      GrievanceCategory                          // ACCESS | CORRECTION | ERASURE | OTHER
  subject       String
  body          String           @db.Text
  status        GrievanceStatus  @default(OPEN)            // OPEN | RESOLVED
  slaDeadline   DateTime         @map("sla_deadline")      // createdAt + 30 days
  resolution    String?          @db.Text
  resolvedAt    DateTime?        @map("resolved_at")
  createdAt     DateTime         @default(now())

  @@index([status, slaDeadline])
  @@map("grievance_tickets")
}

enum GrievanceCategory { ACCESS CORRECTION ERASURE OTHER }
enum GrievanceStatus { OPEN RESOLVED }
```

### 5.3 New table — `ErasureRequest`

```prisma
model ErasureRequest {
  id            String          @id @default(uuid())
  userId        String          @map("user_id")
  requestedAt   DateTime        @default(now()) @map("requested_at")
  softDeletedAt DateTime?       @map("soft_deleted_at")
  status        ErasureStatus   @default(PENDING)         // PENDING | SOFT_DELETED | CANCELLED
  reason        String?         @db.Text

  @@index([status, requestedAt])
  @@map("erasure_requests")
}

enum ErasureStatus { PENDING SOFT_DELETED CANCELLED }
```

### 5.4 New table — `ProcessorContract` (DPA registry)

```prisma
model ProcessorContract {
  id                String   @id @default(uuid())
  processorName     String   @map("processor_name")           // "Supabase", "Vercel", "Razorpay", "SMTP"
  processorEntity   String   @map("processor_entity")
  contractTitle     String   @map("contract_title")
  contractUrl       String   @map("contract_url")
  contractSignedAt  DateTime @map("contract_signed_at")
  isActive          Boolean  @default(true) @map("is_active")
  notes             String?  @db.Text
  createdAt         DateTime @default(now())

  @@map("processor_contracts")
}
```

### 5.5 User model — additions

```prisma
// Added to existing User model:
deletedAt         DateTime?  @map("deleted_at")              // §8(7), §12(3)
isAnonymised      Boolean    @default(false) @map("is_anonymised")
lastApproachedAt  DateTime?  @map("last_approached_at")      // §8(8) — bumped on each authed request
```

### 5.6 Dependent model — additions

```prisma
// Added to existing Dependent model:
parentalConsentAt        DateTime?  @map("parental_consent_at")
parentalConsentByUserId  String?    @map("parental_consent_by_user_id")
isMinor                  Boolean    @default(false) @map("is_minor")
```

### 5.7 Lead model — additions

```prisma
// Added to existing Lead model — captures the consent context for marketing/contact-form leads:
consentNoticeVersion  String?  @map("consent_notice_version")  // matches POLICY_VERSIONS.consentNotice.version when shown
ipAddress             String?  @map("ip_address")              // captured at moment of submission for §6(10) burden of proof
```

(Phase 2 adds `consentNoticeSha` once policies are sha-versioned in F1.)

### 5.8 No changes to existing PII columns

We do **not** drop or rename PII columns in this migration. Anonymisation happens at soft-delete time (M5/M7). Renaming would break audit history.

---

## 6. Implementation groups (M1 through M7)

Five focused groups; each independently committable; each merged in order.

### M1 — Persisted consent at signup + visible Notice

**Goal:** §5(1) notice + §6(1) consent + §6(10) proof = the consent spine.

**Files to create:**

- `src/lib/consent/record.ts` — `recordConsent({ userId?, leadId?, artefact, action, request })`. Captures IP from `x-forwarded-for` (first hop only) + UA. Inserts `ConsentRecord` row.
- `src/lib/consent/state.ts` — `getActiveConsents(userId)` returning latest per-artefact action.
- `src/components/features/legal/ConsentNotice.tsx` — server component. Renders the 3-part §5(1) notice: (i) what data + why, (ii) how to withdraw + how to raise grievance, (iii) how to complain to the Board.

**Files to modify:**

- `src/app/(auth)/register-society/page.tsx` — render `<ConsentNotice />` above the existing T&C checkbox; remove the bare `useState` hookup.
- `src/app/api/v1/auth/register-society/route.ts` — wrap user creation in a `prisma.$transaction` that also inserts 2 `ConsentRecord` rows (TNC + PRIVACY).
- `src/app/api/v1/residents/register/route.ts` — same: insert TNC + PRIVACY consent rows + the existing WHATSAPP consent (which already has its own column — keep it for back-compat AND insert a `ConsentRecord` row).
- `src/app/api/v1/public/leads/route.ts` — insert PRIVACY consent row keyed by `leadId`.
- `src/app/(marketing)/contact/page.tsx` — render `<ConsentNotice variant="lead" />` inside the form.
- `src/app/(marketing)/privacy/page.tsx` — rewrite per § 5 below (in this same M1 commit so the notice and the policy match).

**Tests:**

- `tests/lib/consent/record.test.ts` — IP stripping, UA capture, multi-row insert.
- `tests/api/auth/register-society.test.ts` — UPDATE existing — assert 2 ConsentRecord rows on signup.
- `tests/api/v1/public/leads/route.test.ts` — PRIVACY consent recorded.

### M2 — PII out of logs + Sentry hygiene

**Goal:** Stop the active leak. §8(4) accountability + §8(5) safeguards.

**Files to create:**

- `src/lib/log/safe.ts` — `safeLog.{info,warn,error}(message, ctx)`. `ctx` keys allow-listed (`userId`, `societyId`, `actionId`, `requestId`, `route`, `statusCode`, `durationMs`, `errorName`, `errorMessage`). Unknown keys throw in dev, are dropped in prod.

**Files to modify:**

- `src/app/api/v1/public/leads/route.ts` — known offender at line 30. Replace `console.info(...)` with `safeLog.info("lead.received", { route: "/api/v1/public/leads" })`. Strip name/email from log args.
- Grep all `console.*` in `src/app/api/**` and convert; goal is zero `console.*` in API routes after this commit.
- `sentry.server.config.ts` — `sendDefaultPii: false`; `beforeSend` hook scrubs emails (regex), Indian mobile numbers (regex `/\+?91[-\s]?[6-9]\d{9}/`), and obvious PAN/Aadhaar patterns. Unset IP capture from request headers.
- `instrumentation-client.ts` — same `beforeSend` for browser-side errors.

**Tests:**

- `tests/lib/log/safe.test.ts` — reject unknown keys; allowed keys round-trip; production mode redacts.

### M3 — Vendor DPAs on file (operational + UI)

**Goal:** §8(2) — every Processor under a valid contract.

**Operational (off-code, blocks launch):**

1. Open Supabase dashboard → Settings → request and download their signed DPA.
2. Vercel → settings → request DPA from sales (instant for paid plans).
3. Razorpay → KYC dashboard already includes a merchant agreement that covers data processing; download the signed copy.
4. SMTP provider (whoever sends transactional email — Resend / SendGrid / SES) → request DPA.
5. Store all 4 PDFs in `private/dpa/` storage bucket (NOT in git).

**Files to create:**

- `src/app/sa/dpdp/processors/page.tsx` — SA-only registry UI listing every `ProcessorContract`. Form to add new rows, upload signed PDF, mark active/inactive.
- `src/app/api/v1/super-admin/processors/route.ts` — `GET` (list), `POST` (create with signed PDF upload).
- `src/app/api/v1/super-admin/processors/[id]/route.ts` — `GET`, `PATCH`, `DELETE` (soft).

**Tests:**

- `tests/api/v1/super-admin/processors/route.test.ts` — RBAC (only SUPER_ADMIN), CRUD.

**Launch action:** seed `ProcessorContract` rows for Supabase, Vercel, Razorpay, SMTP on production day-0.

### M4 — Children's parental consent on Dependent (§9)

**Goal:** Lock the minor pathway. We will have minors in Dependent table from the very first society.

**Files to modify:**

- `src/lib/validations/dependent.ts` (or wherever the Dependent zod schema lives) — add `parentalConsent: z.literal(true)` required when DOB indicates under 18.
- `src/components/features/residents/AddDependentForm.tsx` — when DOB makes the dependent under 18, render an extra parental-consent block with checkbox. Disable Submit until ticked.
- `src/app/api/v1/residents/[id]/family/route.ts` (POST) — server-side: compute `isMinor` from DOB; if minor and `parentalConsent !== true`, return 400 with code `PARENTAL_CONSENT_REQUIRED`. On success, insert `ConsentRecord(artefact=PARENTAL, userId=parent.id)` AND populate `Dependent.parentalConsentAt + parentalConsentByUserId + isMinor`.
- `src/app/api/v1/auth/register-society/route.ts` — reject if registering admin's own DOB indicates under 18.
- `src/app/api/v1/residents/register/route.ts` — same age gate.

**Tests:**

- `tests/api/v1/residents/family/route.test.ts` — adult dependent: no consent required; minor without consent: 400; minor with consent: success + ConsentRecord row.
- `tests/components/features/residents/AddDependentForm.test.tsx` — conditional consent block render based on DOB.

### M5 — Withdrawal + Erasure-request channel + Audit on PII reads

**Goal:** §6(4) withdrawal of WhatsApp consent. §12(3) erasure channel (manual fulfillment is fine at MVP scale). §8(4) audit on admin PII reads.

**Files to create:**

- `src/lib/dpdp/grievance-officer.ts` — `getGrievanceOfficer()` returns `{ name, email, phone?, slaDays, dataResidency }` from `DPDP_GO_*` env vars. Throws at module-load in production if name or email is unset. Dev fallback: `"GO_NAME"` / `"go@example.test"`. Single source of truth — every other file that displays GO info imports from here.
- `src/lib/audit/pii.ts` — `auditPiiAccess({ actorUserId, subjectUserId, action, scope })`. Inserts `auditLog` with `action: "PII_READ"`.
- `src/lib/audit/touch.ts` — `touchLastApproached(userId)` — bumps `User.lastApproachedAt`. Hourly debounce.
- `src/app/r/settings/privacy/page.tsx` — Privacy Settings page for residents. Three sections: Active consents (toggle WhatsApp), Request data export (links to grievance form pre-filled with category=ACCESS), Delete my account (button → confirmation modal → POST to `/api/v1/me/erase`).
- `src/app/admin/settings/privacy/page.tsx` — same for admins.
- `src/app/api/v1/me/consent/withdraw/route.ts` — `POST { artefact }` → insert `ConsentRecord(action=WITHDRAWN)` + flip `Resident.consentWhatsapp = false` for back-compat. Returns 409 if trying to withdraw TNC or PRIVACY (those require account deletion).
- `src/app/api/v1/me/erase/route.ts` — `POST { reason? }` → insert `ErasureRequest(status=PENDING)` + send email to `getGrievanceOfficer().email` with the request details + send confirmation email to user. Tag as a `GrievanceTicket(category=ERASURE)` so it appears on the SLA dashboard.
- `src/app/(marketing)/grievance/page.tsx` — public complaint form. Renders `${getGrievanceOfficer().name}` and SLA prominently. Fields: category, contact email, subject, body. Shows the §15 duties disclosure and ₹10,000 penalty notice for false complaints. Submits to `/api/v1/public/grievance`.
- `src/app/api/v1/public/grievance/route.ts` — rate-limited (5/hr/IP). Inserts `GrievanceTicket` with `slaDeadline = now + DPDP_GO_SLA_DAYS days`. Sends ack email to complainant + alert email to `getGrievanceOfficer().email`.
- `src/lib/email-templates/grievance-ack.ts` — acknowledgement template.
- `src/lib/email-templates/grievance-go-alert.ts` — alert to GO.
- `src/lib/email-templates/erasure-request-confirmation.ts`.

**Files to modify:**

- `src/lib/get-current-user.ts` — return `null` if `User.deletedAt` is set.
- `src/app/api/v1/auth/login/route.ts` — explicit "account deleted" error for soft-deleted users.
- Every admin-facing GET endpoint that returns resident PII (residents list, profile, search, household, vehicle search, support tickets, payment claims, reports) — call `auditPiiAccess()`.
- Every authenticated route (or shared `withAuth`) — call `touchLastApproached(userId)`.
- `src/components/layout/{Resident,Admin,SuperAdmin,Counsellor}Sidebar.tsx` — footer "Privacy" / "Raise a concern" links.
- `src/components/features/marketing/MarketingFooter.tsx` — add Grievance link.

**Tests:**

- `tests/lib/audit/pii.test.ts` — row inserted with correct shape.
- `tests/lib/audit/touch.test.ts` — debounce respected.
- `tests/api/v1/me/consent/withdraw/route.test.ts` — withdraws WhatsApp; rejects TNC/PRIVACY with 409.
- `tests/api/v1/me/erase/route.test.ts` — request → email sent → ErasureRequest row.
- `tests/api/v1/public/grievance/route.test.ts` — rate limit, ticket creation, ack + GO alert emails.
- `tests/app/r/settings/privacy/page.test.tsx` — toggle WhatsApp off; click delete shows modal.

### M6 — Privacy / Terms rewrite + named GO

**Goal:** Close the 6 🔴 blocking issues found in the existing-pages audit (privacy §6 routing, §8 deemed-consent, §4 wrong region, §9 generic mailbox; terms §11 deemed-consent, §8 liability cap missing DPDP carve-out). Also surface §15 duties + India residency + Board / TDSAT route.

**Files to modify:**

`src/app/(marketing)/privacy/page.tsx` — rewrite. Specific changes:

- **§4 Data Storage** — replace "Supabase (Singapore region)" with `getGrievanceOfficer().dataResidency` value (renders "India (Supabase Mumbai region — AWS ap-south-1)"). Affirm "data is not transferred outside India".
- **§6 Your Rights** — fix the routing line. Replace "contact the RWA Admin at your registered email address" with "submit a request via [/grievance](/grievance) or write to `${name} <${email}>` (sourced from env). We respond within `${slaDays}` days."
- **§8 Changes to This Policy** — REMOVE the "continued use constitutes acceptance" sentence. Replace with: _"We will notify you in advance and request fresh consent before any material change. For non-material editorial fixes, we will post the revised policy with an updated date."_
- **§9 Contact** — replace generic `privacy@navaratech.in` with `${getGrievanceOfficer().name} <${getGrievanceOfficer().email}>` + `${slaDays}` day SLA + link to `/grievance` + Board complaint route under §13(3) + TDSAT appeal route under §29.
- **NEW §10 Your Duties (Section 15)** — list all 5 duties verbatim with the ₹10,000 penalty disclosure for false complaints.
- **NEW §11 Withdraw Consent** — explain that consent can be withdrawn at any time via Privacy Settings (residents) or by contacting the GO; reiterate §6(5) — withdrawal does not invalidate prior processing.
- **`Last updated`** — bumped to deploy date.

`src/app/(marketing)/terms/page.tsx` — rewrite. Specific changes:

- **§8 Limitation of Liability** — add a statutory carve-out: _"Nothing in this clause limits or excludes our obligations or liability under the Digital Personal Data Protection Act, 2023, the Consumer Protection Act, 2019, or any other non-excludable statutory liability under Indian law."_
- **§9 Termination** — append: _"You may also request deletion of your own account at any time under our Privacy Policy. Such deletion is subject to financial-record retention obligations under Indian law."_
- **§10 Governing Law** — append the parallel DPDP route: _"For data-protection-specific grievances, the routes set out in our Privacy Policy (internal Grievance Officer → Data Protection Board of India → Telecom Disputes Settlement and Appellate Tribunal) apply in addition to the courts."_
- **§11 Changes to Terms** — REMOVE the "continued use" sentence. Replace with the same wording as Privacy §8.

`src/components/features/marketing/MarketingFooter.tsx` — add Grievance link in legal column.

**Tests:**

- `tests/app/(marketing)/privacy/page.test.tsx` — assert env-sourced GO name visible; assert no "continued use" wording; assert §15 duties listed; assert "Mumbai" appears in §4 (not "Singapore").
- `tests/app/(marketing)/terms/page.test.tsx` — assert DPDP carve-out present in §8; assert no "continued use" wording in §11.
- `tests/lib/dpdp/grievance-officer.test.ts` — env vars read; production-mode missing-vars throws; dev fallback works.

### M7 — Soft-delete-only enforcement (no hard delete from any code path)

**Goal:** Prevent accidental loss of audit history. Hard-delete cron is Phase 2.

**Files to modify (audit pass):**

- Grep `prisma.*.delete(` and `prisma.*.deleteMany(` across `src/`. For every `User`-related call, replace with a soft-delete pattern (set `deletedAt = now()`, anonymise display fields). Routes that legitimately hard-delete non-PII rows (verification tokens, etc.) are fine.
- Add a CI check: `scripts/check-no-user-hard-delete.mjs` — fails if any new code introduces `prisma.user.delete*` outside `src/lib/dpdp/erase.ts`.

**Tests:**

- `tests/scripts/check-no-user-hard-delete.test.ts` — sample malicious diff trips the check.

---

## 7. Pre-launch checklist (block first paying society until each is ✅)

| #   | Item                                                                                                                                                                                                              | Owner            | Phase 0 / 1 / 2 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------- |
| 1   | **Incorporation decision documented.** ✅ Resolved 2026-04-27: deferring; staying sole prop until any of the triggers in § 9 Q1 fires. Personal liability accepted in writing.                                    | Hemant           | Phase 0         |
| 2   | Set the 5 DPDP env vars in Vercel **prod project** AND `.env.local` for dev: `DPDP_GO_NAME`, `DPDP_GO_EMAIL`, `DPDP_GO_PHONE` (optional), `DPDP_GO_SLA_DAYS`, `DPDP_DATA_RESIDENCY`. See § 0.2 for sample values. | Hemant           | Phase 0         |
| 3   | If using `go@navaratech.in`, set up the alias / mailbox and verify a test email lands in your inbox                                                                                                               | Hemant           | Phase 0         |
| 4   | Privacy policy + terms reviewed by counsel (even a one-shot ₹15K-₹30K review)                                                                                                                                     | Hemant + counsel | Phase 0         |
| 5   | Vendor DPAs downloaded and uploaded to `ProcessorContract` registry: Supabase ✓, Vercel ✓, Razorpay ✓, SMTP ✓                                                                                                     | Hemant           | Phase 0         |
| 6   | M1 deployed to prod; smoke-test that consent rows are written on a real signup                                                                                                                                    | Eng              | Phase 1         |
| 7   | M2 deployed; Sentry verified to NOT capture IP; all `console.*` in API routes gone                                                                                                                                | Eng              | Phase 1         |
| 8   | M3 admin UI live; all 4 vendor DPA rows present                                                                                                                                                                   | Eng + Hemant     | Phase 1         |
| 9   | M4 deployed; smoke-test add a Dependent under 18 → blocked without consent → succeeds with consent                                                                                                                | Eng              | Phase 1         |
| 10  | M5 deployed; smoke-test (a) toggle WhatsApp off → consent record + flag flipped, (b) submit grievance form → ticket created + GO email received                                                                   | Eng + Hemant     | Phase 1         |
| 11  | M6 deployed; privacy page shows GO name, §15 duties, no waiver clauses                                                                                                                                            | Eng              | Phase 1         |
| 12  | M7 enforced; CI check active                                                                                                                                                                                      | Eng              | Phase 1         |
| 13  | First paying society's residents informed of Privacy Settings page in the welcome email                                                                                                                           | Hemant           | Phase 1         |
| 14  | Grievance SLA mental model documented for the GO (Hemant): "I will respond to every grievance within 7 days, resolve within 30."                                                                                  | Hemant           | Phase 1         |

**Phase 0** = pre-code (entity, contracts, policies). **Phase 1** = ship M1–M7.

---

## 8. What MVP does NOT cover (and why that's OK at our scale)

| Phase 2 item                               | Why deferring is acceptable for MVP scale (<5K residents, single-digit societies)                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Self-serve data export endpoint (§11)      | Manual export via GO email within 30 days is allowed under §13(2) — we just have to actually do it.            |
| Multi-language consent (§5(3))             | English is one of the permitted languages. Hindi can land in Phase 2 before scale across Hindi-belt societies. |
| Versioned policy with sha checks           | Single hard-coded version is enough until we have a v2 of the policy.                                          |
| Re-consent modal on policy change          | Notice + email sent manually before any policy version bump is enough.                                         |
| Retention auto-purge cron (§8(7), §8(8))   | Quarterly manual purge by SA is enough at MVP scale. We DO need to actually do the purge — Q1 deadline.        |
| Right-to-nominate UI (§14)                 | Low-frequency request; manual handling via GO email until Phase 2.                                             |
| Breach notification automation (§8(6))     | Runbook + email template are enough. Actual breach = page Hemant + counsel; manual filing with Board.          |
| `<DutiesDisclosure />` component (§15)     | Inline copy on signup form + privacy page is enough at MVP.                                                    |
| Custom ESLint rule for `no-console-in-api` | Manual review + grep is enough until Phase 2 makes the rule durable.                                           |
| SDF readiness tracking                     | We're nowhere near SDF threshold; revisit when we cross 50K residents or get a notification.                   |
| Consent Manager integration (§6(7)–(9))    | No Board-registered Consent Managers exist yet.                                                                |
| Vendor sub-processor disclosure            | Phase 2 once we know our sub-processor list is stable.                                                         |

If we cross **5,000 residents OR sign our 5th paying society OR receive our first grievance ticket** — whichever comes first — that triggers reading [`dpdp-full.md`](./dpdp-full.md) and starting Phase 2.

---

## 9. Open questions to answer ONCE before MVP work starts

| Q   | What you need to decide                                        | Status                                                                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1  | Are you incorporating Pvt Ltd before launch?                   | ✅ **Resolved 2026-04-27**: deferring incorporation; staying sole prop for v1. Hard trigger: incorporate by Month 6 OR before crossing 2,500 residents OR before any RWA/vendor refuses to sign with sole prop, whichever comes first. M3 vendor DPAs treated as best-effort with documented refusals. |
| Q2  | What value to use for the GO contact?                          | ✅ **Resolved 2026-04-27**: read from env vars `DPDP_GO_NAME`, `DPDP_GO_EMAIL`, `DPDP_GO_PHONE`, `DPDP_GO_SLA_DAYS`, `DPDP_DATA_RESIDENCY` — see § 0.2. Hemant sets the values in `.env.local` and Vercel project env.                                                                                 |
| Q3  | Does the existing T&C / Privacy contain §6(2)-invalid clauses? | ✅ **Audited 2026-04-27**: 6 🔴 blocking issues found (privacy §4 wrong region, §6 wrong routing, §8 deemed consent, §9 generic mailbox; terms §8 missing DPDP carve-out, §11 deemed consent). All addressed by M6.                                                                                    |
| Q4  | What's the single retention period for inactive accounts?      | Default: **3 years from `lastApproachedAt`** until DPDP Rules prescribe a period under §8(8). Mentioned in privacy page now; Phase 2 F6 cron enforces.                                                                                                                                                 |
| Q5  | ~~Are we OK saying "data hosted in Singapore"~~                | ✅ **Resolved 2026-04-27**: production DB is Supabase Mumbai (`ap-south-1`), project `rwa-connect-prod`. Notice/policy says "hosted in India". No §16 cross-border concern.                                                                                                                            |

All five questions are resolved. **Ready to start M1.**

---

## 10. Test taxonomy

Tag every DPDP-related test with a `@dpdp` describe-block annotation so we can run a compliance subset:

```ts
describe.concurrent("[@dpdp §6(10)] consent persistence", () => {
  /* ... */
});
describe.concurrent("[@dpdp §9] parental consent", () => {
  /* ... */
});
describe.concurrent("[@dpdp §13] grievance ticket flow", () => {
  /* ... */
});
```

Add an npm script:

```json
"test:dpdp": "vitest run --grep '@dpdp'"
```

CI gates on this passing as part of the quality gate. Target: every M-group adds at least one `@dpdp`-tagged test that demonstrates the obligation it implements.

---

## 11. Audit of current state (as of 2026-04-27 — what we are fixing)

| Surface                       | File                                                                                             | State today                                                                                                                                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Privacy policy                | [`src/app/(marketing)/privacy/page.tsx`](<../../src/app/(marketing)/privacy/page.tsx>)           | Lists DPDP rights, retention, GO email — but as static text, no version tag. M6 rewrites.                                                                                                                                                                              |
| Society signup consent        | [`src/app/(auth)/register-society/page.tsx`](<../../src/app/(auth)/register-society/page.tsx>)   | `useState` checkbox; gates Submit; never persisted. M1 fixes.                                                                                                                                                                                                          |
| Resident registration consent | [`src/app/api/v1/residents/register/route.ts`](../../src/app/api/v1/residents/register/route.ts) | Captures `consentWhatsapp` + timestamp. **No T&C / privacy consent captured.** M1 fixes.                                                                                                                                                                               |
| Schema — User                 | [`supabase/schema.prisma`](../../supabase/schema.prisma) (User model)                            | No `deletedAt`, `lastApproachedAt`, `isAnonymised`. M1 / M5 / M7 add.                                                                                                                                                                                                  |
| Schema — Resident             | [`supabase/schema.prisma`](../../supabase/schema.prisma) (Resident model)                        | Has `consentWhatsapp` + `consentWhatsappAt` only. M1 supplements with `ConsentRecord` rows.                                                                                                                                                                            |
| Schema — Lead                 | [`supabase/schema.prisma`](../../supabase/schema.prisma) (Lead model)                            | No consent context captured. § 5.7 adds `consentNoticeVersion`, `ipAddress`.                                                                                                                                                                                           |
| Data export endpoint          | —                                                                                                | None. Manual via GO email at MVP. Phase 2 F3 builds self-serve.                                                                                                                                                                                                        |
| Account deletion endpoint     | —                                                                                                | None. M5 adds REQUEST channel; manual fulfilment by GO. Phase 2 F4 automates.                                                                                                                                                                                          |
| Retention enforcement         | [`src/app/api/cron/`](../../src/app/api/cron/)                                                   | Crons exist for fees, support — none for DPDP retention. Manual quarterly purge at MVP; Phase 2 F6 cron.                                                                                                                                                               |
| Audit log on PII reads        | [`src/lib/audit.ts`](../../src/lib/audit.ts)                                                     | Logs writes; does **not** log reads. M5 adds `auditPiiAccess()`.                                                                                                                                                                                                       |
| PII in app logs               | [`src/app/api/v1/public/leads/route.ts:30`](../../src/app/api/v1/public/leads/route.ts#L30)      | `console.info` includes name + email. M2 fixes (known offender + grep sweep).                                                                                                                                                                                          |
| Sentry config                 | `instrumentation.ts` / `sentry.*.config.ts`                                                      | Default install. IP capture + automatic breadcrumbs likely on. M2 disables both.                                                                                                                                                                                       |
| GO contact                    | [`src/app/(marketing)/privacy/page.tsx`](<../../src/app/(marketing)/privacy/page.tsx>)           | "privacy@navaratech.in" — generic, no name, no SLA. M6 replaces with env-sourced GO via `getGrievanceOfficer()`.                                                                                                                                                       |
| Children flow                 | [`supabase/schema.prisma`](../../supabase/schema.prisma) (Dependent model)                       | Stores `dateOfBirth`. No age-gated parental-consent checkbox at creation. M4 adds.                                                                                                                                                                                     |
| Cookie/analytics              | [`src/app/(marketing)/privacy/page.tsx`](<../../src/app/(marketing)/privacy/page.tsx>)           | Claims "strictly necessary cookies only". Sentry contradicts this. M2 reconciles.                                                                                                                                                                                      |
| Data residency disclosure     | [`src/app/(marketing)/privacy/page.tsx`](<../../src/app/(marketing)/privacy/page.tsx>)           | Production DB confirmed on Supabase **Mumbai (ap-south-1)** — `rwa-connect-prod` (id `bdlwudfzjyeoahvsbfsw`). **No cross-border transfer**, so §16 disclosure is just "hosted in India". M1 notice + M6 policy mention this for transparency, not as a §16 disclosure. |
| Re-consent on policy change   | [`src/app/(marketing)/privacy/page.tsx`](<../../src/app/(marketing)/privacy/page.tsx>)           | "Continued use constitutes acceptance" — DPDP-incompatible (§6 requires informed consent). M6 removes the clause; Phase 2 F2 builds the modal.                                                                                                                         |
| Vendor DPAs                   | —                                                                                                | None on file. M3 (operational) — must download from vendors and seed `ProcessorContract` registry day-0.                                                                                                                                                               |

---

## 12. References

- [`dpdp-full.md`](./dpdp-full.md) — the Phase 2 plan, with pre-questions
- DPDP Act 2023 (Bare Act PDF on file)
- MeitY DPDP page: https://www.meity.gov.in/digital-personal-data-protection-act-2023
- DPIIT startup recognition: https://www.startupindia.gov.in/
- MCA Pvt Ltd incorporation: https://www.mca.gov.in/
- Income Tax Act §139A (financial record retention — 7 years)
- Companies Act 2013 §128 (books of account retention)
- IT Act 2000 §43A (predecessor framework)
