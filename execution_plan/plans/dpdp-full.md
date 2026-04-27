# DPDP Full Compliance — Phase 2 (After MVP, Before Scale)

**Owner:** product/eng (Hemant)
**Created:** 2026-04-27
**Status:** ⛔ DO NOT START until pre-questions in § 1 are all answered
**Sister doc:** [`dpdp-mvp.md`](./dpdp-mvp.md) — the must-have plan that ships before the first paying society
**Authoritative source:** Bare Act PDF, DPDP Act 2023 (Act No. 22 of 2023, assented 11-Aug-2023)

---

## 0. What this doc is and isn't

**This doc covers everything in the DPDP Act 2023 that the [MVP doc](./dpdp-mvp.md) deliberately defers** — versioned policies, multi-language, full self-serve data export, retention auto-purge, breach automation, re-consent flows, nominee UI, SDF readiness, Consent Manager support, audit-grade tooling.

**This is the "audit-defensible across any scrutiny" plan.** MVP gets us to "we can defend ourselves if a single resident complains in month 1". Phase 2 gets us to "we can withstand a Board inquiry triggered by a thousand-resident incident".

**Trigger to start Phase 2 work** (whichever comes first):

- We cross **5,000 residents** in production
- We sign our **5th paying society**
- We receive our **first grievance ticket** (real one, not a test)
- DPDP **Rules are notified** by MeitY
- We get **DPIIT recognition** as a startup
- We **incorporate as Pvt Ltd**
- A vendor or counsel raises a **specific concern** about MVP gaps

Until any of those triggers fire, **don't start Phase 2 work** — opportunity cost is too high vs. product features that grow the business.

---

## 1. Pre-questions — MUST be answered in writing before any Phase 2 code starts

These are not engineering questions. They are business/legal/strategy questions whose answers materially change what Phase 2 looks like. Answering them after starting causes wasted work.

### Group A: Entity & exemption

| ID  | Question                                                                                                                                                                       | Why it matters                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q-1 | **Is Navara Tech now incorporated as Pvt Ltd or LLP?**                                                                                                                         | Sole prop = unlimited personal liability + ineligible for DPIIT. If still sole prop, escalate to Hemant before anything else — no Phase 2 work justifies leaving sole prop in place at scale.                                                    |
| Q-2 | **Is Navara Tech DPIIT-recognised?**                                                                                                                                           | Required (probably) to claim §17(3) startup exemption.                                                                                                                                                                                           |
| Q-3 | **Has MeitY notified the §17(3) exemption for startups or small Data Fiduciaries?** Check meity.gov.in/notifications and ask counsel.                                          | If yes AND we qualify, we can drop §5 (notice formalism), §8(3) (accuracy when shared), §8(7) (auto-erase on withdrawal), §10 (SDF), §11 (full data export) from this plan. **Roughly 40% scope reduction.**                                     |
| Q-4 | **Have DPDP Rules been notified?** Check periodically.                                                                                                                         | The Act defers many specifics ("as may be prescribed") to Rules: breach notification format, grievance SLA, parental-consent verification, no-approach period under §8(8), consent manager registration. Rules answers replace our placeholders. |
| Q-5 | **Has Navara Tech been notified as a Significant Data Fiduciary?** Or are we close to the volume threshold (Govt's threshold is unpublished but likely >100K Data Principals)? | If yes, Group F-Phase2 (SDF obligations) becomes mandatory — DPO + independent auditor + DPIA + periodic audit. This is months of work.                                                                                                          |

### Group B: Scale & posture

| ID   | Question                                                                                    | Why it matters                                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-6  | **What is our current resident count?** Order of magnitude: <5K / 5K–50K / 50K–500K / 500K+ | Drives retention period choices, audit infrastructure, breach blast-radius modelling.                                                                             |
| Q-7  | **Are we still single-region (India only) or expanding to UAE/Singapore/elsewhere?**        | Expansion brings other privacy regimes (UAE PDPL, Singapore PDPA, GDPR if EU residents). Phase 2 only covers India; expansion needs its own plan.                 |
| Q-8  | **Have we engaged outside counsel on DPDP yet?**                                            | Answers to many sub-questions below need legal review. Without counsel, we self-certify (acceptable at <50K residents, risky beyond).                             |
| Q-9  | **Do we have a CISO or designated security lead?**                                          | §8(5) "reasonable security safeguards" — what's reasonable depends on org size. SDF requires a DPO; non-SDF needs at least one named security accountable person. |
| Q-10 | **Has Sentry / any analytics provider been added since MVP?**                               | If yes, Phase 2 must integrate them with the no-tracking-of-minors shim and PII scrubber.                                                                         |

### Group C: Product & UX

| ID   | Question                                                                                                                                                                                                      | Why it matters                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Q-11 | **Which 8th-Schedule languages do our societies primarily use?** Marathi? Bengali? Tamil? Kannada?                                                                                                            | Drives translation work. English + Hindi covers most metro RWAs but not regional.                                                |
| Q-12 | **Do residents typically have smartphones with self-serve capability, or do many rely on the admin to operate the app?**                                                                                      | Determines whether self-serve export/erase is genuinely needed or whether admin-mediated flows suffice.                          |
| Q-13 | **Does any new product feature (since MVP) introduce a new lawful basis question?** Examples: AI summarisation of complaints, bulk export to BI tools, sharing data with society's appointed security agency. | Each such flow needs explicit lawful-basis classification (§6 vs §7).                                                            |
| Q-14 | **Have we collected consent for any _new_ purpose since MVP?** Marketing emails to existing residents about new features count as a new purpose.                                                              | Needs its own granular consent record.                                                                                           |
| Q-15 | **Is there a contractual obligation to any society or vendor that would survive a resident's erasure request?** E.g., the RWA's audit trail of payment receipts.                                              | Already handled via §8(7) "retention necessary for compliance with any law" carve-out, but make sure the policy text is correct. |

### Group D: Operational maturity

| ID   | Question                                                                                                   | Why it matters                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Q-16 | **Is there a person dedicated to monitoring the GO inbox (not just Hemant on top of everything else)?**    | At >5K residents, expect 1–10 grievances/month. Without dedicated handling, SLA breaches become routine. |
| Q-17 | **Do we have an incident-response runbook tested at least once via a tabletop exercise?**                  | Phase 2 Group H assumes this exists; if not, Group H is a from-scratch build.                            |
| Q-18 | **Are vendor DPAs being renewed annually with a tracking process, or are they fire-and-forget after MVP?** | DPAs typically have renewal clauses; Phase 2 adds expiry tracking.                                       |

**Decision rule:** if any Group A question is unanswered, **stop and answer it first**. The Group A answers can collapse or expand the entire Phase 2 scope.

---

## 2. The full DPDP obligation map (everything not in MVP)

Items already shipped in MVP have a ✅ link to MVP. Items in this Phase 2 doc start with their group letter.

### Already in MVP (linked for context)

- ✅ Persisted consent at signup ([MVP M1](./dpdp-mvp.md))
- ✅ §5(1) notice rendered (English) ([MVP M1](./dpdp-mvp.md))
- ✅ Named GO + grievance form ([MVP M5](./dpdp-mvp.md))
- ✅ Vendor DPAs registry ([MVP M3](./dpdp-mvp.md))
- ✅ PII out of logs + Sentry hygiene ([MVP M2](./dpdp-mvp.md))
- ✅ Children's parental consent on Dependent ([MVP M4](./dpdp-mvp.md))
- ✅ Withdraw WhatsApp consent ([MVP M5](./dpdp-mvp.md))
- ✅ PII access audit on admin endpoints ([MVP M5](./dpdp-mvp.md))
- ✅ Erasure REQUEST channel (manual fulfillment) ([MVP M5](./dpdp-mvp.md))
- ✅ Soft-delete only, no hard-delete code paths ([MVP M7](./dpdp-mvp.md))
- ✅ Privacy page rewrite with §15 duties + India-residency disclosure + TDSAT mention ([MVP M6](./dpdp-mvp.md))
- ✅ `User.lastApproachedAt` touched on every authed request ([MVP M5](./dpdp-mvp.md))

### Phase 2 implementation groups

- **F1** — Versioned policies in code + sha verification + multi-language toggle
- **F2** — Re-consent modal on policy version change
- **F3** — Self-serve data export (§11) with "shared-with" ledger (§11(1)(b))
- **F4** — Self-serve account deletion + 7-day cancellation window + retention cron consumes it
- **F5** — Right to nominate (§14) UI + flow
- **F6** — Retention auto-purge cron (§8(7) + §8(8))
- **F7** — Breach notification automation (§8(6)) + DPB filing flow + email-to-affected-DPs flow
- **F8** — `<DutiesDisclosure />` component + lint rule for `console.*` in API + custom lint rule for waiver-style consent text
- **F9** — Hindi translation of all policies + consent notice (and structure for adding more 8th-Schedule languages)
- **F10** — Identity verification (email OTP) before any rights request is honoured
- **F11** — SDF readiness package (DPO appointment, independent data auditor selection, DPIA process, periodic audit cadence)
- **F12** — Consent Manager integration (when/if any are notified by the Board)
- **F13** — Sub-processor disclosure on the privacy page
- **F14** — Vendor DPA expiry tracking + renewal cron
- **F15** — Quarterly compliance retrospective (process, not code)

---

## 3. Schema deltas beyond MVP

```prisma
// ConsentRecord — additions to MVP version:
artefactSha     String          @map("artefact_sha")        // sha256 of rendered text at consent time
language        String          @default("en")              // "en" | "hi" | other 8th Schedule code
// Add REAFFIRMED to ConsentAction enum
enum ConsentAction { GIVEN WITHDRAWN REAFFIRMED }
// Add MARKETING_EMAIL, CONSENT_NOTICE to ConsentArtefact enum
enum ConsentArtefact { TNC PRIVACY CONSENT_NOTICE WHATSAPP PARENTAL MARKETING_EMAIL }

// User — additions:
nomineeName             String?    @map("nominee_name")            // §14
nomineeContact          String?    @map("nominee_contact")
nomineeRelationship     String?    @map("nominee_relationship")
deleteScheduledAt       DateTime?  @map("delete_scheduled_at")     // when hard-delete cron will fire
preferredLanguage       String     @default("en") @map("preferred_language")

// New table — BreachIncident (full):
model BreachIncident {
  id                       String          @id @default(uuid())
  detectedAt               DateTime        @map("detected_at")
  reportedByUserId         String          @map("reported_by_user_id")
  category                 BreachCategory                              // UNAUTHORISED_ACCESS | DATA_LOSS | DATA_LEAK | RANSOMWARE | INSIDER | OTHER
  severity                 BreachSeverity                              // LOW | MEDIUM | HIGH | CRITICAL
  affectedUserCount        Int             @map("affected_user_count")
  affectedDataTypes        String[]        @map("affected_data_types")
  rootCauseSummary         String          @db.Text
  containmentActions       String          @db.Text @map("containment_actions")
  dpbNotifiedAt            DateTime?       @map("dpb_notified_at")
  dataPrincipalsNotifiedAt DateTime?       @map("data_principals_notified_at")
  closedAt                 DateTime?       @map("closed_at")
  postMortemUrl            String?         @map("post_mortem_url")

  @@map("breach_incidents")
}

enum BreachCategory { UNAUTHORISED_ACCESS DATA_LOSS DATA_LEAK RANSOMWARE INSIDER OTHER }
enum BreachSeverity { LOW MEDIUM HIGH CRITICAL }

// ErasureRequest — additions to MVP version:
scheduledHardDeleteAt    DateTime?       @map("scheduled_hard_delete_at")
hardDeletedAt            DateTime?       @map("hard_deleted_at")
cancelledByUserId        String?         @map("cancelled_by_user_id")
cancelReason             String?         @db.Text
// Add HARD_DELETED, LEGAL_HOLD to ErasureStatus enum
enum ErasureStatus { PENDING SOFT_DELETED HARD_DELETED CANCELLED LEGAL_HOLD }

// GrievanceTicket — additions:
ackAt       DateTime?       @map("ack_at")
// Add ACK and ESCALATED to GrievanceStatus
enum GrievanceStatus { OPEN ACK RESOLVED ESCALATED }
// Add NOMINATION, CONSENT_WITHDRAWAL, BREACH to category
enum GrievanceCategory { ACCESS CORRECTION ERASURE NOMINATION CONSENT_WITHDRAWAL BREACH OTHER }

// ProcessorContract — additions:
contractExpiresAt   DateTime? @map("contract_expires_at")
dataCategories      String[]  @map("data_categories")
subProcessorsListed Boolean   @default(false) @map("sub_processors_listed")
```

---

## 4. Implementation groups (F1 through F15)

### F1 — Versioned policies in code with sha verification + multi-language toggle

**Goal:** Make policy changes auditable and prevent silent drift between checked-in text and rendered text.

**Files to create:**

- `src/lib/policy/versions.ts` — exports `POLICY_VERSIONS` with one entry per artefact: `{ version, effectiveDate, sha, source: (lang) => string }`. `sha` checked at module load; mismatch throws.
- `src/lib/policy/legal-text/{tnc,privacy,consent-notice,parental,whatsapp,marketing}/{en,hi}.ts` — actual text per artefact per language.
- `src/lib/policy/checks.ts` — `assertNoInvalidConsentClauses(text)` runs at build time over every legal-text source; rejects clauses purporting to waive a Data Principal right per §6(2).
- `src/components/features/legal/LanguageToggle.tsx` — chip above ConsentNotice; switches en↔hi.

**Files to modify:**

- `src/lib/consent/record.ts` — accept `language` parameter; persist `artefactSha` + `language` on `ConsentRecord`.
- `src/components/features/legal/ConsentNotice.tsx` — render from `POLICY_VERSIONS.consentNotice.source(lang)`.
- `src/app/(marketing)/privacy/page.tsx` — render version + effectiveDate from `POLICY_VERSIONS.privacy`.
- `src/app/(marketing)/terms/page.tsx` — same.

**Tests:**

- `tests/lib/policy/versions.test.ts` — sha mismatch throws.
- `tests/lib/policy/checks.test.ts` — invalid waiver clauses caught.
- `tests/components/features/legal/LanguageToggle.test.tsx` — toggle persists choice + reloads notice.

### F2 — Re-consent modal on policy version change

**Goal:** §6(1) "informed" consent — informed by current text. When we bump policy version, existing users must re-consent before continuing.

**Files to create:**

- `src/lib/consent/state.ts` — `getActiveConsents(userId)` returns latest per-artefact action + version.
- `src/components/features/legal/ReConsentModal.tsx` — client component shown if any active consent is at a stale version. Blocks UI until accept.
- `src/hooks/useConsentGate.ts` — used by `(authed)` layouts to call `/api/v1/me/consent` and render modal if needed.
- `src/app/api/v1/me/consent/route.ts` — `POST` reaffirmation; `GET` active consent state.

**Files to modify:**

- `src/app/admin/layout.tsx` / `src/app/r/layout.tsx` / `src/app/sa/layout.tsx` / `src/app/counsellor/layout.tsx` — wrap children with `useConsentGate()`.

**Tests:**

- `tests/components/features/legal/ReConsentModal.test.tsx` — renders when stale, hides when current.
- `tests/integration/dpdp/reconsent.test.tsx` — bump version → existing user logs in → modal → accept → next login no modal.

### F3 — Self-serve data export (§11) with "shared-with" ledger (§11(1)(b))

**Goal:** §11(1)(a) summary of personal data + processing activities; §11(1)(b) identities of all OTHER Fiduciaries/Processors with whom data has been shared.

**Files to create:**

- `src/lib/dpdp/export.ts` — `buildUserDataExport(userId)` returns:
  - `dataAboutYou` — every PII table the user appears in
  - `dataSharedWith` — sourced from `auditLog` (PII shares) + `ProcessorContract` registry (operational sharing)
- `src/app/api/v1/me/export/route.ts` — `POST` triggers async job (after email-OTP via F10); `GET` polls; on ready returns signed URL to JSON file in storage.
- `src/lib/email-templates/dpdp-export-ready.ts` — notification.
- `src/app/r/settings/privacy/page.tsx` (extend MVP M5) — add "Export My Data" button.

**Tests:**

- `tests/lib/dpdp/export.test.ts` — every PII table read; `dataSharedWith` populated; signed URLs included.
- `tests/api/v1/me/export/route.test.ts` — full async flow.

### F4 — Self-serve account deletion + cancellation + soft→hard transition

**Goal:** Eliminate the manual GO step from MVP M5. Resident clicks → confirmation email with 7-day cancel link → soft delete → 90 days later, hard delete by F6 cron.

**Files to create:**

- `src/lib/dpdp/erase.ts` — `requestErasure`, `softDeleteUser`, `hardDeleteUser`. Soft delete anonymises display fields + deletes attachments from storage.
- `src/lib/dpdp/erase-policy.ts` — declares per-table what erasure does (delete vs anonymise vs retain per §8(7) law-required).
- `src/app/api/v1/me/erase/cancel/route.ts` — POST with cancellation token.
- `src/app/r/settings/privacy/erase-confirm/[token]/page.tsx` — landing for cancellation links.
- `src/lib/email-templates/dpdp-erasure-confirmation.ts` — 7-day cancel window email.

**Files to modify:**

- `src/app/api/v1/me/erase/route.ts` (from MVP M5) — replace email-to-GO with automated soft-delete pipeline + cancellation token email.

**Tests:**

- `tests/lib/dpdp/erase.test.ts` — soft delete anonymises; FK preserved; financial records retained.
- `tests/integration/dpdp/erase-end-to-end.test.ts` — request → cancel via token; re-request → fast-forward cron → hard delete; login attempt = "deleted account".

### F5 — Right to nominate (§14)

**Files to create:**

- `src/app/r/settings/privacy/nominee/page.tsx` — form: name, contact, relationship.
- `src/app/api/v1/me/nominee/route.ts` — `GET` / `PUT`.

**Files to modify:**

- `src/app/r/profile/page.tsx` — surface nominee summary chip with link.
- `src/app/admin/profile/page.tsx` — same.

**Tests:**

- `tests/api/v1/me/nominee/route.test.ts` — set / get / clear.

### F6 — Retention auto-purge cron (§8(7) + §8(8))

**Goal:** Automate what MVP does manually quarterly.

**Retention matrix** (defaults — confirm with counsel):

| Data type                                                       | Retention floor          | Cron action                                                   |
| --------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------- |
| Financial records (fee payments, invoices)                      | 7 years from payment     | No deletion (Income Tax Act §139A)                            |
| Audit log writes                                                | 7 years                  | Anonymise actor display fields                                |
| Audit log PII reads                                             | 3 years                  | Hard delete                                                   |
| Soft-deleted user records                                       | 90 days from soft delete | Hard delete                                                   |
| ID/ownership proofs                                             | 90 days from soft delete | Storage delete                                                |
| Inactive accounts (no `lastApproachedAt` for prescribed period) | 🟡 placeholder 3 years   | Email warning at 2y11m → soft delete at 3y → hard delete +90d |
| Lead form submissions (no account)                              | 365 days                 | Hard delete                                                   |
| Login session records                                           | 90 days                  | Truncate                                                      |
| Email verification + password reset tokens                      | 7 days                   | Delete                                                        |
| Closed support tickets                                          | 5 years                  | Anonymise resident PII in messages                            |
| Consent records                                                 | Indefinite               | Never delete (required by §6(10))                             |
| Breach incidents                                                | 7 years                  | Retain                                                        |
| Grievance tickets                                               | 5 years                  | Anonymise                                                     |
| Erasure requests                                                | 7 years                  | Retain status; anonymise content                              |

**Files to create:**

- `src/app/api/cron/dpdp-retention/route.ts` — daily cron.
- `src/lib/dpdp/retention.ts` — purge functions (`purgeExpiredLeads`, `purgeExpiredTokens`, `purgeSoftDeletedUsers`, `purgeInactiveAccounts`, etc.). Each returns count for cron summary log.

**Files to modify:**

- `vercel.json` — schedule `dpdp-retention` daily 02:30 IST.

**Tests:**

- `tests/lib/dpdp/retention.test.ts` — each purge function.
- `tests/api/cron/dpdp-retention/route.test.ts` — orchestration.

### F7 — Breach notification automation (§8(6))

**Goal:** §8(6) requires intimation to Board AND each affected Data Principal in form/manner per Rules. 🟡 awaits Rules — until then, our format is best-effort.

**Files to create:**

- `docs/runbooks/breach-response.md` — incident-response playbook: detection sources, severity rubric, containment, evidence preservation, comms templates, DPB notification (placeholder format), 72h placeholder timeline.
- `src/app/sa/dpdp/breaches/page.tsx` — SA-only file-a-breach UI.
- `src/app/api/v1/super-admin/breaches/route.ts` — `POST` create, `GET` list.
- `src/app/api/v1/super-admin/breaches/[id]/notify-principals/route.ts` — sends notification email to all affected users (batched).
- `src/lib/email-templates/dpdp-breach-notification.ts` — plain-language: what data, what we're doing, what user should do, GO contact.

**Tests:**

- `tests/app/sa/dpdp/breaches/page.test.tsx` — form renders, validates, submits.
- `tests/api/v1/super-admin/breaches/route.test.ts` — POST/GET, RBAC.

### F8 — Lint rules + duties component

**Goal:** Make compliance impossible to forget.

**Files to create:**

- `src/components/features/legal/DutiesDisclosure.tsx` — context-aware duties surface (see [MVP M6](./dpdp-mvp.md) for inline copy version; this generalises it).
- `src/lib/policy/legal-text/duties/{en,hi}.ts` — verbatim §15 + plain-language explanation.
- `eslint-rules/no-console-in-api.js` — custom ESLint rule blocking `console.*` in `src/app/api/**`.
- `eslint-rules/no-waiver-clauses.js` — checks for waiver-style language in `policy/legal-text/`.

**Files to modify:**

- `eslint.config.mjs` — register custom rules.
- `src/app/(auth)/register-society/page.tsx`, `src/app/(marketing)/grievance/page.tsx`, `src/app/r/settings/privacy/page.tsx`, `src/app/(marketing)/privacy/page.tsx` — replace inline duties copy with `<DutiesDisclosure context="..." />`.

**Tests:**

- `tests/components/features/legal/DutiesDisclosure.test.tsx` — context variants render correct subsets.
- `tests/eslint-rules/no-console-in-api.test.js` — rule fires correctly.

### F9 — Hindi translation + i18n structure

**Goal:** §5(3) — option to access notice in any 8th-Schedule language. English + Hindi at v1; structure supports additions.

**Files to modify:**

- `src/lib/policy/legal-text/{tnc,privacy,consent-notice,parental,whatsapp,marketing,duties}/hi.ts` — Hindi translations of all artefacts. Reviewed by counsel.
- `src/components/features/legal/LanguageToggle.tsx` — confirmed to switch en↔hi.

**Tests:**

- `tests/lib/policy/versions.test.ts` — Hindi sha verified.

### F10 — Identity verification before honouring rights requests

**Goal:** §15(b) on the user's side (no impersonation) implies Fiduciary must verify identity before fulfilling §11/§12/§14 requests.

**Files to create:**

- `src/lib/dpdp/identity-verify.ts` — generates email OTP, stores hashed in temp table, verifies.
- `src/lib/email-templates/dpdp-identity-otp.ts`.

**Files to modify:**

- `src/app/api/v1/me/export/route.ts` (F3) — gate behind identity verification.
- `src/app/api/v1/me/erase/route.ts` (F4) — same.
- `src/app/api/v1/me/nominee/route.ts` (F5) — gate setting nominee but not reading.

### F11 — SDF readiness (only triggers if Q-5 = yes)

**Goal:** §10(2) — DPO India-based + accountable to Board of Directors; independent data auditor; periodic DPIA + audit.

**Files to create:**

- `docs/dpdp/sdf-readiness.md` — already in MVP §0; expand with detailed plan.
- `docs/dpdp/dpia-template.md` — DPIA template.
- `docs/dpdp/audit-cadence.md` — audit cadence + auditor selection criteria.

**Operational:**

- Appoint India-based DPO (cannot be Hemant if he is also a director — must be a separate accountable individual).
- Engage an independent data auditor.
- Conduct first DPIA within 90 days of SDF notification.

### F12 — Consent Manager integration (only triggers if Board notifies any)

**Files to create:**

- `src/lib/consent-manager/client.ts` — protocol stub (Board will publish API spec).
- `src/app/api/v1/consent-manager/webhook/route.ts` — inbound webhook for consent grant/withdrawal events.

**Schema:**

- `ConsentRecord.consentManagerId` — already provisioned in MVP schema design.

### F13 — Sub-processor disclosure on privacy page

**Goal:** Phase 2-Q15 — be transparent about who else touches the data.

**Files to modify:**

- `src/app/(marketing)/privacy/page.tsx` — add a "Who else processes your data" section listing each `ProcessorContract` row's processor name + jurisdiction + data categories.
- `ProcessorContract` schema — fill `dataCategories` and `subProcessorsListed` for each row.

### F14 — Vendor DPA expiry tracking + renewal cron

**Files to create:**

- `src/app/api/cron/dpa-expiry-check/route.ts` — daily; emails Hemant 60 days before any active DPA's `contractExpiresAt`.

**Files to modify:**

- `src/app/sa/dpdp/processors/page.tsx` (MVP M3) — show expiry warning chip.

### F15 — Quarterly compliance retrospective (process, not code)

Run a 1-hour quarterly review:

- Were any grievance SLAs breached? Why?
- Were any consent rows missed (any signup with zero `ConsentRecord` rows)?
- Are vendor DPAs all current?
- Has any new feature shipped that introduces a new lawful basis question we haven't classified?
- Has MeitY published anything new (Rules amendment, exemption notification)?
- Has our scale crossed any threshold that triggers an SDF re-evaluation?

Document outcomes in `docs/dpdp/retrospectives/<date>.md`.

---

## 5. Quality gates (Phase 2 additions)

Per-group:

- `npm run lint` passes (with new custom rules).
- `npm run check:dpdp` passes:
  - Schema PII columns tagged with `@dpdp.purpose`
  - Policy files match checked-in shasum
  - `console.*` count in `src/app/api/` is zero
  - Every PII-touching endpoint calls `auditPiiAccess()`
  - Every consent flow calls `recordConsent()`
- `npm run test` passes incl. all `@dpdp` tests at 95% per-file coverage.

Cross-group:

- After F1–F8 merge, run a full migration on a clone of prod, then a full export-then-erase cycle on a test user.

---

## 6. Migration & rollout sequencing (Phase 2)

1. **Day 0** — F1 (versioning) ships. Existing data unaffected; new signups capture sha + language. Re-consent modal disabled by feature flag.
2. **Days 0–7** — F2–F6 merge in order. F4 and F6 together replace MVP's manual erase + manual purge.
3. **Day 7** — Send "policy update" email to all existing users 7 days before flag flip.
4. **Day 14** — Flip re-consent modal flag ON. Existing users blocked on next login until they accept.
5. **Day 14** — Reveal Privacy Settings extensions (export, nominee, withdraw any consent).
6. **Day 14** — F7 grievance + breach UI live for SA.
7. **Day 21** — First `dpdp-retention` cron run; review.
8. **Day 30** — F8 lint rules enforced for all new code.
9. **Day 30+** — F9 Hindi translations land; toggle wired.
10. **Per Q-5 trigger** — F11 SDF work begins (separate sub-plan).

---

## 7. Launch checklist (block Phase 2 deploy)

Builds on MVP checklist. Items unique to Phase 2:

| #   | Item                                                                    | Owner            |
| --- | ----------------------------------------------------------------------- | ---------------- |
| 1   | All Phase 2 pre-questions (§ 1) answered in writing                     | Hemant           |
| 2   | If Q-1 was "still sole prop" — ESCALATE before any Phase 2 code         | Hemant           |
| 3   | If Q-3 was "exempt" — drop F1-portion / F3 / F6-portion / F11           | Hemant + Eng     |
| 4   | Hindi translations of all consent artefacts reviewed by counsel         | Hemant + counsel |
| 5   | F1–F8 deployed; full export-then-erase round-trip tested on a test user | Eng              |
| 6   | Re-consent emails sent 7 days before flag flip                          | Hemant           |
| 7   | Breach runbook walkthrough done with on-call                            | Eng + Hemant     |
| 8   | Vendor DPA expiry check tested (force a near-expiry row, confirm email) | Eng              |
| 9   | Sub-processor list on privacy page reviewed for accuracy                | Hemant           |
| 10  | Quarterly retrospective calendar entry created                          | Hemant           |

---

## 8. Comprehensive obligation map — every Act section we touch

This is the complete cross-reference. MVP-shipped items have ✅; Phase 2 items have F-group references; deferred-permanently items have a note.

| #   | Section    | Obligation (plain words)                                                                                                  | Status                                                                                                                              |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | §4         | Process personal data only for a _lawful purpose_ under either §6 consent or §7 certain legitimate uses                   | ✅ MVP M1 (consent) + classified per-flow in MVP § 2.2                                                                              |
| 2   | §5(1)      | Notice at/before consent containing (i) data + purpose, (ii) §6(4)/§13 mechanisms, (iii) Board complaint route            | ✅ MVP M1 `<ConsentNotice />`                                                                                                       |
| 3   | §5(2)      | For pre-Act consents, send notice "as soon as reasonably practicable"; may continue processing until withdrawal           | Not directly applicable — RWA Connect didn't process resident PII before the Act                                                    |
| 4   | §5(3)      | Notice option to access in English or any 8th-Schedule language                                                           | Partial: English ✅ MVP. Hindi → F9                                                                                                 |
| 5   | §6(1)      | Consent = free, specific, informed, unconditional, unambiguous, limited to purpose                                        | ✅ MVP M1                                                                                                                           |
| 6   | §6(2)      | Invalid consent terms (e.g., waiving complaint right) are invalid                                                         | ✅ MVP M6 (copy review) → F8 (lint rule)                                                                                            |
| 7   | §6(3)      | Consent request in plain language; English/8th-Schedule option; provide GO contact                                        | ✅ MVP M1 + M6                                                                                                                      |
| 8   | §6(4)      | Right to withdraw, comparable ease                                                                                        | ✅ MVP M5 (WhatsApp toggle) → F2 (any artefact)                                                                                     |
| 9   | §6(5)      | Withdrawal does not invalidate prior processing; consequences borne by DP                                                 | ✅ MVP M5 (modal copy) → F2 (modal copy)                                                                                            |
| 10  | §6(6)      | On withdrawal, cease processing + cause Processors to cease, within reasonable time                                       | ✅ MVP M5 (WhatsApp send-path checks consent) → F2 (general)                                                                        |
| 11  | §6(7)–(9)  | Consent Manager pathway via Board-registered intermediary                                                                 | F12 (only when first Consent Manager is notified)                                                                                   |
| 12  | §6(10)     | Burden of proof on Fiduciary to prove notice + consent                                                                    | ✅ MVP M1 (`ConsentRecord`)                                                                                                         |
| 13  | §7         | Certain legitimate uses — voluntary provision, State subsidies, legal compliance, medical, epidemic, disaster, employment | ✅ MVP § 2.2 lawful-basis map                                                                                                       |
| 14  | §8(1)      | Fiduciary responsible regardless of contract or DP duty failure                                                           | Operational awareness                                                                                                               |
| 15  | §8(2)      | Engage Processors only under valid contract                                                                               | ✅ MVP M3 (`ProcessorContract`) → F14 (renewal cron)                                                                                |
| 16  | §8(3)      | Accuracy when (a) decision affects DP, (b) disclosed to another Fiduciary                                                 | ✅ Existing edit flows + MVP M3 vendor categories. Phase 2 reviews on each new feature                                              |
| 17  | §8(4)      | Implement TOMs (technical and organisational measures)                                                                    | ✅ MVP M2 (logs) + M5 (audit) + RLS existing → F8 (lint rules)                                                                      |
| 18  | §8(5)      | Reasonable security safeguards                                                                                            | ✅ Existing RLS + MVP M2. Largest penalty (₹250cr) — keep tight                                                                     |
| 19  | §8(6)      | On breach, intimate Board AND each affected DP                                                                            | Runbook only at MVP. F7 automates. 🟡 awaits Rules for form/manner                                                                  |
| 20  | §8(7)      | Erase on consent withdrawal OR purpose-served, whichever earlier; cause Processors to erase                               | ✅ MVP M5 (request channel) + M7 (soft delete only) → F4 (auto) + F6 (cron)                                                         |
| 21  | §8(8)      | "Purpose deemed no longer served" if DP doesn't approach + doesn't exercise rights for prescribed period                  | ✅ MVP M5 (`lastApproachedAt` touch) → F6 (cron consumes). 🟡 awaits Rules for the period                                           |
| 22  | §8(9)      | Publish business contact info of DPO/GO                                                                                   | ✅ MVP M6 (named GO on privacy page)                                                                                                |
| 23  | §8(10)     | Effective grievance redressal mechanism                                                                                   | ✅ MVP M5 (`/grievance` form)                                                                                                       |
| 24  | §9(1)      | Verifiable parental/guardian consent for child or PWD                                                                     | ✅ MVP M4 (checkbox + audit). 🟡 awaits Rules for "verifiable" mechanism                                                            |
| 25  | §9(2)      | No processing likely to cause detrimental effect on child                                                                 | ✅ MVP M4 implicit (we have no harmful processing). F11 expands review                                                              |
| 26  | §9(3)      | No tracking, behavioural monitoring, or targeted ads of children                                                          | ✅ Trivially satisfied (we have none). Analytics shim in F8 makes it durable                                                        |
| 27  | §10        | SDF: India-based DPO + independent auditor + DPIA + periodic audit                                                        | F11 — only triggers if MeitY notifies us as SDF                                                                                     |
| 28  | §11(1)(a)  | Right to summary of personal data + processing activities                                                                 | Manual at MVP via GO email → F3 self-serve                                                                                          |
| 29  | §11(1)(b)  | Right to identities of OTHER Fiduciaries/Processors data was shared with + description                                    | F3 ("shared-with" ledger)                                                                                                           |
| 30  | §12(1)–(2) | Right to correction/completion/updating                                                                                   | ✅ Existing profile-edit + admin-edit flows                                                                                         |
| 31  | §12(3)     | Right to erasure unless retention required by law                                                                         | ✅ MVP M5 (request channel, manual fulfilment) → F4 (self-serve)                                                                    |
| 32  | §13(1)     | Readily available means of grievance redressal                                                                            | ✅ MVP M5 (`/grievance`)                                                                                                            |
| 33  | §13(2)     | Respond within prescribed period                                                                                          | 30 days policy at MVP. 🟡 awaits Rules                                                                                              |
| 34  | §13(3)     | DP must exhaust Fiduciary's mechanism before approaching Board                                                            | ✅ MVP M6 (privacy page wording)                                                                                                    |
| 35  | §14        | Right to nominate                                                                                                         | Manual at MVP via GO email → F5 (UI)                                                                                                |
| 36  | §15        | Duties of Data Principal — penalty up to ₹10K                                                                             | ✅ MVP M5 (grievance form) + M6 (privacy page) → F8 (`<DutiesDisclosure />`)                                                        |
| 37  | §16        | Cross-border transfer — Govt may restrict to notified countries                                                           | ✅ Trivially satisfied: data is hosted in India (Supabase Mumbai, ap-south-1). MVP M1/M6 disclose India-residency for transparency. |
| 38  | §17(1)     | Exemptions for legal claims, courts, offences, foreign principals via India contract, M&A, defaulters                     | Operational — flag if encountered                                                                                                   |
| 39  | §17(2)(b)  | Research/archiving/statistical exemption if not used for DP-specific decisions                                            | Note in F-group reviews of any new analytics work                                                                                   |
| 40  | §17(3)     | Govt may exempt classes (incl. startups) from §5/§8(3)/§8(7)/§10/§11                                                      | **Phase 2 Q-3 — investigate before any F1 work**                                                                                    |
| 41  | §17(5)     | Govt may, within 5 years, exempt any provision for any class                                                              | Watch list                                                                                                                          |
| 42  | §28(12)    | Board may warn or impose costs on false/frivolous complaints                                                              | ✅ MVP M5 (grievance form fine print)                                                                                               |
| 43  | §29        | Appeals to TDSAT within 60 days; aim disposal within 6 months                                                             | ✅ MVP M6 (privacy page mention)                                                                                                    |
| 44  | §32        | Voluntary undertakings can bar proceedings                                                                                | Operational — counsel guides if used                                                                                                |
| 45  | §37        | After ≥2 monetary penalties, Govt can block public access to the Fiduciary                                                | ✅ MVP § 2.6 awareness — primary motivation for MVP rigour                                                                          |

🟡 = awaits DPDP Rules notification by MeitY.

---

## 9. Authoritative-source mapping (every plan rule → Act citation)

This appendix exists so reviewers can verify each implementation rule against the Bare Act without re-deriving it. If you change a rule, update the citation.

| Plan rule (MVP M-group or Phase 2 F-group)                                                           | Act section(s)                                                 |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Persist consent immutably with version + IP + UA (M1)                                                | §6(10) burden of proof                                         |
| Consent text limited to data necessary for purpose (M1)                                              | §6(1)                                                          |
| Consent request in plain language + GO contact in the request (M1, M6)                               | §5(3), §6(3)                                                   |
| Re-prompt on policy version change (F2)                                                              | §6(1) "informed" — informed by current text                    |
| Withdrawal as easy as giving (M5, F2)                                                                | §6(4)                                                          |
| Withdrawal does not invalidate prior processing (M5 modal copy)                                      | §6(5)                                                          |
| Cause processors to cease on withdrawal (M5 WhatsApp check, F2 general)                              | §6(6)                                                          |
| Erase on withdrawal OR purpose-served (M5 manual, F4 auto)                                           | §8(7)                                                          |
| `User.lastApproachedAt` + retention cron (M5, F6)                                                    | §8(8)                                                          |
| `ProcessorContract` registry (M3)                                                                    | §8(2)                                                          |
| Notice on personal data breach to Board AND each affected DP (F7)                                    | §8(6)                                                          |
| Anonymisation on soft delete; financial record retention floor (M7, F4, F6)                          | §8(7) "unless retention necessary for compliance with any law" |
| `auditPiiAccess()` on every PII-read endpoint (M5)                                                   | §8(4)                                                          |
| `safeLog` + console-removal in API routes (M2)                                                       | §8(4), §8(5)                                                   |
| Parental consent checkbox + Dependent.parentalConsentAt row (M4)                                     | §9(1)                                                          |
| `analytics/shim.ts` no-op for minors (F8)                                                            | §9(3)                                                          |
| Detrimental-effect review for child-touching flows (M4 implicit, F11 explicit)                       | §9(2)                                                          |
| Export endpoint includes "shared-with" ledger (F3)                                                   | §11(1)(b)                                                      |
| Identity-verified (OTP) before honouring rights requests (F10)                                       | §15(b) (no impersonation) implication on Fiduciary             |
| Erasure soft-delete + scheduled hard-delete (M5/M7 + F4/F6)                                          | §8(7), §12(3)                                                  |
| Nominee fields + Manage Nominee UI (F5)                                                              | §14                                                            |
| `/grievance` page + ticket + 30-day SLA placeholder (M5)                                             | §13(1)–(2)                                                     |
| Privacy page links to TDSAT for appeals (M6)                                                         | §29                                                            |
| Privacy page lists Board route only AFTER our internal grievance (M6)                                | §13(3)                                                         |
| `<DutiesDisclosure />` component on signup, grievance, rights-request (M5/M6 inline; F8 generalises) | §15                                                            |
| Data-residency disclosure at consent time — Mumbai region, India (M1, M6)                            | §16(1) (n/a — no cross-border)                                 |
| `BreachIncident` table + runbook + 72h placeholder (F7)                                              | §8(6) (form/manner per Rules — placeholder until prescribed)   |
| No clauses purporting to waive DP rights (M6 review, F8 lint)                                        | §6(2)                                                          |
| Hindi translation of notice (F9)                                                                     | §5(3)                                                          |
| `lastApproachedAt` debounced touch in auth middleware (M5)                                           | §8(8)                                                          |
| Voluntary undertaking awareness for ops (Operational)                                                | §32                                                            |
| Awareness of §37 service-blocking risk after 2 penalties (MVP § 2.6)                                 | §37(1)                                                         |
| SDF-readiness doc tracking §10 obligations (F11)                                                     | §10                                                            |

---

## 10. References

- [`dpdp-mvp.md`](./dpdp-mvp.md) — must-have plan (Phase 1)
- DPDP Act 2023 — Bare Act PDF on file
- Income Tax Act §139A — financial record retention
- Companies Act 2013 §128 — books of account retention
- IT Act 2000 §43A (predecessor framework)
- MeitY DPDP page: https://www.meity.gov.in/digital-personal-data-protection-act-2023
- MeitY DPDP Rules notifications (check periodically): https://www.meity.gov.in/notifications
- DPIIT startup recognition: https://www.startupindia.gov.in/
- Data Protection Board of India (when operational): TBD
