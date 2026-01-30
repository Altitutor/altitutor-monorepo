-- ========================
-- CREATE MESSAGE ATTACHMENTS TABLE
-- ========================
-- This migration creates a table for storing message attachments (images, files, etc.)
-- Attachments are stored in Supabase Storage, and we store the URLs here.

-- Create message_attachments table
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  storage_url TEXT NOT NULL, -- Supabase Storage URL
  filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON public.message_attachments(message_id);
