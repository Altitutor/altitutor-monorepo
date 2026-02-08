-- Migration: Update notes_documents to store ProseMirror JSON instead of Markdown
-- Description: Update search_vector function to extract text from ProseMirror JSON structure
-- Date: 2026-02-08

-- ========================
-- UPDATE SEARCH VECTOR FUNCTION
-- ========================
-- Create function to safely parse text as JSONB (returns NULL if invalid JSON)
CREATE OR REPLACE FUNCTION public.safe_text_to_jsonb(text_content TEXT)
RETURNS JSONB AS $$
BEGIN
  IF text_content IS NULL OR text_content = '' THEN
    RETURN NULL;
  END IF;
  
  BEGIN
    RETURN text_content::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to extract text from ProseMirror JSON structure
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

-- Update the search vector function to handle both JSON and text
CREATE OR REPLACE FUNCTION public.update_notes_documents_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  content_text TEXT;
  content_jsonb JSONB;
BEGIN
  -- Extract text from content
  -- Try to parse as JSON first (ProseMirror format)
  content_jsonb := public.safe_text_to_jsonb(NEW.content);
  
  IF content_jsonb IS NOT NULL THEN
    -- Successfully parsed as JSON, extract text from ProseMirror structure
    content_text := public.extract_text_from_prosemirror_json(content_jsonb);
  ELSE
    -- Not valid JSON, treat as plain text (backward compatibility with existing markdown)
    content_text := COALESCE(NEW.content, '');
  END IF;

  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(content_text, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update existing search_vector for all notes (in case there's existing data)
UPDATE public.notes_documents
SET search_vector = 
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', 
    CASE 
      WHEN content IS NULL OR content = '' THEN ''
      ELSE COALESCE(
        public.extract_text_from_prosemirror_json(public.safe_text_to_jsonb(content)),
        content  -- Fallback to plain text if JSON parsing fails or content is not JSON
      )
    END
  ), 'B');
