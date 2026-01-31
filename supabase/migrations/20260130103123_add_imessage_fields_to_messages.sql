-- ========================
-- ADD IMESSAGE FIELDS TO MESSAGES
-- ========================
-- This migration adds iMessage-specific fields to the messages table,
-- including GUID for unique identification and reaction/tapback support.

-- Add iMessage-specific fields
ALTER TABLE public.messages
ADD COLUMN imessage_guid TEXT; -- iMessage GUID (unique identifier)

-- Add index for GUID lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_imessage_guid ON public.messages(imessage_guid) WHERE imessage_guid IS NOT NULL;

-- Add reaction/tapback support (for future)
ALTER TABLE public.messages
ADD COLUMN is_reaction BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.messages
ADD COLUMN reaction_type TEXT CHECK (reaction_type IN ('love', 'like', 'dislike', 'laugh', 'emphasize', 'question'));

ALTER TABLE public.messages
ADD COLUMN associated_message_guid TEXT; -- For reactions, link to original message
