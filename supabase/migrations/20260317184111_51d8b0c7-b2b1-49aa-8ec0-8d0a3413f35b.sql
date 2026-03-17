
-- Add tax/VAT fields to expenses table
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS vat_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_registration_number text;
