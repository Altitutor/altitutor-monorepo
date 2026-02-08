-- Migration: Create notes system
-- Description: Create notes_folders and notes_documents tables for Notion-like notes system
-- Author: AI Assistant
-- Date: 2026-02-08

-- ========================
-- CREATE notes_folders TABLE
-- ========================
CREATE TABLE public.notes_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.notes_folders(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================
-- CREATE INDEXES for notes_folders
-- ========================
CREATE INDEX idx_notes_folders_parent_id ON public.notes_folders(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_notes_folders_created_by ON public.notes_folders(created_by);
CREATE INDEX idx_notes_folders_created_at ON public.notes_folders(created_at DESC);

-- ========================
-- CREATE notes_documents TABLE
-- ========================
CREATE TABLE public.notes_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  folder_id UUID REFERENCES public.notes_folders(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.staff(id),
  updated_by UUID REFERENCES public.staff(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================
-- CREATE INDEXES for notes_documents
-- ========================
CREATE INDEX idx_notes_documents_folder_id ON public.notes_documents(folder_id) WHERE folder_id IS NOT NULL;
CREATE INDEX idx_notes_documents_created_by ON public.notes_documents(created_by);
CREATE INDEX idx_notes_documents_updated_by ON public.notes_documents(updated_by) WHERE updated_by IS NOT NULL;
CREATE INDEX idx_notes_documents_created_at ON public.notes_documents(created_at DESC);

-- ========================
-- CREATE FULL-TEXT SEARCH INDEX
-- ========================
-- Add tsvector column for full-text search
ALTER TABLE public.notes_documents ADD COLUMN search_vector tsvector;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION public.update_notes_documents_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update search vector
CREATE TRIGGER update_notes_documents_search_vector
BEFORE INSERT OR UPDATE ON public.notes_documents
FOR EACH ROW EXECUTE FUNCTION public.update_notes_documents_search_vector();

-- Create GIN index for full-text search
CREATE INDEX idx_notes_documents_search_vector ON public.notes_documents USING GIN(search_vector);

-- ========================
-- ENABLE RLS
-- ========================
ALTER TABLE public.notes_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes_documents ENABLE ROW LEVEL SECURITY;

-- ========================
-- CREATE RLS POLICIES
-- ========================
-- ADMINSTAFF: Full access (read/write)
-- Note: Wrapped in SELECT for performance (see: 20251114000003_fix_rls_performance_cache_adminstaff_check.sql)
DROP POLICY IF EXISTS "ADMINSTAFF full access to notes_folders" ON public.notes_folders;
CREATE POLICY "ADMINSTAFF full access to notes_folders" ON public.notes_folders
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to notes_documents" ON public.notes_documents;
CREATE POLICY "ADMINSTAFF full access to notes_documents" ON public.notes_documents
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- TUTOR: No access
-- STUDENT: No access
-- (No policies needed - default deny)

-- ========================
-- CREATE updated_at TRIGGERS
-- ========================
DROP TRIGGER IF EXISTS set_updated_at_notes_folders ON public.notes_folders;
CREATE TRIGGER set_updated_at_notes_folders
BEFORE UPDATE ON public.notes_folders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_notes_documents ON public.notes_documents;
CREATE TRIGGER set_updated_at_notes_documents
BEFORE UPDATE ON public.notes_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
