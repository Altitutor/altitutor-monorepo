-- Fix overly permissive RLS policies to implement proper role-based access

-- 1. Fix STAFF table - Remove unrestricted access policy
DROP POLICY IF EXISTS "Allow authenticated users to read staff" ON public.staff;

-- 2. Fix SUBJECTS table - Remove unrestricted access policy  
DROP POLICY IF EXISTS "Anyone can view subjects" ON public.subjects;

-- Create proper role-based policy for subjects
CREATE POLICY "Allow role-based subject access" ON public.subjects
  FOR SELECT 
  TO authenticated 
  USING (
    -- ADMINSTAFF can read all subjects
    (auth.jwt() ->> 'user_role') = 'ADMINSTAFF'
    OR
    -- TUTORS can read subjects (they need to see curriculum for teaching)
    (auth.jwt() ->> 'user_role') = 'TUTOR'
  );

-- 3. Fix STUDENTS table - Remove unrestricted insert policy
DROP POLICY IF EXISTS "Anyone can insert students" ON public.students;

-- Create proper policy for student creation
CREATE POLICY "Allow adminstaff to insert students" ON public.students
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'ADMINSTAFF'
  );

-- 4. Update existing students SELECT policies to be role-based
-- Drop the overly broad policy if it exists
DROP POLICY IF EXISTS "Staff can view all student records" ON public.students;

-- Create more specific policy for tutors
CREATE POLICY "Allow tutors to read assigned students" ON public.students
  FOR SELECT 
  TO authenticated 
  USING (
    -- ADMINSTAFF can read all students
    (auth.jwt() ->> 'user_role') = 'ADMINSTAFF'
    OR
    -- TUTORS can read students in classes they teach via classes_students table
    (
      (auth.jwt() ->> 'user_role') = 'TUTOR'
      AND EXISTS (
        SELECT 1 FROM classes_students cs
        JOIN classes_staff cls ON cls.class_id = cs.class_id
        JOIN staff s ON s.id = cls.staff_id
        WHERE s.user_id = auth.uid() 
          AND cs.student_id = students.id
      )
    )
    OR
    -- Users can view their own student record
    user_id = auth.uid()
  ); 