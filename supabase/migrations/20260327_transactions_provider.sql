-- supabase/migrations/20260327_transactions_provider.sql
-- Base transactions table RLS + write-boundary policies.
-- The transactions table itself is created in earlier migrations (20260317*).
-- This migration layers on RLS and enforces the service-role-only write rule.
-- Depends on: 20260327_webhook_events.sql (provider columns already added).
-- Safe to re-run: all statements are idempotent.

-- ── 1. Enable RLS ─────────────────────────────────────────────────────────────
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- ── 2. SELECT: any active org member can read their org's transactions ─────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'transactions' AND policyname = 'transactions_select'
  ) THEN
    CREATE POLICY transactions_select ON transactions
      FOR SELECT TO authenticated
      USING (
        org_id IN (
          SELECT org_id FROM org_members
          WHERE user_id = auth.uid()
            AND is_active = true
        )
      );
  END IF;
END $$;

-- ── 3. RESTRICTIVE write block — browser cannot write transactions directly ────
-- The only legitimate write paths are service-role edge functions:
--   • webhook-process        (upserts via lifecycle events)
--   • transaction-link-expense (sets expense_id + is_reconciled)
-- This RESTRICTIVE policy silently blocks all authenticated direct writes.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'transactions' AND policyname = 'transactions_no_direct_write'
  ) THEN
    CREATE POLICY transactions_no_direct_write ON transactions
      AS RESTRICTIVE
      FOR ALL TO authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;
