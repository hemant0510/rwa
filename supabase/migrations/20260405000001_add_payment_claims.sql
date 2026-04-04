-- Migration: 20260405000001_add_payment_claims
-- Adds UPI payment claim flow: societies UPI fields, payment_claims,
-- subscription_payment_claims, platform_settings tables, UPI_CLAIM enum value.

-- ─── 1. Extend PaymentMode enum ──────────────────────────────────────────────
ALTER TYPE "PaymentMode" ADD VALUE IF NOT EXISTS 'UPI_CLAIM';

-- ─── 2. Add UPI fields to societies ──────────────────────────────────────────
ALTER TABLE societies ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100);
ALTER TABLE societies ADD COLUMN IF NOT EXISTS upi_qr_url VARCHAR(500);
ALTER TABLE societies ADD COLUMN IF NOT EXISTS upi_account_name VARCHAR(200);

-- ─── 3. Updated_at trigger function (idempotent) ──────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 4. payment_claims table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_claims (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id        UUID NOT NULL REFERENCES societies(id),
  user_id           UUID NOT NULL REFERENCES users(id),
  membership_fee_id UUID NOT NULL REFERENCES membership_fees(id),
  claimed_amount    DECIMAL(10,2) NOT NULL,
  utr_number        VARCHAR(50) NOT NULL,
  payment_date      DATE NOT NULL,
  screenshot_url    VARCHAR(500),
  status            VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  verified_by       UUID REFERENCES users(id),
  verified_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  admin_notes       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_utr_society ON payment_claims(utr_number, society_id);
CREATE INDEX IF NOT EXISTS idx_claims_society_status ON payment_claims(society_id, status);
CREATE INDEX IF NOT EXISTS idx_claims_user ON payment_claims(user_id);

CREATE TRIGGER trg_payment_claims_updated_at
  BEFORE UPDATE ON payment_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE payment_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY society_isolation ON payment_claims
  USING (society_id = (
    SELECT society_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- ─── 5. Add payment_claim_id FK to fee_payments ───────────────────────────────
-- payment_claims must exist before this ALTER
ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS payment_claim_id UUID REFERENCES payment_claims(id);

-- ─── 6. subscription_payment_claims table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_payment_claims (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id       UUID NOT NULL REFERENCES societies(id),
  subscription_id  UUID NOT NULL REFERENCES society_subscriptions(id),
  amount           DECIMAL(10,2) NOT NULL,
  utr_number       VARCHAR(50) NOT NULL,
  payment_date     DATE NOT NULL,
  screenshot_url   VARCHAR(500),
  status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  verified_by      VARCHAR(100),
  verified_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  period_start     DATE,
  period_end       DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_claims_utr ON subscription_payment_claims(utr_number);
CREATE INDEX IF NOT EXISTS idx_sub_claims_society_status ON subscription_payment_claims(society_id, status);
CREATE INDEX IF NOT EXISTS idx_sub_claims_status ON subscription_payment_claims(status);

CREATE TRIGGER trg_sub_payment_claims_updated_at
  BEFORE UPDATE ON subscription_payment_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE subscription_payment_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY sub_claim_society_isolation ON subscription_payment_claims
  USING (society_id = (
    SELECT society_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- ─── 7. platform_settings table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key   VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_platform_settings_updated_at
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 8. Supabase Storage bucket: platform-assets ─────────────────────────────
-- Run in Supabase SQL editor (storage API manages this, not Prisma)
INSERT INTO storage.buckets (id, name, public)
VALUES ('platform-assets', 'platform-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read platform assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'platform-assets');

CREATE POLICY "SA-only write platform assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'platform-assets' AND auth.role() = 'authenticated');
