-- Migration: Create daily notes table
-- Description: Adds notes_daily for per-day dashboard notes with autosave support
-- Author: AI Assistant
-- Date: 2026-02-19

CREATE TABLE public.notes_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  content JSONB NOT NULL DEFAULT '""'::jsonb,
  updated_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_vector tsvector
);

CREATE INDEX idx_notes_daily_date ON public.notes_daily(date);
CREATE INDEX idx_notes_daily_updated_by ON public.notes_daily(updated_by) WHERE updated_by IS NOT NULL;
CREATE INDEX idx_notes_daily_updated_at ON public.notes_daily(updated_at DESC);

CREATE OR REPLACE FUNCTION public.update_notes_daily_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.content::text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_notes_daily_search_vector ON public.notes_daily;
CREATE TRIGGER update_notes_daily_search_vector
BEFORE INSERT OR UPDATE ON public.notes_daily
FOR EACH ROW EXECUTE FUNCTION public.update_notes_daily_search_vector();

CREATE INDEX idx_notes_daily_search_vector ON public.notes_daily USING GIN(search_vector);

ALTER TABLE public.notes_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to notes_daily" ON public.notes_daily;
CREATE POLICY "ADMINSTAFF full access to notes_daily" ON public.notes_daily
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP TRIGGER IF EXISTS set_updated_at_notes_daily ON public.notes_daily;
CREATE TRIGGER set_updated_at_notes_daily
BEFORE UPDATE ON public.notes_daily
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
