---
name: Counsellor role groups progress
description: Progress tracker for execution_plan/plans/counsellor-role.md — 8 groups total, tracks which are shipped and schema-level decisions made along the way
type: project
---

# Counsellor role — groups progress

Plan file: `execution_plan/plans/counsellor-role.md` — 8 groups total.
Branch: `feature/counsellor-role`.

## Status

- **Group 1 — Schema & Core Models**: ✅ Shipped 2026-04-14. Commits: `fed575d` (code) + `831f1a8` (migration SQL record). Migration applied via session-mode pooler (port 5432 on `aws-1-ap-south-1.pooler.supabase.com`) — direct URL is IPv6-only and unreachable from this network.
- **Group 2 — SA Counsellor Management (API + UI)**: ✅ Shipped 2026-04-14. Commit: `68eaaa7`. Endpoints under `src/app/api/v1/super-admin/counsellors/` (list/create/detail/patch/delete/resend-invite) + `src/app/api/v1/admin/counsellor/route.ts`. Pages: `/sa/counsellors`, `/sa/counsellors/new`, `/sa/counsellors/[id]`. Components: `CounsellorCreateForm`, `CounsellorRow`, `CounsellorProfileCard`.
- **Group 3 — Society Assignment**: ✅ Shipped 2026-04-14. Commit: `6a8386b`. Endpoints: `[id]/assignments`, `[id]/assignments/[societyId]`, `[id]/transfer-portfolio`, `[id]/available-societies`. Pages: `/sa/counsellors/[id]/assign`, `/sa/counsellors/[id]/transfer`. RWA Admin read-only `YourCounsellorCard` component.
- **Group 4 — Counsellor Login, MFA, Onboarding**: ✅ Shipped 2026-04-14. Commit: `05e070a`. Pages: `/counsellor/login`, `/counsellor/set-password`, `/counsellor/(authed)/onboarding`, `/counsellor/(authed)/profile`, `/counsellor/(authed)/settings`, plus `(authed)/layout.tsx` guard. Endpoint: `/api/v1/counsellor/me`.
- **Group 5 — Counsellor Read-Only Portfolio Views**: ✅ Shipped (commit `99a5608`).
- **Group 6 — Escalation Mechanisms**: ✅ Shipped (commit `5cfc929`).
- **Group 7 — Counsellor Ticket Handling**: ✅ Shipped (commits `b29412e` + `b0a7f07` for 7B).
- **Group 8 — Analytics, Audit, Feature Flag**: ✅ Shipped 2026-04-15. Commit: `9c10136`. Verified 2026-04-15 via `/verify-group 8`: 100% per-file coverage on all 17 Phase 8 source files, 1063 tests passing, lint clean, `tsc --noEmit` clean (required `prisma generate` first — `CounsellorAuditLog` model needs regeneration after pulling). Analytics at `/counsellor/analytics` + `PortfolioAnalyticsView`; SA audit tab via `CounsellorAuditPanel`; `isCounsellorRoleEnabled()` gates `requireCounsellor()` via `platform_configs.counsellor_role_enabled`; `logCounsellorAudit()` called from acknowledge/defer/resolve/messages/analytics routes.

### Phase 8 known gaps (not blocking commit, flagged for follow-up)

1. Feature flag not page-gated: `src/app/counsellor/(authed)/layout.tsx`, `src/app/sa/layout.tsx` nav, and resident/admin ticket pages (`EscalationActions`, `EscalationVoteWidget` render unconditionally). Plan §10 says "/counsellor/\* returns 404" + "hidden from SA nav" + "Resident/Admin UIs don't render escalation buttons" when flag is off. API is correctly gated via `requireCounsellor()`, but UI surfaces aren't.
2. `logCounsellorAudit` is only called from 5 action routes (acknowledge, defer, resolve, messages, analytics view). Plan §11 says "every counsellor action (view, message, escalation ack / resolve / defer)" — VIEW-action audit writes (dashboard, society, resident, ticket detail GETs) are defined in `CounsellorAuditAction` type but never wired. Low-risk since escalation writes are the legally-material actions, but a strict reading of the plan requires all views logged too.

## Schema decisions made in Group 1

**Blocker resolution applied:** `ResidentTicketMessage.authorId` was changed from required to **nullable** to allow counsellor-authored messages (Counsellor is a separate model from User, so no valid authorId exists for counsellor messages). Plus `kind` (`CounsellorMessageKind?`) and `counsellorId` (FK→Counsellor, nullable) columns added. Existing resident/admin messages are unaffected (they still have authorId populated, kind=null).

**Deferred to later groups (do NOT add early):**

- `CounsellorAuditLog` model → Group 8 per §13
- `PlatformConfig.counsellorRoleEnabled` + `maxSocietiesPerCounsellor` → Group 8 (feature flag group)
- Dev seed helper in `supabase/seed.ts` → pending user approval (CLAUDE.md rule 13 blocks silent seed additions)

## Key files shipped so far

Group 1:

- `supabase/schema.prisma` — 4 new models + 3 enums + additive columns
- `supabase/migrations/20260414000001_counsellor_role_schema.sql`
- `src/lib/auth-guard.ts` — `requireCounsellor()`
- `src/lib/validations/counsellor.ts`, `src/lib/validations/escalation.ts`
- `src/types/counsellor.ts`, `src/types/escalation.ts`
- `tests/__mocks__/prisma.ts` — 4 new model mocks (counsellor, counsellorSocietyAssignment, residentTicketEscalation, residentTicketEscalationVote)

Group 2:

- `src/app/api/v1/super-admin/counsellors/route.ts` + `[id]/route.ts` + `[id]/resend-invite/route.ts`
- `src/app/api/v1/admin/counsellor/route.ts`
- `src/app/sa/counsellors/page.tsx`, `new/page.tsx`, `[id]/page.tsx`
- `src/components/features/sa-counsellors/{CounsellorCreateForm,CounsellorRow,CounsellorProfileCard}.tsx`
- `src/lib/email-templates/counsellor-invite.ts`
- `src/services/counsellors.ts`

Group 3:

- `src/app/api/v1/super-admin/counsellors/[id]/{assignments,assignments/[societyId],transfer-portfolio,available-societies}/route.ts`
- `src/app/sa/counsellors/[id]/{assign,transfer}/page.tsx`
- `src/components/features/sa-counsellors/YourCounsellorCard.tsx`

Group 4:

- `src/app/counsellor/login/page.tsx`, `set-password/page.tsx`
- `src/app/counsellor/(authed)/{layout,onboarding/page,profile/page,settings/page}.tsx`
- `src/app/api/v1/counsellor/me/route.ts`
- `src/services/counsellor-self.ts`

## Open questions from §16 (affect Group 5 onward)

1. Naming: "Counsellor" vs "Great Admin" in UI — recommend "Counsellor" externally
2. Vote threshold visibility: SA-only vs RWA-Admin-editable — recommend SA-only
3. Counsellor closing ticket unilaterally — recommend no
4. Portfolio cap — recommend soft 1000 / hard 2000
5. National ID collection — recommend optional
6. Release order — recommend 1–5 behind flag, then pilot, then 6–8
