
-- Create spend_period enum
CREATE TYPE public.spend_period AS ENUM ('daily', 'monthly');

-- Create wallets table
CREATE TABLE public.wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  iban_display TEXT, -- shown for primary wallet funding
  bic_display TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view wallets" ON public.wallets
  FOR SELECT USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins can insert wallets" ON public.wallets
  FOR INSERT WITH CHECK (has_org_role(auth.uid(), org_id, 'company_admin'));

CREATE POLICY "Admins can update wallets" ON public.wallets
  FOR UPDATE USING (has_org_role(auth.uid(), org_id, 'company_admin'));

CREATE POLICY "Admins can delete wallets" ON public.wallets
  FOR DELETE USING (has_org_role(auth.uid(), org_id, 'company_admin'));

-- Trigger for updated_at
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Wallet fund transfers log
CREATE TABLE public.wallet_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  to_wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  note TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view wallet transfers" ON public.wallet_transfers
  FOR SELECT USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins can insert wallet transfers" ON public.wallet_transfers
  FOR INSERT WITH CHECK (has_org_role(auth.uid(), org_id, 'company_admin'));

-- Add wallet_id, spend_period, and allowed_category_ids to cards
ALTER TABLE public.cards
  ADD COLUMN wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  ADD COLUMN spend_period spend_period NOT NULL DEFAULT 'monthly',
  ADD COLUMN allowed_category_ids UUID[] DEFAULT '{}';

-- Ensure only one primary wallet per org
CREATE UNIQUE INDEX idx_wallets_primary_per_org ON public.wallets (org_id) WHERE is_primary = true;
