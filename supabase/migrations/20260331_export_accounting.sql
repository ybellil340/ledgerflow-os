-- Phase C: Export batch domain, period locks, stale-export detection
-- Migration: 20260331_export_accounting.sql

-- ── 1. export_batches ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.export_batches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id),
  export_type   text NOT NULL CHECK (export_type IN (
    'expenses', 'ap_invoices', 'ar_invoices', 'reimbursements', 'journal'
  )),
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed'
  )),
  created_by    uuid NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  file_path     text,
  file_hash     text,
  record_count  integer NOT NULL DEFAULT 0,
  version       integer NOT NULL DEFAULT 1,
  supersedes_batch_id uuid REFERENCES public.export_batches(id),
  failure_reason text,
  CONSTRAINT period_order CHECK (period_end >= period_start)
);

ALTER TABLE public.export_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY export_batches_org_read ON public.export_batches
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid())
  );

CREATE INDEX idx_export_batches_org_period
  ON public.export_batches (org_id, period_start, period_end);

-- ── Immutability: completed batches cannot be updated ─────────────────────────
CREATE OR REPLACE FUNCTION public.guard_completed_batch()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'completed' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Completed export batches are immutable (batch_id=%)', OLD.id;
  END IF;
  IF OLD.status = 'completed' THEN
    -- Allow only supersedes_batch_id to be set on completed batches (no-op guard)
    RAISE EXCEPTION 'Completed export batches are immutable (batch_id=%)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_guard_completed_batch
  BEFORE UPDATE ON public.export_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_completed_batch();

-- ── 2. export_records ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.export_records (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id                uuid NOT NULL REFERENCES public.export_batches(id) ON DELETE CASCADE,
  source_table            text NOT NULL CHECK (source_table IN (
    'expenses', 'ap_invoices', 'ar_invoices', 'reimbursements', 'transactions'
  )),
  source_id               uuid NOT NULL,
  source_status_snapshot  text NOT NULL,
  source_hash             text NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.export_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY export_records_org_read ON public.export_records
  FOR SELECT USING (
    batch_id IN (
      SELECT eb.id FROM public.export_batches eb
      JOIN public.user_profiles up ON up.org_id = eb.org_id
      WHERE up.id = auth.uid()
    )
  );

CREATE INDEX idx_export_records_batch ON public.export_records (batch_id);
CREATE INDEX idx_export_records_source ON public.export_records (source_table, source_id);

-- ── 3. period_locks ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.period_locks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id),
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  lock_status   text NOT NULL DEFAULT 'locked' CHECK (lock_status IN ('locked', 'unlocked')),
  locked_by     uuid NOT NULL,
  locked_at     timestamptz NOT NULL DEFAULT now(),
  notes         text,
  CONSTRAINT period_lock_order CHECK (period_end >= period_start),
  CONSTRAINT unique_org_period UNIQUE (org_id, period_start, period_end)
);

ALTER TABLE public.period_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY period_locks_org_read ON public.period_locks
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM public.user_profiles WHERE id = auth.uid())
  );

CREATE INDEX idx_period_locks_org ON public.period_locks (org_id, period_start, period_end);

-- ── 4. Period lock enforcement trigger ────────────────────────────────────────
-- Prevents mutation of accounting-relevant records in locked periods.
-- Accounting-relevant tables: expenses, reimbursements, ap_invoices, ar_invoices
CREATE OR REPLACE FUNCTION public.enforce_period_lock()
RETURNS trigger AS $$
DECLARE
  _date date;
  _org  uuid;
  _locked boolean;
BEGIN
  -- Determine the relevant date and org from the record
  IF TG_TABLE_NAME = 'expenses' THEN
    _date := COALESCE(NEW.expense_date, OLD.expense_date)::date;
    _org  := COALESCE(NEW.org_id, OLD.org_id);
  ELSIF TG_TABLE_NAME IN ('ap_invoices', 'ar_invoices') THEN
    _date := COALESCE(NEW.issue_date, OLD.issue_date)::date;
    _org  := COALESCE(NEW.org_id, OLD.org_id);
  ELSIF TG_TABLE_NAME = 'reimbursements' THEN
    _date := COALESCE(NEW.created_at, OLD.created_at)::date;
    _org  := COALESCE(NEW.org_id, OLD.org_id);
  ELSE
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.period_locks
    WHERE org_id = _org
      AND lock_status = 'locked'
      AND _date BETWEEN period_start AND period_end
  ) INTO _locked;

  IF _locked THEN
    RAISE EXCEPTION 'Record falls within a locked accounting period (table=%, date=%)', TG_TABLE_NAME, _date;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to accounting-relevant tables
CREATE TRIGGER trg_period_lock_expenses
  BEFORE UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock();

CREATE TRIGGER trg_period_lock_ap_invoices
  BEFORE UPDATE OR DELETE ON public.ap_invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock();

CREATE TRIGGER trg_period_lock_ar_invoices
  BEFORE UPDATE OR DELETE ON public.ar_invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reimbursements' AND table_schema = 'public') THEN
    EXECUTE 'CREATE TRIGGER trg_period_lock_reimbursements BEFORE UPDATE OR DELETE ON public.reimbursements FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock()';
  END IF;
END $$;
