-- Create rich_text_templates table for TipTap/ProseMirror JSON templates
-- Used in issues, projects, tasks, notes, notes_documents

CREATE TABLE public.rich_text_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  content JSONB NOT NULL,
  created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rich_text_templates_created_by ON public.rich_text_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_rich_text_templates_updated_at ON public.rich_text_templates(updated_at DESC);

ALTER TABLE public.rich_text_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMINSTAFF active can select"
  ON public.rich_text_templates
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_adminstaff_active()));

CREATE POLICY "ADMINSTAFF active can insert"
  ON public.rich_text_templates
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_adminstaff_active()));

CREATE POLICY "ADMINSTAFF active can update"
  ON public.rich_text_templates
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

CREATE POLICY "ADMINSTAFF active can delete"
  ON public.rich_text_templates
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_adminstaff_active()));

DROP TRIGGER IF EXISTS set_updated_at_rich_text_templates ON public.rich_text_templates;
CREATE TRIGGER set_updated_at_rich_text_templates
  BEFORE UPDATE ON public.rich_text_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
