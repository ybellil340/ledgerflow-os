
-- Generic audit log trigger function
CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _user_id uuid;
  _entity_id uuid;
  _action text;
  _details jsonb;
BEGIN
  _user_id := auth.uid();
  _action := TG_OP; -- INSERT, UPDATE, DELETE

  -- Determine org_id and entity_id from the row
  IF TG_OP = 'DELETE' THEN
    _entity_id := OLD.id;
    _org_id := OLD.org_id;
    _details := jsonb_build_object('old', to_jsonb(OLD));
  ELSIF TG_OP = 'UPDATE' THEN
    _entity_id := NEW.id;
    _org_id := NEW.org_id;
    _details := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSE
    _entity_id := NEW.id;
    _org_id := NEW.org_id;
    _details := jsonb_build_object('new', to_jsonb(NEW));
  END IF;

  -- Only log if we have a user (skip system/service-role operations)
  IF _user_id IS NOT NULL AND _org_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (user_id, org_id, entity_type, entity_id, action, details)
    VALUES (_user_id, _org_id, TG_TABLE_NAME, _entity_id, _action, _details);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Expenses
CREATE TRIGGER audit_expenses_insert AFTER INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_expenses_update AFTER UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_expenses_delete AFTER DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- AP Invoices
CREATE TRIGGER audit_ap_invoices_insert AFTER INSERT ON public.ap_invoices FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_ap_invoices_update AFTER UPDATE ON public.ap_invoices FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_ap_invoices_delete AFTER DELETE ON public.ap_invoices FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- AR Invoices
CREATE TRIGGER audit_ar_invoices_insert AFTER INSERT ON public.ar_invoices FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_ar_invoices_update AFTER UPDATE ON public.ar_invoices FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_ar_invoices_delete AFTER DELETE ON public.ar_invoices FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- Org Members (team changes)
CREATE TRIGGER audit_org_members_insert AFTER INSERT ON public.org_members FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_org_members_update AFTER UPDATE ON public.org_members FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_org_members_delete AFTER DELETE ON public.org_members FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- Budgets
CREATE TRIGGER audit_budgets_insert AFTER INSERT ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_budgets_update AFTER UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_budgets_delete AFTER DELETE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
