-- Fix RLS policies for files table
-- The issue: policies were checking for 'ADMIN' role but should check for 'ADMINSTAFF'

DROP POLICY IF EXISTS admin_all_files ON files;

-- Files policies (admin and staff access for inserts, admin-only for updates/deletes)
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

