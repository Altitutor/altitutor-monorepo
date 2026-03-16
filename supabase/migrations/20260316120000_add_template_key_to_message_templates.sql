-- Add template_key to message_templates for system templates
-- System templates: template_key set (e.g. booking_confirmation, absence_notification)
-- User templates: template_key = null (current behavior)

ALTER TABLE message_templates
  ADD COLUMN IF NOT EXISTS template_key TEXT UNIQUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_templates_template_key
  ON message_templates (template_key)
  WHERE template_key IS NOT NULL;

COMMENT ON COLUMN message_templates.template_key IS 'System template identifier. Null for user-created templates.';
