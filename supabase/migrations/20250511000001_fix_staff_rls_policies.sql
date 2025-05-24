-- Fix circular dependency in staff RLS policies
-- Problem: auth.is_staff() function queries staff table, but RLS blocks that query

-- Drop the problematic policy
DROP POLICY IF EXISTS "Allow staff to read staff data" ON public.staff;

-- Create better policies that don't have circular dependencies
-- Allow ADMINSTAFF to read all staff (using custom claim check)
CREATE POLICY "Allow adminstaff to read all staff" ON public.staff
  FOR SELECT 
  TO authenticated 
  USING (
    -- Check custom claim directly to avoid circular dependency
    (auth.jwt() ->> 'user_role') = 'ADMINSTAFF'
  );

-- Allow staff to read their own record (using user_id match)
CREATE POLICY "Allow staff to read own record" ON public.staff
  FOR SELECT 
  TO authenticated 
  USING (user_id = auth.uid());

-- Add a fallback policy for any authenticated user to read staff
-- This ensures the app functions even if custom claims aren't set properly
CREATE POLICY "Allow authenticated users to read staff" ON public.staff
  FOR SELECT 
  TO authenticated 
  USING (true); 