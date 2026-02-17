-- Migration: Standardize rich-text fields to JSONB with search vectors
-- Description: Convert tasks.description and notes_documents.content to JSONB, add search vectors to tasks and issues

-- Helper function for safe conversion
CREATE OR REPLACE FUNCTION public.migrate_text_to_tiptap_jsonb(val TEXT)
RETURNS JSONB AS $$
BEGIN
  IF val IS NULL OR val = '' THEN
    RETURN NULL;
  END IF;
  
  -- Try to parse as JSON (if it's already JSON from new app versions)
  BEGIN
    -- Check if it looks like a JSON object or array
    IF val ~ '^\s*\{' OR val ~ '^\s*\[' THEN
      RETURN val::jsonb;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Fall through to wrapping
  END;

  -- Not valid JSON or doesn't look like JSON, wrap it in Tiptap structure
  RETURN jsonb_build_object(
    'type', 'doc', 
    'content', jsonb_build_array(
      jsonb_build_object(
        'type', 'paragraph', 
        'content', jsonb_build_array(
          jsonb_build_object('type', 'text', 'text', val)
        )
      )
    )
  );
END;
$$ LANGUAGE plpgsql;

-- 1. Convert tasks.description to JSONB
ALTER TABLE public.tasks ALTER COLUMN description TYPE JSONB USING public.migrate_text_to_tiptap_jsonb(description);

-- 2. Convert notes_documents.content to JSONB
-- Handle existing default and type conversion
ALTER TABLE public.notes_documents ALTER COLUMN content DROP DEFAULT;
ALTER TABLE public.notes_documents ALTER COLUMN content TYPE JSONB USING public.migrate_text_to_tiptap_jsonb(content);
ALTER TABLE public.notes_documents ALTER COLUMN content SET DEFAULT NULL;

-- 3. Add search_vector to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION public.update_tasks_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  content_text TEXT;
BEGIN
  content_text := public.extract_text_from_prosemirror_json(NEW.description);
  
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(content_text, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tasks_search_vector ON public.tasks;
CREATE TRIGGER update_tasks_search_vector
BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.update_tasks_search_vector();

-- 4. Add search_vector to issues
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION public.update_issues_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  content_text TEXT;
BEGIN
  content_text := public.extract_text_from_prosemirror_json(NEW.description);
  
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(content_text, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_issues_search_vector ON public.issues;
CREATE TRIGGER update_issues_search_vector
BEFORE INSERT OR UPDATE ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.update_issues_search_vector();

-- 5. Update existing notes_documents search vector function to use JSONB directly
CREATE OR REPLACE FUNCTION public.update_notes_documents_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  content_text TEXT;
BEGIN
  content_text := public.extract_text_from_prosemirror_json(NEW.content);
  
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(content_text, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create indexes for search vectors
CREATE INDEX IF NOT EXISTS idx_tasks_search_vector ON public.tasks USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_issues_search_vector ON public.issues USING GIN(search_vector);

-- 7. Trigger search vector update for existing rows
UPDATE public.tasks SET updated_at = NOW();
UPDATE public.issues SET updated_at = NOW();
UPDATE public.notes_documents SET updated_at = NOW();

-- 8. Clean up helper function
DROP FUNCTION IF EXISTS public.migrate_text_to_tiptap_jsonb(TEXT);
