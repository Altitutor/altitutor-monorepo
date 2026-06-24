-- Single-editor locks for document notes.
CREATE TABLE IF NOT EXISTS public.note_document_edit_locks (
  note_id uuid PRIMARY KEY REFERENCES public.notes_documents(id) ON DELETE CASCADE,
  locked_by uuid NOT NULL REFERENCES public.staff(id),
  lock_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_note_document_edit_locks_updated_at
  ON public.note_document_edit_locks(updated_at DESC);

ALTER TABLE public.note_document_edit_locks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can read note document edit locks"
    ON public.note_document_edit_locks
    FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can create note document edit locks"
    ON public.note_document_edit_locks
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can update note document edit locks"
    ON public.note_document_edit_locks
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  CREATE POLICY "Authenticated users can delete note document edit locks"
    ON public.note_document_edit_locks
    FOR DELETE
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.note_document_edit_locks';
  EXCEPTION WHEN others THEN NULL; END;
END $$;
