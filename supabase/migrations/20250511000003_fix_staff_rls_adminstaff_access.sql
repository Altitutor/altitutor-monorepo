-- Fix RLS policies for staff table to ensure ADMINSTAFF users can see all staff records
-- Issue: ADMINSTAFF users can only see their own record instead of all staff records

-- Drop ALL existing policies for staff table to start fresh
DROP POLICY IF EXISTS "Allow adminstaff to read all staff" ON public.staff;
DROP POLICY IF EXISTS "Allow staff to read own record" ON public.staff;
DROP POLICY IF EXISTS "Allow staff to read staff data" ON public.staff;
DROP POLICY IF EXISTS "Allow adminstaff to insert staff" ON public.staff;
DROP POLICY IF EXISTS "Allow adminstaff to update staff" ON public.staff;
DROP POLICY IF EXISTS "Allow adminstaff to delete staff" ON public.staff;
DROP POLICY IF EXISTS "Allow tutors to read own record" ON public.staff;
DROP POLICY IF EXISTS "Allow tutors to update own record" ON public.staff;
DROP POLICY IF EXISTS "Allow adminstaff to insert staff" ON public.staff;
DROP POLICY IF EXISTS "Allow adminstaff to update any staff" ON public.staff;
DROP POLICY IF EXISTS "Allow adminstaff to delete staff" ON public.staff;
DROP POLICY IF EXISTS "Allow tutors to update their own staff_subjects" ON public.staff;

-- Create comprehensive policy that covers all scenarios for ADMINSTAFF access
CREATE POLICY "Allow adminstaff full staff access" ON public.staff
  FOR SELECT 
  TO authenticated 
  USING (
    -- Method 1: Check custom claim from JWT (primary method)
    (auth.jwt() ->> 'user_role') = 'ADMINSTAFF'
    OR
    -- Method 2: Check staff table role directly (fallback method)
    EXISTS (
      SELECT 1 FROM staff current_staff
      WHERE current_staff.user_id = auth.uid() 
        AND current_staff.role = 'ADMINSTAFF'
    )
  );

-- Create policy for tutors to read their own record
CREATE POLICY "Allow tutors to read own record" ON public.staff
  FOR SELECT 
  TO authenticated 
  USING (
    -- Allow tutors to see their own record
    user_id = auth.uid()
    AND (
      -- Check custom claim
      (auth.jwt() ->> 'user_role') = 'TUTOR'
      OR
      -- Check staff table role
      role = 'TUTOR'
    )
  );

-- Create write policies for ADMINSTAFF
CREATE POLICY "Allow adminstaff to insert staff" ON public.staff
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'ADMINSTAFF'
    OR
    EXISTS (
      SELECT 1 FROM staff current_staff
      WHERE current_staff.user_id = auth.uid() 
        AND current_staff.role = 'ADMINSTAFF'
    )
  );

CREATE POLICY "Allow adminstaff to update staff" ON public.staff
  FOR UPDATE 
  TO authenticated 
  USING (
    (auth.jwt() ->> 'user_role') = 'ADMINSTAFF'
    OR
    EXISTS (
      SELECT 1 FROM staff current_staff
      WHERE current_staff.user_id = auth.uid() 
        AND current_staff.role = 'ADMINSTAFF'
    )
  );

CREATE POLICY "Allow adminstaff to delete staff" ON public.staff
  FOR DELETE 
  TO authenticated 
  USING (
    (auth.jwt() ->> 'user_role') = 'ADMINSTAFF'
    OR
    EXISTS (
      SELECT 1 FROM staff current_staff
      WHERE current_staff.user_id = auth.uid() 
        AND current_staff.role = 'ADMINSTAFF'
    )
  );

-- Allow tutors to update their own record
CREATE POLICY "Allow tutors to update own record" ON public.staff
  FOR UPDATE 
  TO authenticated 
  USING (
    user_id = auth.uid()
    AND (
      (auth.jwt() ->> 'user_role') = 'TUTOR'
      OR
      role = 'TUTOR'
    )
  );

-- Add comment to document the fix
COMMENT ON TABLE public.staff IS 'Staff table with comprehensive RLS policies supporting both JWT claims and database role checking for ADMINSTAFF access'; 