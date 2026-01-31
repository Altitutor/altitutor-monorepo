-- ========================
-- ADD GROUP CHAT SUPPORT
-- ========================
-- This migration adds support for group chats in conversations.
-- Group chats don't have a single contact_id, so we make it nullable
-- and use group_chat_id instead.

-- 1. Make contact_id nullable (required for group chats)
ALTER TABLE public.conversations
ALTER COLUMN contact_id DROP NOT NULL;

-- 2. Add group chat fields to conversations
ALTER TABLE public.conversations
ADD COLUMN is_group_chat BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.conversations
ADD COLUMN group_chat_id TEXT; -- iMessage chatId (unique for groups)

ALTER TABLE public.conversations
ADD COLUMN group_chat_name TEXT; -- Display name for group chats

-- 3. Add constraint: if group chat, contact_id must be NULL and group_chat_id must be set
--    if individual chat, contact_id must be set and group_chat_id must be NULL
ALTER TABLE public.conversations
ADD CONSTRAINT conversations_group_chat_check 
CHECK (
  (is_group_chat = TRUE AND contact_id IS NULL AND group_chat_id IS NOT NULL) OR
  (is_group_chat = FALSE AND contact_id IS NOT NULL AND group_chat_id IS NULL)
);

-- 4. Create group chat participants table (junction table for many-to-many relationship)
CREATE TABLE IF NOT EXISTS public.group_chat_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_group_chat_participants_conversation 
ON public.group_chat_participants(conversation_id);

CREATE INDEX IF NOT EXISTS idx_group_chat_participants_contact 
ON public.group_chat_participants(contact_id);

-- 5. Update unique constraint for conversations
-- Drop existing constraint
DROP INDEX IF EXISTS conversations_one_active_per_number;

-- For individual chats: one active conversation per (contact, owned_number)
CREATE UNIQUE INDEX conversations_one_active_per_number_individual
ON public.conversations(contact_id, owned_number_id)
WHERE status IN ('OPEN','SNOOZED') AND is_group_chat = FALSE;

-- For group chats: one active conversation per (group_chat_id, owned_number)
CREATE UNIQUE INDEX conversations_one_active_per_number_group
ON public.conversations(group_chat_id, owned_number_id)
WHERE status IN ('OPEN','SNOOZED') AND is_group_chat = TRUE;
