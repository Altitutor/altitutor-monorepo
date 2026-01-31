-- ========================
-- CREATE IMESSAGE MEDIA STORAGE BUCKET
-- ========================
-- This migration creates the messages-media bucket for storing iMessage attachments
-- The bucket is public so that images/files can be accessed directly via URLs

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'messages-media',
  'messages-media',
  true,  -- Public bucket so images can be displayed directly
  104857600,  -- 100MB limit (larger than session-files for videos/large images)
  ARRAY[
    -- Images
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    -- Videos
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv',
    -- Audio
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/x-m4a',
    -- Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    -- Other common types
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = EXCLUDED.public;

-- ========================
-- STORAGE RLS POLICIES
-- ========================
-- Note: Since bucket is public, we mainly need policies for INSERT/UPDATE/DELETE
-- Public bucket allows anyone to read files via URL

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
