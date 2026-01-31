-- ========================
-- ADD RLS POLICIES FOR IMESSAGE TABLES AND STORAGE
-- ========================
-- This migration adds RLS policies for:
--   - group_chat_participants table (admin only)
--   - message_attachments table (admin only)
--   - messages-media storage bucket (admin only)

-- ========================
-- ENABLE RLS ON TABLES
-- ========================

-- Enable RLS on group_chat_participants table
ALTER TABLE public.group_chat_participants ENABLE ROW LEVEL SECURITY;

-- Enable RLS on message_attachments table
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

-- ========================
-- CREATE RLS POLICIES FOR TABLES
-- ========================

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "ADMINSTAFF full access to group_chat_participants" ON public.group_chat_participants;
DROP POLICY IF EXISTS "ADMINSTAFF full access to message_attachments" ON public.message_attachments;

-- Create RLS policy for group_chat_participants
CREATE POLICY "ADMINSTAFF full access to group_chat_participants"
ON public.group_chat_participants
FOR ALL
TO authenticated
USING ((SELECT public.is_adminstaff_active()))
WITH CHECK ((SELECT public.is_adminstaff_active()));

-- Create RLS policy for message_attachments
CREATE POLICY "ADMINSTAFF full access to message_attachments"
ON public.message_attachments
FOR ALL
TO authenticated
USING ((SELECT public.is_adminstaff_active()))
WITH CHECK ((SELECT public.is_adminstaff_active()));

-- ========================
-- CREATE RLS POLICIES FOR STORAGE BUCKET
-- ========================
-- Note: The messages-media bucket should already exist from migration 20260130111553
-- This ensures the RLS policies are properly set up

DO $$
BEGIN
  -- Drop existing policies if they exist (idempotent)
  BEGIN
    DROP POLICY IF EXISTS "ADMINSTAFF full access to messages-media" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Service role can upload to messages-media" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ADMINSTAFF: Full access (for management/deletion)
  BEGIN
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to messages-media"
      ON storage.objects
      FOR ALL
      TO authenticated
      USING (
        bucket_id = ''messages-media'' AND
        (SELECT public.is_adminstaff_active())
      )
      WITH CHECK (
        bucket_id = ''messages-media'' AND
        (SELECT public.is_adminstaff_active())
      )';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping ADMINSTAFF policy creation - insufficient privileges';
  END;

  -- Service role: Can upload (for iMessage bridge webhook)
  -- Note: Service role typically bypasses RLS, but we add this for completeness
  BEGIN
    EXECUTE 'CREATE POLICY "Service role can upload to messages-media"
      ON storage.objects
      FOR INSERT
      TO service_role
      WITH CHECK (bucket_id = ''messages-media'')';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping service role INSERT policy creation - insufficient privileges';
  END;
END $$;
