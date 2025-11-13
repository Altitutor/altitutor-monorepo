-- Create message_templates table
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_message_templates_created_by ON message_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_message_templates_is_active ON message_templates(is_active);

-- Enable RLS
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Use standard ADMINSTAFF active pattern
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

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_message_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_message_templates_updated_at_trigger
  BEFORE UPDATE ON message_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_message_templates_updated_at();


