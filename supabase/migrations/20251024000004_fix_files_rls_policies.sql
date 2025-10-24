-- Fix RLS policies for files and topics_files tables
-- The issue: policies were checking for 'ADMIN' role but should check for 'ADMINSTAFF'

-- Fix files table policies
DROP POLICY IF EXISTS admin_all_files ON files;

CREATE POLICY adminstaff_all_files ON files
  FOR ALL
  TO authenticated
  USING (
    COALESCE(
      (SELECT role FROM staff WHERE staff.user_id = auth.uid()),
      ''
    ) = 'ADMINSTAFF'
  )
  WITH CHECK (
    COALESCE(
      (SELECT role FROM staff WHERE staff.user_id = auth.uid()),
      ''
    ) = 'ADMINSTAFF'
  );

-- Fix topics_files table policies
DROP POLICY IF EXISTS admin_all_topics_files ON topics_files;

CREATE POLICY adminstaff_all_topics_files ON topics_files
  FOR ALL
  TO authenticated
  USING (
    COALESCE(
      (SELECT role FROM staff WHERE staff.user_id = auth.uid()),
      ''
    ) = 'ADMINSTAFF'
  )
  WITH CHECK (
    COALESCE(
      (SELECT role FROM staff WHERE staff.user_id = auth.uid()),
      ''
    ) = 'ADMINSTAFF'
  );

