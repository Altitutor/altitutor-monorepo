-- Apply the correct RLS policies for production
-- This migration supersedes 20251025000007 with the correct schema-qualified statements

-- Fix topics table policies
DROP POLICY IF EXISTS admin_all_topics ON public.topics;
DROP POLICY IF EXISTS adminstaff_all_topics ON public.topics;
CREATE POLICY adminstaff_all_topics ON public.topics
  FOR ALL
  TO authenticated
  USING (
    COALESCE(
      (SELECT role FROM public.staff WHERE staff.user_id = auth.uid()),
      ''
    ) = 'ADMINSTAFF'
  )
  WITH CHECK (
    COALESCE(
      (SELECT role FROM public.staff WHERE staff.user_id = auth.uid()),
      ''
    ) = 'ADMINSTAFF'
  );

-- Fix files table policies
DROP POLICY IF EXISTS admin_all_files ON public.files;
DROP POLICY IF EXISTS adminstaff_all_files ON public.files;
CREATE POLICY adminstaff_all_files ON public.files
  FOR ALL
  TO authenticated
  USING (
    COALESCE(
      (SELECT role FROM public.staff WHERE staff.user_id = auth.uid()),
      ''
    ) = 'ADMINSTAFF'
  )
  WITH CHECK (
    COALESCE(
      (SELECT role FROM public.staff WHERE staff.user_id = auth.uid()),
      ''
    ) = 'ADMINSTAFF'
  );

-- Fix topics_files table policies (this is the critical one that was failing)
DROP POLICY IF EXISTS admin_all_topics_files ON public.topics_files;
DROP POLICY IF EXISTS adminstaff_all_topics_files ON public.topics_files;
CREATE POLICY adminstaff_all_topics_files ON public.topics_files
  FOR ALL
  TO authenticated
  USING (
    COALESCE(
      (SELECT role FROM public.staff WHERE staff.user_id = auth.uid()),
      ''
    ) = 'ADMINSTAFF'
  )
  WITH CHECK (
    COALESCE(
      (SELECT role FROM public.staff WHERE staff.user_id = auth.uid()),
      ''
    ) = 'ADMINSTAFF'
  );

