---
name: Counsellor role groups progress
description: Progress tracker for execution_plan/plans/counsellor-role.md — 8 groups total, tracks which are shipped and schema-level decisions made along the way
type: project
---

# Counsellor role — groups progress

Plan file: `execution_plan/plans/counsellor-role.md` — 8 groups total.

## Status

- **Group 1 — Schema & Core Models**: ✅ Shipped 2026-04-14. Migration applied to Supabase via session-mode pooler (port 5432 on `aws-1-ap-south-1.pooler.supabase.com`). Direct URL (`db.<ref>.supabase.co:5432`) is IPv6-only and unreachable from this network — use session-mode pooler for future DDL too. Commits: `fed575d` (code) + `831f1a8` (migration SQL record).
- Groups 2–8: not started.

## Schema decisions made in Group 1

**Blocker resolution applied:** `ResidentTicketMessage.authorId` was changed from required to **nullable** to allow counsellor-authored messages (Counsellor is a separate model from User, so no valid authorId exists for counsellor messages). Plus `kind` (`CounsellorMessageKind?`) and `counsellorId` (FK→Counsellor, nullable) columns added. Existing resident/admin messages are unaffected (they still have authorId populated, kind=null).

**Deferred to later groups (do NOT add early):**

- `CounsellorAuditLog` model → Group 8 per §13
- `PlatformConfig.counsellorRoleEnabled` + `maxSocietiesPerCounsellor` → Group 8 (feature flag group)
- Dev seed helper in `supabase/seed.ts` → pending user approval (CLAUDE.md rule 13 blocks silent seed additions)

## Key files shipped in Group 1

- `supabase/schema.prisma` — 4 new models + 3 enums + additive columns
- `src/lib/auth-guard.ts` — `requireCounsellor()` added
- `src/lib/validations/counsellor.ts` — create/update/self/assign/transfer Zod schemas
- `src/lib/validations/escalation.ts` — threshold/escalate/withdraw/message/resolve/defer Zod schemas + `isValidEscalationTransition()` state machine
- `src/types/counsellor.ts` / `src/types/escalation.ts` — interfaces + label maps
- `tests/__mocks__/prisma.ts` — 4 new model mocks: counsellor, counsellorSocietyAssignment, residentTicketEscalation, residentTicketEscalationVote

## Open questions from §16 (affect Group 2 onward)

1. Naming: "Counsellor" vs "Great Admin" in UI — recommend "Counsellor" externally
2. Vote threshold visibility: SA-only vs RWA-Admin-editable — recommend SA-only
3. Counsellor closing ticket unilaterally — recommend no
4. Portfolio cap — recommend soft 1000 / hard 2000
5. National ID collection — recommend optional
6. Release order — recommend 1–5 behind flag, then pilot, then 6–8
