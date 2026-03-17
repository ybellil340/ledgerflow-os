
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'employee',
  status public.invitation_status NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, email, status)
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view invitations" ON public.invitations FOR SELECT USING (is_org_member(auth.uid(), org_id));
CREATE POLICY "Admins can insert invitations" ON public.invitations FOR INSERT WITH CHECK (has_org_role(auth.uid(), org_id, 'company_admin'));
CREATE POLICY "Admins can update invitations" ON public.invitations FOR UPDATE USING (has_org_role(auth.uid(), org_id, 'company_admin'));
CREATE POLICY "Admins can delete invitations" ON public.invitations FOR DELETE USING (has_org_role(auth.uid(), org_id, 'company_admin'));

CREATE TRIGGER update_invitations_updated_at BEFORE UPDATE ON public.invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
