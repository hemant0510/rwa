-- Migration: 20260414000001_counsellor_role_schema
-- Counsellor role — Group 1 of 8 (execution_plan/plans/counsellor-role.md).
-- Adds Counsellor entity, society assignments, ticket escalations + resident votes.
-- Additive only — no destructive changes; existing flows unaffected.

-- ═════════════════════════════════════════════════════════════════════════
-- 1. Enums
-- ═════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE "EscalationSource" AS ENUM (
    'ADMIN_ASSIGN',
    'ADMIN_NOTIFY',
    'RESIDENT_VOTE',
    'SUPER_ADMIN_FORCE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EscalationStatus" AS ENUM (
    'PENDING',
    'ACKNOWLEDGED',
    'REVIEWING',
    'RESOLVED_BY_COUNSELLOR',
    'DEFERRED_TO_ADMIN',
    'WITHDRAWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CounsellorMessageKind" AS ENUM (
    'ADVISORY_TO_ADMIN',
    'PRIVATE_NOTE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═════════════════════════════════════════════════════════════════════════
-- 2. Counsellors
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS counsellors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    UUID NOT NULL UNIQUE,
  email           VARCHAR(100) NOT NULL UNIQUE,
  mobile          VARCHAR(15),
  name            VARCHAR(100) NOT NULL,
  national_id     VARCHAR(30),
  photo_url       VARCHAR(500),
  bio             TEXT,
  public_blurb    VARCHAR(500),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  mfa_required    BOOLEAN NOT NULL DEFAULT TRUE,
  mfa_enrolled_at TIMESTAMPTZ,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═════════════════════════════════════════════════════════════════════════
-- 3. Counsellor society assignments (many-to-many)
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS counsellor_society_assignments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counsellor_id  UUID NOT NULL REFERENCES counsellors(id) ON DELETE CASCADE,
  society_id     UUID NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
  assigned_by_id UUID NOT NULL,
  assigned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_primary     BOOLEAN NOT NULL DEFAULT FALSE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  revoked_at     TIMESTAMPTZ,
  revoked_by_id  UUID,
  notes          TEXT,
  CONSTRAINT uq_counsellor_society UNIQUE (counsellor_id, society_id)
);

CREATE INDEX IF NOT EXISTS idx_csa_society_id   ON counsellor_society_assignments(society_id);
CREATE INDEX IF NOT EXISTS idx_csa_counsellor_id ON counsellor_society_assignments(counsellor_id);

-- ═════════════════════════════════════════════════════════════════════════
-- 4. Ticket escalations
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS resident_ticket_escalations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id        UUID NOT NULL REFERENCES resident_tickets(id) ON DELETE CASCADE,
  counsellor_id    UUID NOT NULL REFERENCES counsellors(id),
  source           "EscalationSource" NOT NULL,
  status           "EscalationStatus" NOT NULL DEFAULT 'PENDING',
  reason           TEXT,
  created_by_id    UUID,
  acknowledged_at  TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  withdrawn_at     TIMESTAMPTZ,
  withdrawn_reason TEXT,
  sla_deadline     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ticket_counsellor_escalation UNIQUE (ticket_id, counsellor_id)
);

CREATE INDEX IF NOT EXISTS idx_rte_counsellor_status ON resident_ticket_escalations(counsellor_id, status);
CREATE INDEX IF NOT EXISTS idx_rte_ticket_id         ON resident_ticket_escalations(ticket_id);

-- ═════════════════════════════════════════════════════════════════════════
-- 5. Resident escalation votes
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS resident_ticket_escalation_votes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID NOT NULL REFERENCES resident_tickets(id) ON DELETE CASCADE,
  voter_id      UUID NOT NULL REFERENCES users(id),
  escalation_id UUID REFERENCES resident_ticket_escalations(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ticket_voter UNIQUE (ticket_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_rtev_ticket_id ON resident_ticket_escalation_votes(ticket_id);

-- ═════════════════════════════════════════════════════════════════════════
-- 6. Additive columns on existing tables
-- ═════════════════════════════════════════════════════════════════════════

-- 6a. Society: counsellor escalation vote threshold (default 10, range 5-50)
ALTER TABLE societies
  ADD COLUMN IF NOT EXISTS counsellor_escalation_threshold INT NOT NULL DEFAULT 10;

-- 6b. Resident ticket messages: add kind + counsellor_id, drop NOT NULL on author_id
--     (counsellors are a separate model from users, so their messages have no
--      valid author_id — schema must allow NULL on the author FK)
ALTER TABLE resident_ticket_messages
  ADD COLUMN IF NOT EXISTS kind "CounsellorMessageKind",
  ADD COLUMN IF NOT EXISTS counsellor_id UUID REFERENCES counsellors(id);

ALTER TABLE resident_ticket_messages
  ALTER COLUMN author_id DROP NOT NULL;
