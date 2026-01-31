-- ========================
-- UPDATE MESSAGES-MEDIA BUCKET
-- ========================
-- This migration:
--   1. Changes the bucket from public to private
--   2. Adds missing MIME types for iMessage attachments
--   3. Adds SELECT policy for ADMINSTAFF to read files (required since bucket is now private)

-- ========================
-- UPDATE BUCKET CONFIGURATION
-- ========================

UPDATE storage.buckets
SET 
  public = false,  -- Make bucket private (RLS policies control access)
  allowed_mime_types = ARRAY[
    -- Images
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/tiff',  -- Added
    'image/bmp',   -- Added
    -- Videos
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv',
    'video/x-m4v',  -- Added (iTunes video format)
    -- Audio
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/x-m4a',
    'audio/aac',      -- Added
    'audio/x-aiff',   -- Added (Apple audio format)
    'audio/x-caf',    -- Added (Core Audio Format)
    -- Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/rtf',  -- Added (Rich Text Format)
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
WHERE id = 'messages-media';

-- ========================
-- ADD SELECT POLICY FOR ADMINSTAFF
-- ========================
-- Since the bucket is now private, we need an explicit SELECT policy
-- for ADMINSTAFF to read files

DO $$
BEGIN
  -- Drop existing SELECT policy if it exists (idempotent)
  BEGIN
    DROP POLICY IF EXISTS "ADMINSTAFF can read files from messages-media" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ADMINSTAFF: SELECT (read) access
  BEGIN
    EXECUTE 'CREATE POLICY "ADMINSTAFF can read files from messages-media"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = ''messages-media'' AND
        (SELECT public.is_adminstaff_active())
      )';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping ADMINSTAFF SELECT policy creation - insufficient privileges';
  END;
END $$;
