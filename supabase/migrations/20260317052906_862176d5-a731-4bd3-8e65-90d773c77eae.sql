
DROP POLICY "Any authenticated user can create org" ON public.organizations;
CREATE POLICY "Any authenticated user can create org" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (true);
