
-- Allow submitters to update their own rejected expenses (so they can edit and resubmit)
DROP POLICY IF EXISTS "Users can update own draft expenses" ON public.expenses;
CREATE POLICY "Users can update own draft or rejected expenses"
ON public.expenses
FOR UPDATE
USING (
  (auth.uid() = submitter_id) AND (status = 'draft'::expense_status OR status = 'rejected'::expense_status)
);
