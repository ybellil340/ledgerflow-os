
-- =============================================
-- PHASE 2: EXPENSES
-- =============================================

-- Expense categories
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view expense categories" ON public.expense_categories FOR SELECT USING (is_org_member(auth.uid(), org_id));
CREATE POLICY "Admins can insert expense categories" ON public.expense_categories FOR INSERT WITH CHECK (has_org_role(auth.uid(), org_id, 'company_admin'));
CREATE POLICY "Admins can update expense categories" ON public.expense_categories FOR UPDATE USING (has_org_role(auth.uid(), org_id, 'company_admin'));
CREATE POLICY "Admins can delete expense categories" ON public.expense_categories FOR DELETE USING (has_org_role(auth.uid(), org_id, 'company_admin'));

-- Expenses
CREATE TYPE public.expense_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'reimbursed');

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  submitter_id uuid NOT NULL,
  approver_id uuid,
  category_id uuid REFERENCES public.expense_categories(id),
  cost_center_id uuid REFERENCES public.cost_centers(id),
  title text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_url text,
  status public.expense_status NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org expenses" ON public.expenses FOR SELECT USING (is_org_member(auth.uid(), org_id));
CREATE POLICY "Users can insert own expenses" ON public.expenses FOR INSERT WITH CHECK (auth.uid() = submitter_id AND is_org_member(auth.uid(), org_id));
CREATE POLICY "Users can update own draft expenses" ON public.expenses FOR UPDATE USING (auth.uid() = submitter_id AND status = 'draft');
CREATE POLICY "Approvers can update expenses" ON public.expenses FOR UPDATE USING (
  has_org_role(auth.uid(), org_id, 'company_admin') OR has_org_role(auth.uid(), org_id, 'finance_manager') OR has_org_role(auth.uid(), org_id, 'approver')
);
CREATE POLICY "Users can delete own draft expenses" ON public.expenses FOR DELETE USING (auth.uid() = submitter_id AND status = 'draft');

-- =============================================
-- PHASE 3: INVOICES & DIRECTORY
-- =============================================

-- Suppliers
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  tax_id text,
  email text,
  phone text,
  address text,
  city text,
  country text DEFAULT 'DE',
  iban text,
  bic text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view suppliers" ON public.suppliers FOR SELECT USING (is_org_member(auth.uid(), org_id));
CREATE POLICY "Admins can insert suppliers" ON public.suppliers FOR INSERT WITH CHECK (has_org_role(auth.uid(), org_id, 'company_admin') OR has_org_role(auth.uid(), org_id, 'finance_manager'));
CREATE POLICY "Admins can update suppliers" ON public.suppliers FOR UPDATE USING (has_org_role(auth.uid(), org_id, 'company_admin') OR has_org_role(auth.uid(), org_id, 'finance_manager'));
CREATE POLICY "Admins can delete suppliers" ON public.suppliers FOR DELETE USING (has_org_role(auth.uid(), org_id, 'company_admin'));

-- Customers
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  tax_id text,
  email text,
  phone text,
  address text,
  city text,
  country text DEFAULT 'DE',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view customers" ON public.customers FOR SELECT USING (is_org_member(auth.uid(), org_id));
CREATE POLICY "Admins can insert customers" ON public.customers FOR INSERT WITH CHECK (has_org_role(auth.uid(), org_id, 'company_admin') OR has_org_role(auth.uid(), org_id, 'finance_manager'));
CREATE POLICY "Admins can update customers" ON public.customers FOR UPDATE USING (has_org_role(auth.uid(), org_id, 'company_admin') OR has_org_role(auth.uid(), org_id, 'finance_manager'));
CREATE POLICY "Admins can delete customers" ON public.customers FOR DELETE USING (has_org_role(auth.uid(), org_id, 'company_admin'));

-- AP Invoices
CREATE TYPE public.invoice_status AS ENUM ('draft', 'pending', 'approved', 'paid', 'overdue', 'cancelled');

CREATE TABLE public.ap_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id),
  invoice_number text NOT NULL,
  reference text,
  amount numeric(12,2) NOT NULL,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  cost_center_id uuid REFERENCES public.cost_centers(id),
  notes text,
  document_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ap_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view ap invoices" ON public.ap_invoices FOR SELECT USING (is_org_member(auth.uid(), org_id));
CREATE POLICY "Finance can insert ap invoices" ON public.ap_invoices FOR INSERT WITH CHECK (is_org_member(auth.uid(), org_id));
CREATE POLICY "Finance can update ap invoices" ON public.ap_invoices FOR UPDATE USING (has_org_role(auth.uid(), org_id, 'company_admin') OR has_org_role(auth.uid(), org_id, 'finance_manager'));
CREATE POLICY "Admins can delete ap invoices" ON public.ap_invoices FOR DELETE USING (has_org_role(auth.uid(), org_id, 'company_admin'));

-- AR Invoices
CREATE TABLE public.ar_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id),
  invoice_number text NOT NULL,
  reference text,
  amount numeric(12,2) NOT NULL,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  notes text,
  document_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ar_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view ar invoices" ON public.ar_invoices FOR SELECT USING (is_org_member(auth.uid(), org_id));
CREATE POLICY "Finance can insert ar invoices" ON public.ar_invoices FOR INSERT WITH CHECK (is_org_member(auth.uid(), org_id));
CREATE POLICY "Finance can update ar invoices" ON public.ar_invoices FOR UPDATE USING (has_org_role(auth.uid(), org_id, 'company_admin') OR has_org_role(auth.uid(), org_id, 'finance_manager'));
CREATE POLICY "Admins can delete ar invoices" ON public.ar_invoices FOR DELETE USING (has_org_role(auth.uid(), org_id, 'company_admin'));

-- =============================================
-- PHASE 4: ACCOUNTING
-- =============================================

CREATE TABLE public.vat_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text NOT NULL,
  rate numeric(5,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vat_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view vat codes" ON public.vat_codes FOR SELECT USING (is_org_member(auth.uid(), org_id));
CREATE POLICY "Admins can manage vat codes" ON public.vat_codes FOR ALL USING (has_org_role(auth.uid(), org_id, 'company_admin'));

CREATE TABLE public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_number text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL DEFAULT 'expense',
  parent_id uuid REFERENCES public.chart_of_accounts(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view chart of accounts" ON public.chart_of_accounts FOR SELECT USING (is_org_member(auth.uid(), org_id));
CREATE POLICY "Admins can manage chart of accounts" ON public.chart_of_accounts FOR ALL USING (has_org_role(auth.uid(), org_id, 'company_admin'));

-- =============================================
-- PHASE 5: CARDS & BANKING
-- =============================================

CREATE TYPE public.card_status AS ENUM ('active', 'frozen', 'cancelled');
CREATE TYPE public.transaction_status AS ENUM ('pending', 'completed', 'declined', 'reversed');

CREATE TABLE public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  holder_id uuid NOT NULL,
  card_name text NOT NULL,
  last_four text NOT NULL DEFAULT '0000',
  card_type text NOT NULL DEFAULT 'virtual',
  spending_limit numeric(12,2) DEFAULT 5000,
  currency text NOT NULL DEFAULT 'EUR',
  status public.card_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view cards" ON public.cards FOR SELECT USING (is_org_member(auth.uid(), org_id));
CREATE POLICY "Admins can manage cards" ON public.cards FOR ALL USING (has_org_role(auth.uid(), org_id, 'company_admin'));

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  card_id uuid REFERENCES public.cards(id),
  merchant_name text NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  category text,
  transaction_date timestamptz NOT NULL DEFAULT now(),
  status public.transaction_status NOT NULL DEFAULT 'completed',
  receipt_url text,
  notes text,
  is_reconciled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view transactions" ON public.transactions FOR SELECT USING (is_org_member(auth.uid(), org_id));
CREATE POLICY "Admins can manage transactions" ON public.transactions FOR ALL USING (has_org_role(auth.uid(), org_id, 'company_admin'));

CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_name text NOT NULL,
  iban text,
  bic text,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view bank accounts" ON public.bank_accounts FOR SELECT USING (is_org_member(auth.uid(), org_id));
CREATE POLICY "Admins can manage bank accounts" ON public.bank_accounts FOR ALL USING (has_org_role(auth.uid(), org_id, 'company_admin'));

-- =============================================
-- PHASE 6: ADVANCED
-- =============================================

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (has_org_role(auth.uid(), org_id, 'company_admin'));
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text,
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (is_org_member(auth.uid(), org_id));

-- Storage bucket for receipts and documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage policies
CREATE POLICY "Org members can upload documents" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'documents' AND auth.role() = 'authenticated'
);
CREATE POLICY "Org members can view documents" ON storage.objects FOR SELECT USING (
  bucket_id = 'documents' AND auth.role() = 'authenticated'
);
CREATE POLICY "Users can delete own documents" ON storage.objects FOR DELETE USING (
  bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Updated_at triggers for all new tables
CREATE TRIGGER update_expense_categories_updated_at BEFORE UPDATE ON public.expense_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ap_invoices_updated_at BEFORE UPDATE ON public.ap_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ar_invoices_updated_at BEFORE UPDATE ON public.ar_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chart_of_accounts_updated_at BEFORE UPDATE ON public.chart_of_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON public.cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
