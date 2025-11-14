-- Ensure RLS policies for message_templates table are correctly set up
-- This migration ensures the policies match the standard pattern used by admin_only_rls

-- Drop any existing policies (idempotent)
DROP POLICY IF EXISTS "ADMINSTAFF active can select" ON message_templates;
DROP POLICY IF EXISTS "ADMINSTAFF active can insert" ON message_templates;
DROP POLICY IF EXISTS "ADMINSTAFF active can update" ON message_templates;
DROP POLICY IF EXISTS "ADMINSTAFF active can delete" ON message_templates;

-- Drop any old/non-standard policies that might exist
DROP POLICY IF EXISTS "Admin and Staff can view templates" ON message_templates;
DROP POLICY IF EXISTS "Admin and Staff can create templates" ON message_templates;
DROP POLICY IF EXISTS "Admin and Staff can update templates" ON message_templates;
DROP POLICY IF EXISTS "Admin and Staff can delete templates" ON message_templates;

-- Create policies using the standard ADMINSTAFF active pattern
CREATE POLICY "ADMINSTAFF active can select"
  ON message_templates
  FOR SELECT
  TO authenticated
  USING (public.is_adminstaff_active());

CREATE POLICY "ADMINSTAFF active can insert"
  ON message_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_adminstaff_active());

CREATE POLICY "ADMINSTAFF active can update"
  ON message_templates
  FOR UPDATE
  TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

CREATE POLICY "ADMINSTAFF active can delete"
  ON message_templates
  FOR DELETE
  TO authenticated
  USING (public.is_adminstaff_active());






