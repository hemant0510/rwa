-- Migration: 20260415000001_counsellor_audit_logs
-- Counsellor role — Group 8 of 8 (execution_plan/plans/counsellor-role.md).
-- Per-counsellor activity trail. Mirrors audit_logs shape; keyed by counsellor_id.

CREATE TABLE IF NOT EXISTS "counsellor_audit_logs" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "counsellor_id" UUID NOT NULL,
  "action_type"   VARCHAR(60) NOT NULL,
  "entity_type"   VARCHAR(40) NOT NULL,
  "entity_id"     UUID NOT NULL,
  "society_id"    UUID,
  "metadata"      JSONB,
  "ip_address"    TEXT,
  "user_agent"    TEXT,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "counsellor_audit_logs_counsellor_created_idx"
  ON "counsellor_audit_logs" ("counsellor_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "counsellor_audit_logs_society_idx"
  ON "counsellor_audit_logs" ("society_id");

-- RLS: only SA reads this. Counsellors never read their own audit log from client.
ALTER TABLE "counsellor_audit_logs" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "counsellor_audit_logs_sa_select"
    ON "counsellor_audit_logs"
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM "super_admins" sa
        WHERE sa."auth_user_id" = auth.uid() AND sa."is_active" = true
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
