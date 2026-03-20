-- Migration: Enable Row-Level Security on all society-scoped tables
-- Date: 2026-03-20
-- Purpose: Ensure tenant isolation — each society can only access its own data.
--          Prisma handles all data access via a service role key (bypasses RLS),
--          so these policies protect direct DB access and future client-side queries.

-- ─────────────────────────────────────────────────────────
-- 1. Enable RLS on society-scoped tables
-- ─────────────────────────────────────────────────────────
ALTER TABLE users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE units                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_units              ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_fees         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses                ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_batches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_sessions            ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────
-- 2. Core isolation policy — users can only see their own society
-- ─────────────────────────────────────────────────────────
CREATE POLICY society_isolation ON users
  USING (
    society_id = (SELECT society_id FROM users WHERE auth_user_id = auth.uid())
    OR
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY society_isolation ON units
  USING (
    society_id = (SELECT society_id FROM users WHERE auth_user_id = auth.uid())
    OR
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY society_isolation ON user_units
  USING (
    society_id = (SELECT society_id FROM users WHERE auth_user_id = auth.uid())
    OR
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY society_isolation ON membership_fees
  USING (
    society_id = (SELECT society_id FROM users WHERE auth_user_id = auth.uid())
    OR
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY society_isolation ON fee_payments
  USING (
    society_id = (SELECT society_id FROM users WHERE auth_user_id = auth.uid())
    OR
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY society_isolation ON broadcasts
  USING (
    society_id = (SELECT society_id FROM users WHERE auth_user_id = auth.uid())
    OR
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY society_isolation ON notification_preferences
  USING (
    society_id = (SELECT society_id FROM users WHERE auth_user_id = auth.uid())
    OR
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY society_isolation ON migration_batches
  USING (
    society_id = (SELECT society_id FROM users WHERE auth_user_id = auth.uid())
    OR
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY society_isolation ON fee_sessions
  USING (
    society_id = (SELECT society_id FROM users WHERE auth_user_id = auth.uid())
    OR
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'SUPER_ADMIN'
  );

-- ─────────────────────────────────────────────────────────
-- 3. Notifications — residents see only their own; admins see all in society
-- ─────────────────────────────────────────────────────────
CREATE POLICY own_notifications ON notifications
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) IN ('SUPER_ADMIN', 'RWA_ADMIN')
  );

-- ─────────────────────────────────────────────────────────
-- 4. Audit logs — INSERT only (immutable); reads scoped to society
-- ─────────────────────────────────────────────────────────
CREATE POLICY audit_insert_only ON audit_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY audit_read ON audit_logs
  FOR SELECT USING (
    society_id = (SELECT society_id FROM users WHERE auth_user_id = auth.uid())
    OR
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'SUPER_ADMIN'
  );

-- No UPDATE or DELETE policy on audit_logs — enforces immutability at DB level.

-- ─────────────────────────────────────────────────────────
-- 5. Expenses — all society residents can read (financial transparency)
--              only admins can write
-- ─────────────────────────────────────────────────────────
CREATE POLICY expense_read_all ON expenses
  FOR SELECT USING (
    society_id = (SELECT society_id FROM users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY expense_admin_write ON expenses
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) IN ('SUPER_ADMIN', 'RWA_ADMIN')
  );

CREATE POLICY expense_admin_update ON expenses
  FOR UPDATE USING (
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) IN ('SUPER_ADMIN', 'RWA_ADMIN')
  );
