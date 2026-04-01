-- Phase C: Export Batches, Export Records, Period Locks
-- Migration: Accounting & Export Architecture Hardening

-- ============================================================
-- 1. export_batches â server-side batch tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS public.export_batches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  export_type         TEXT NOT NULL CHECK (export_type IN ('datev_expenses','datev_ap','datev_ar','datev_reimbursements','datev_journal','csv_generic')),
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  created_by          UUID NOT NULL REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ,
  file_path           TEXT,
  file_hash           TEXT,
  record_count        INTEGER NOT NULL DEFAULT 0,
  version             INTEGER NOT NULL DEFAULT 1,
  supersedes_batch_id UUID REFERENCES public.export_batches(id),
  failure_reason      TEXT,
  metadata            JSONB DEFAULT '{}'::jsonb
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_export_batches_org_id ON public.export_batches(org_id);
CREATE INDEX IF NOT EXISTS idx_export_batches_status ON public.export_batches(status);
CREATE INDEX IF NOT EXISTS idx_export_batches_period ON public.export_batches(org_id, period_start, period_end);

-- RLS
ALTER TABLE public.export_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org export batches"
  ON public.export_batches FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can insert export batches"
  ON public.export_batches FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('company_admin','accountant')
    )
  );

CREATE POLICY "Service role full access to export batches"
  ON public.export_batches FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 2. export_records â links each exported source row to its batch
-- ============================================================
CREATE TABLE IF NOT EXISTS public.export_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id              UUID NOT NULL REFERENCES public.export_batches(id) ON DELETE CASCADE,
  source_table          TEXT NOT NULL CHECK (source_table IN ('expenses','reimbursements','ap_invoices','ar_invoices','transactions')),
  source_id             UUID NOT NULL,
  source_status_snapshot TEXT NOT NULL,
  source_hash           TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_export_records_batch_id ON public.export_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_export_records_source ON public.export_records(source_table, source_id);

-- RLS
ALTER TABLE public.export_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view export records via batch org"
  ON public.export_records FOR SELECT
  USING (batch_id IN (
    SELECT eb.id FROM public.export_batches eb
    WHERE eb.org_id IN (
      SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Service role full access to export records"
  ON public.export_records FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 3. period_locks â prevent silent mutation of closed periods
-- ============================================================
CREATE TABLE IF NOT EXISTS public.period_locks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  lock_status   TEXT NOT NULL DEFAULT 'locked' CHECK (lock_status IN ('locked','unlocked')),
  locked_by     UUID NOT NULL REFERENCES auth.users(id),
  locked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  unlocked_at   TIMESTAMPTZ,
  notes         TEXT,
  UNIQUE (org_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_period_locks_org ON public.period_locks(org_id);
CREATE INDEX IF NOT EXISTS idx_period_locks_range ON public.period_locks(org_id, period_start, period_end);

-- RLS
ALTER TABLE public.period_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org period locks"
  ON public.period_locks FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage period locks"
  ON public.period_locks FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('company_admin','accountant')
    )
  );

CREATE POLICY "Service role full access to period locks"
  ON public.period_locks FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 4. Immutability trigger: completed batches cannot be updated
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_completed_batch_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'completed' AND NEW.status != OLD.status THEN
    RAISE EXCEPTION 'Cannot mutate a completed export batch (id: %). Create a new version instead.', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_export_batch_immutable
  BEFORE UPDATE ON public.export_batches
  FOR EACH ROW
  EXECUTE FUNCTION prevent_completed_batch_mutation();

-- ============================================================
-- 5. Period lock enforcement: warn on mutation of locked records
-- ============================================================
CREATE OR REPLACE FUNCTION check_period_lock()
RETURNS TRIGGER AS $$
DECLARE
  _record_date DATE;
  _org_id UUID;
  _lock_exists BOOLEAN;
BEGIN
  -- Determine the record's date and org
  IF TG_TABLE_NAME = 'expenses' THEN
    _record_date := NEW.expense_date;
    _org_id := NEW.org_id;
  ELSIF TG_TABLE_NAME IN ('ap_invoices', 'ar_invoices') THEN
    _record_date := NEW.issue_date;
    _org_id := NEW.org_id;
  ELSIF TG_TABLE_NAME = 'reimbursements' THEN
    _record_date := NEW.created_at::date;
    _org_id := NEW.org_id;
  ELSE
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.period_locks
    WHERE org_id = _org_id
      AND lock_status = 'locked'
      AND _record_date >= period_start
      AND _record_date <= period_end
  ) INTO _lock_exists;

  IF _lock_exists THEN
    RAISE EXCEPTION 'Cannot modify record in locked accounting period (% to %). Unlock the period first.',
      (SELECT period_start FROM public.period_locks WHERE org_id = _org_id AND lock_status = 'locked' AND _record_date >= period_start AND _record_date <= period_end LIMIT 1),
      (SELECT period_end FROM public.period_locks WHERE org_id = _org_id AND lock_status = 'locked' AND _record_date >= period_start AND _record_date <= period_end LIMIT 1);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply period lock checks to accounting-relevant tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_period_lock_expenses') THEN
    CREATE TRIGGER trg_period_lock_expenses
      BEFORE UPDATE ON public.expenses
      FOR EACH ROW EXECUTE FUNCTION check_period_lock();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_period_lock_ap_invoices') THEN
    CREATE TRIGGER trg_period_lock_ap_invoices
      BEFORE UPDATE ON public.ap_invoices
      FOR EACH ROW EXECUTE FUNCTION check_period_lock();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_period_lock_ar_invoices') THEN
    CREATE TRIGGER trg_period_lock_ar_invoices
      BEFORE UPDATE ON public.ar_invoices
      FOR EACH ROW EXECUTE FUNCTION check_period_lock();
  END IF;
END $$;
