-- Migration: Create admin-rich-text-images storage bucket with RLS policies
-- Description:
--  - Create admin-rich-text-images bucket for admin-web rich text images
--    (notes, notes_documents, projects, issues, tasks)
--  - Path format: {context}/{timestamp}_{uuid}_{filename}
--  - RLS: ADMINSTAFF full access (admin-web is staff-only)

-- ========================
-- CREATE STORAGE BUCKET
-- ========================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'admin-rich-text-images',
  'admin-rich-text-images',
  false,
  52428800,  -- 50MB, consistent with ucat-images and session-files
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ========================
-- STORAGE RLS POLICIES
-- ========================

DO $$
BEGIN
  DROP POLICY IF EXISTS "ADMINSTAFF full access to admin-rich-text-images" ON storage.objects;

  BEGIN
    EXECUTE 'CREATE POLICY "ADMINSTAFF full access to admin-rich-text-images"
      ON storage.objects
      FOR ALL
      TO authenticated
      USING (
        bucket_id = ''admin-rich-text-images'' AND
        (SELECT public.is_adminstaff_active())
      )
      WITH CHECK (
        bucket_id = ''admin-rich-text-images'' AND
        (SELECT public.is_adminstaff_active())
      )';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping ADMINSTAFF policy creation for admin-rich-text-images - insufficient privileges';
  END;
END $$;

-- ========================
-- UPDATE extract_text_from_prosemirror_json FOR IMAGE NODES
-- ========================
-- Image nodes have no meaningful text; return empty string to skip them.

CREATE OR REPLACE FUNCTION public.extract_text_from_prosemirror_json(json_content JSONB)
RETURNS TEXT AS $$
DECLARE
  result TEXT := '';
  node JSONB;
BEGIN
  -- Handle null or empty content
  IF json_content IS NULL OR json_content = 'null'::jsonb THEN
    RETURN '';
  END IF;

  -- If it's a text node, return the text
  IF json_content->>'type' = 'text' THEN
    RETURN COALESCE(json_content->>'text', '');
  END IF;

  -- If it's a mention node, return the label for text extraction
  IF json_content->>'type' = 'mention' AND json_content ? 'attrs' THEN
    RETURN COALESCE(json_content->'attrs'->>'label', '');
  END IF;

  -- Image nodes have no meaningful text; skip them
  IF json_content->>'type' = 'image' THEN
    RETURN '';
  END IF;

  -- Recursively process content array
  IF json_content ? 'content' AND jsonb_typeof(json_content->'content') = 'array' THEN
    FOR node IN SELECT * FROM jsonb_array_elements(json_content->'content')
    LOOP
      result := result || ' ' || public.extract_text_from_prosemirror_json(node);
    END LOOP;
  END IF;

  RETURN TRIM(result);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
