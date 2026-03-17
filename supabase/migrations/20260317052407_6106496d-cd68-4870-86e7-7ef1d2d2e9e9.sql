
-- ============================================
-- LEDGERFLOW PHASE 1: Foundation Schema
-- ============================================

-- 1. Roles enum
CREATE TYPE public.app_role AS ENUM (
  'super_admin',
  'company_admin',
  'finance_manager',
  'approver',
  'employee',
  'tax_advisor'
);

-- 2. Organizations (multi-tenant)
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  tax_id TEXT,
  country TEXT NOT NULL DEFAULT 'DE',
  currency TEXT NOT NULL DEFAULT 'EUR',
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 3. Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Organization memberships (links users to orgs with roles)
CREATE TABLE public.org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'employee',
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- 5. User roles table (for security definer function)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 6. Departments
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  manager_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- 7. Cost centers
CREATE TABLE public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, code)
);
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = _user_id AND org_id = _org_id AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id UUID, _org_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = _user_id AND org_id = _org_id AND role = _role AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_org_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT org_id FROM public.org_members
  WHERE user_id = _user_id AND is_active = true
$$;

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_org_members_updated_at BEFORE UPDATE ON public.org_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cost_centers_updated_at BEFORE UPDATE ON public.cost_centers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- RLS POLICIES
-- ============================================

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Org members can view colleague profiles" ON public.profiles FOR SELECT
  USING (
    user_id IN (
      SELECT om.user_id FROM public.org_members om
      WHERE om.org_id IN (SELECT public.get_user_org_ids(auth.uid()))
      AND om.is_active = true
    )
  );

-- Organizations
CREATE POLICY "Members can view their org" ON public.organizations FOR SELECT
  USING (public.is_org_member(auth.uid(), id));
CREATE POLICY "Admins can update their org" ON public.organizations FOR UPDATE
  USING (public.has_org_role(auth.uid(), id, 'company_admin'));
CREATE POLICY "Any authenticated user can create org" ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Org members
CREATE POLICY "Members can view org members" ON public.org_members FOR SELECT
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Users can add themselves to org" ON public.org_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can insert org members" ON public.org_members FOR INSERT
  WITH CHECK (public.has_org_role(auth.uid(), org_id, 'company_admin'));
CREATE POLICY "Admins can update org members" ON public.org_members FOR UPDATE
  USING (public.has_org_role(auth.uid(), org_id, 'company_admin'));
CREATE POLICY "Admins can delete org members" ON public.org_members FOR DELETE
  USING (public.has_org_role(auth.uid(), org_id, 'company_admin'));

-- User roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Super admins can manage roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Departments
CREATE POLICY "Members can view departments" ON public.departments FOR SELECT
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Admins can manage departments" ON public.departments FOR INSERT
  WITH CHECK (public.has_org_role(auth.uid(), org_id, 'company_admin'));
CREATE POLICY "Admins can update departments" ON public.departments FOR UPDATE
  USING (public.has_org_role(auth.uid(), org_id, 'company_admin'));
CREATE POLICY "Admins can delete departments" ON public.departments FOR DELETE
  USING (public.has_org_role(auth.uid(), org_id, 'company_admin'));

-- Cost centers
CREATE POLICY "Members can view cost centers" ON public.cost_centers FOR SELECT
  USING (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "Admins can manage cost centers" ON public.cost_centers FOR INSERT
  WITH CHECK (public.has_org_role(auth.uid(), org_id, 'company_admin'));
CREATE POLICY "Admins can update cost centers" ON public.cost_centers FOR UPDATE
  USING (public.has_org_role(auth.uid(), org_id, 'company_admin'));
CREATE POLICY "Admins can delete cost centers" ON public.cost_centers FOR DELETE
  USING (public.has_org_role(auth.uid(), org_id, 'company_admin'));

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_org_members_user_id ON public.org_members(user_id);
CREATE INDEX idx_org_members_org_id ON public.org_members(org_id);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_departments_org_id ON public.departments(org_id);
CREATE INDEX idx_cost_centers_org_id ON public.cost_centers(org_id);
