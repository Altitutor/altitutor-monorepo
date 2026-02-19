-- Remove message_id and conversation_id from issue_tags as we now tag entities (student, staff, parent) directly
ALTER TABLE issue_tags DROP COLUMN IF EXISTS message_id;
ALTER TABLE issue_tags DROP COLUMN IF EXISTS conversation_id;

-- Ensure created_at has a default if it doesn't already
ALTER TABLE issue_tags ALTER COLUMN created_at SET DEFAULT now();
