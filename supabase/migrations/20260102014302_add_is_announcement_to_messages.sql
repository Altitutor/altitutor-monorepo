-- Add is_announcement column to messages table to distinguish announcement messages
-- Announcement messages will use alphanumeric sender ID "ALTITUTOR" instead of phone number
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_announcement BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for filtering announcement messages if needed
CREATE INDEX IF NOT EXISTS idx_messages_is_announcement ON public.messages(is_announcement)
  WHERE is_announcement = TRUE;
