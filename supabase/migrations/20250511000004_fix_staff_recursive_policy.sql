-- Fix infinite recursion in staff RLS policies
-- Issue: Policies that query the staff table from within staff table policies create circular dependency

-- Drop ALL existing policies for staff table 
DROP POLICY IF EXISTS "Allow adminstaff full staff access" ON public.staff;
DROP POLICY IF EXISTS "Allow tutors to read own record" ON public.staff;
DROP POLICY IF EXISTS "Allow adminstaff to insert staff" ON public.staff;
DROP POLICY IF EXISTS "Allow adminstaff to update staff" ON public.staff;
DROP POLICY IF EXISTS "Allow adminstaff to delete staff" ON public.staff;
DROP POLICY IF EXISTS "Allow tutors to update own record" ON public.staff;

-- Create policies that ONLY use JWT claims (no database queries to avoid recursion)
-- ADMINSTAFF can read all staff records
CREATE POLICY "ADMINSTAFF can read all staff" ON public.staff
  FOR SELECT 
  TO authenticated 
  USING (
    (auth.jwt() ->> 'user_role') = 'ADMINSTAFF'
  );

-- TUTORS can read only their own record
CREATE POLICY "TUTOR can read own record" ON public.staff
  FOR SELECT 
  TO authenticated 
  USING (
    user_id = auth.uid() 
    AND (auth.jwt() ->> 'user_role') = 'TUTOR'
  );

-- ADMINSTAFF can insert staff records
CREATE POLICY "ADMINSTAFF can insert staff" ON public.staff
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'ADMINSTAFF'
  );

-- ADMINSTAFF can update all staff records
CREATE POLICY "ADMINSTAFF can update staff" ON public.staff
  FOR UPDATE 
  TO authenticated 
  USING (
    (auth.jwt() ->> 'user_role') = 'ADMINSTAFF'
  );

-- ADMINSTAFF can delete staff records
CREATE POLICY "ADMINSTAFF can delete staff" ON public.staff
  FOR DELETE 
  TO authenticated 
  USING (
    (auth.jwt() ->> 'user_role') = 'ADMINSTAFF'
  );

-- TUTORS can update their own record
CREATE POLICY "TUTOR can update own record" ON public.staff
  FOR UPDATE 
  TO authenticated 
  USING (
    user_id = auth.uid() 
    AND (auth.jwt() ->> 'user_role') = 'TUTOR'
  );

-- Add comment to document the fix
COMMENT ON TABLE public.staff IS 'Staff table with JWT-only RLS policies to avoid circular dependencies'; 