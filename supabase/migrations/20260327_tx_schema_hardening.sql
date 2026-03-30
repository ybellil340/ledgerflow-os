-- supabase/migrations/20260327_tx_schema_hardening.sql
-- Phase B: reconciliation columns, updated_at, and additional indexes.
-- Depends on: 20260327_transactions_provider.sql, 20260327_webhook_events.sql
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS / OR REPLACE / IF NOT EXISTS.

-- ── 1. Reconciliation + metadata columns ─────────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS expense_id   uuid        REFERENCES expenses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_reconciled boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes        text,
  ADD COLUMN IF NOT EXISTS receipt_url  text,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();

-- ── 2. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transactions_expense_id
  ON transactions (expense_id)
  WHERE expense_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_reconciled
  ON transactions (org_id, is_reconciled, transaction_date DESC);

-- ── 3. updated_at auto-stamp trigger ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON transactions;
CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 4. RLS: company_admin can update reconciliation fields via edge fn ─────────
-- The RESTRICTIVE no_direct_write policy still blocks browser writes.
-- transaction-link-expense uses service_role key which bypasses RLS entirely.
-- No additional permissive policy needed here — service_role bypasses all RLS.
