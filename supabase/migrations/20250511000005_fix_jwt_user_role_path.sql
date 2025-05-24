-- Fix JWT user role access path in RLS policies
-- Issue: user_role is likely stored in user_metadata, not at root level of JWT

-- Drop current policies
DROP POLICY IF EXISTS "ADMINSTAFF can read all staff" ON public.staff;
DROP POLICY IF EXISTS "TUTOR can read own record" ON public.staff;
DROP POLICY IF EXISTS "ADMINSTAFF can insert staff" ON public.staff;
DROP POLICY IF EXISTS "ADMINSTAFF can update staff" ON public.staff;
DROP POLICY IF EXISTS "ADMINSTAFF can delete staff" ON public.staff;
DROP POLICY IF EXISTS "TUTOR can update own record" ON public.staff;

-- Create policies using the correct JWT path for user_metadata
-- ADMINSTAFF can read all staff records
CREATE POLICY "ADMINSTAFF can read all staff" ON public.staff
  FOR SELECT 
  TO authenticated 
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'user_role') = 'ADMINSTAFF'
    OR
    (auth.jwt() ->> 'user_role') = 'ADMINSTAFF'
  );

-- TUTORS can read only their own record
CREATE POLICY "TUTOR can read own record" ON public.staff
  FOR SELECT 
  TO authenticated 
  USING (
    user_id = auth.uid() 
    AND (
      (auth.jwt() -> 'user_metadata' ->> 'user_role') = 'TUTOR'
      OR
      (auth.jwt() ->> 'user_role') = 'TUTOR'
    )
  );

-- ADMINSTAFF can insert staff records
CREATE POLICY "ADMINSTAFF can insert staff" ON public.staff
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'user_role') = 'ADMINSTAFF'
    OR
    (auth.jwt() ->> 'user_role') = 'ADMINSTAFF'
  );

-- ADMINSTAFF can update all staff records
CREATE POLICY "ADMINSTAFF can update staff" ON public.staff
  FOR UPDATE 
  TO authenticated 
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'user_role') = 'ADMINSTAFF'
    OR
    (auth.jwt() ->> 'user_role') = 'ADMINSTAFF'
  );

-- ADMINSTAFF can delete staff records
CREATE POLICY "ADMINSTAFF can delete staff" ON public.staff
  FOR DELETE 
  TO authenticated 
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'user_role') = 'ADMINSTAFF'
    OR
    (auth.jwt() ->> 'user_role') = 'ADMINSTAFF'
  );

-- TUTORS can update their own record
CREATE POLICY "TUTOR can update own record" ON public.staff
  FOR UPDATE 
  TO authenticated 
  USING (
    user_id = auth.uid() 
    AND (
      (auth.jwt() -> 'user_metadata' ->> 'user_role') = 'TUTOR'
      OR
      (auth.jwt() ->> 'user_role') = 'TUTOR'
    )
  );

-- Add comment to document the fix
COMMENT ON TABLE public.staff IS 'Staff table with JWT policies checking both user_metadata and root level for user_role'; 