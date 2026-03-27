-- Phase 3: Cards v2 -- Bank Abstraction Layer
-- Run this in Supabase Dashboard > SQL Editor
-- WARNING: drops card_number_encrypted and cvv_encrypted (fake browser-generated values)

-- 1. Drop unsafe columns that stored browser-generated fake PANs in plaintext
ALTER TABLE cards DROP COLUMN IF EXISTS card_number_encrypted;
ALTER TABLE cards DROP COLUMN IF EXISTS cvv_encrypted;

-- 2. Add provider reference columns
ALTER TABLE cards ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'mock';
ALTER TABLE cards ADD COLUMN IF NOT EXISTS provider_card_id TEXT;

-- 3. Index for provider webhook lookups
CREATE INDEX IF NOT EXISTS idx_cards_provider_card_id ON cards(provider_card_id);
CREATE INDEX IF NOT EXISTS idx_cards_provider ON cards(provider);

-- 4. Prevent direct browser inserts -- all card mutations must go via edge functions
-- (service role key used in edge functions bypasses RLS)
DROP POLICY IF EXISTS "cards_no_direct_insert" ON cards;
CREATE POLICY "cards_no_direct_insert" ON cards
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  USING (false);

-- 5. Ensure audit_logs table has the columns we write to (non-destructive)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 6. Index audit log by entity for card history queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_action ON audit_logs(org_id, action);

-- Verify: check no unsafe columns remain
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'cards'
--   AND column_name IN ('card_number_encrypted','cvv_encrypted');
-- Expected: 0 rows
