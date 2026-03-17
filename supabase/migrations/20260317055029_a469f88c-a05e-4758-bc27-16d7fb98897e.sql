
CREATE TYPE public.budget_period AS ENUM ('monthly', 'quarterly', 'yearly');

CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  period public.budget_period NOT NULL DEFAULT 'monthly',
  department_id uuid REFERENCES public.departments(id),
  cost_center_id uuid REFERENCES public.cost_centers(id),
  category_id uuid REFERENCES public.expense_categories(id),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view budgets" ON public.budgets FOR SELECT USING (is_org_member(auth.uid(), org_id));
CREATE POLICY "Admins can insert budgets" ON public.budgets FOR INSERT WITH CHECK (has_org_role(auth.uid(), org_id, 'company_admin') OR has_org_role(auth.uid(), org_id, 'finance_manager'));
CREATE POLICY "Admins can update budgets" ON public.budgets FOR UPDATE USING (has_org_role(auth.uid(), org_id, 'company_admin') OR has_org_role(auth.uid(), org_id, 'finance_manager'));
CREATE POLICY "Admins can delete budgets" ON public.budgets FOR DELETE USING (has_org_role(auth.uid(), org_id, 'company_admin'));

CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
