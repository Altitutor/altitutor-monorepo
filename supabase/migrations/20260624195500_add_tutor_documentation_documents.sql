-- Add tutor-facing documentation support for selected internal documents.

ALTER TABLE public.notes_documents
  ADD COLUMN IF NOT EXISTS is_tutor_documentation boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_notes_documents_tutor_documentation
  ON public.notes_documents (is_tutor_documentation)
  WHERE is_tutor_documentation = true;

CREATE OR REPLACE FUNCTION public.is_notes_folder_tutor_documentation_ancestor(folder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE descendants AS (
    SELECT nf.id
    FROM public.notes_folders nf
    WHERE nf.id = folder_id

    UNION ALL

    SELECT child.id
    FROM public.notes_folders child
    INNER JOIN descendants parent ON child.parent_id = parent.id
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.notes_documents nd
    WHERE nd.is_tutor_documentation = true
      AND nd.folder_id IN (SELECT id FROM descendants)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_notes_folder_tutor_documentation_ancestor(uuid) TO authenticated;

DROP POLICY IF EXISTS "Tutors can read tutor documentation documents" ON public.notes_documents;
CREATE POLICY "Tutors can read tutor documentation documents" ON public.notes_documents
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_tutor())
    AND is_tutor_documentation = true
  );

DROP POLICY IF EXISTS "Tutors can read tutor documentation folders" ON public.notes_folders;
CREATE POLICY "Tutors can read tutor documentation folders" ON public.notes_folders
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_tutor())
    AND public.is_notes_folder_tutor_documentation_ancestor(id)
  );

COMMENT ON COLUMN public.notes_documents.is_tutor_documentation IS
  'When true, this document is visible read-only in tutor-web Documentation.';
