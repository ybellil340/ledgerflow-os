-- supabase/migrations/20260422_phase_d_ocr_extractions.sql
-- Phase D: OCR extraction metadata persistence

-- OCR extraction results table
create table if not exists public.ocr_extractions (
  id            uuid primary key default gen_random_uuid(),
  receipt_id    uuid null,
  expense_id    uuid null references public.expenses(id) on delete set null,
  user_id       uuid not null references auth.users(id) on delete cascade,

  -- Provider info
  provider_name text not null default 'anthropic-vision',
  status        text not null default 'pending'
                  check (status in ('pending', 'processing', 'completed', 'failed')),

  -- Normalized extracted fields
  confidence_score  numeric(4,3) null check (confidence_score >= 0 and confidence_score <= 1),
  merchant_name     text null,
  receipt_number    text null,
  invoice_number    text null,
  amount            numeric(12,2) null,
  currency          text null default 'EUR',
  tax_amount        numeric(12,2) null,
  transaction_date  date null,
  warnings          jsonb not null default '[]'::jsonb,

  -- Raw provider data (for debugging / future re-processing)
  raw_provider_metadata jsonb null,

  -- Failure tracking
  failure_reason text null,

  -- Manual correction tracking
  manually_corrected boolean not null default false,
  corrected_at       timestamptz null,
  corrected_by       uuid null references auth.users(id),

  -- Timestamps
  processed_at timestamptz null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Indexes
create index idx_ocr_extractions_expense on public.ocr_extractions(expense_id) where expense_id is not null;
create index idx_ocr_extractions_user    on public.ocr_extractions(user_id);
create index idx_ocr_extractions_status  on public.ocr_extractions(status);

-- RLS
alter table public.ocr_extractions enable row level security;

create policy "Users can view own OCR extractions"
  on public.ocr_extractions for select
  using (auth.uid() = user_id);

create policy "Users can insert own OCR extractions"
  on public.ocr_extractions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own OCR extractions"
  on public.ocr_extractions for update
  using (auth.uid() = user_id);

-- Service role bypass for edge functions
create policy "Service role full access to OCR extractions"
  on public.ocr_extractions for all
  using (auth.role() = 'service_role');

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_ocr_extractions_updated
  before update on public.ocr_extractions
  for each row execute function public.set_updated_at();

-- Audit log entries for OCR events (uses existing audit_log if present)
-- If audit_log table doesn't exist yet, create minimal version
create table if not exists public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid null references auth.users(id),
  action     text not null,
  entity     text null,
  entity_id  text null,
  metadata   jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_action on public.audit_log(action);
create index if not exists idx_audit_log_entity on public.audit_log(entity, entity_id);
