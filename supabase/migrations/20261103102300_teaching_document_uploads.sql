-- Teaching snapshots never enter the resource catalog or the general session-files bucket.
CREATE TABLE public.teaching_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('print', 'lesson')),
  canonical_topics_file_id uuid REFERENCES public.topics_files(id) ON DELETE RESTRICT,
  filename text NOT NULL CHECK (length(filename) BETWEEN 1 AND 180),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 52428800),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  bucket text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_id uuid REFERENCES public.files(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'staged' CHECK (state IN ('staged', 'ready', 'published', 'deleting', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  tutor_log_id uuid REFERENCES public.tutor_logs(id) ON DELETE RESTRICT,
  published_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  deleted_at timestamptz,
  cleanup_claimed_at timestamptz,
  cleanup_attempts integer NOT NULL DEFAULT 0,
  cleanup_next_attempt_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((purpose = 'print' AND bucket = 'teaching-print') OR (purpose = 'lesson' AND bucket = 'teaching-lessons')),
  CHECK (tutor_log_id IS NULL OR purpose = 'lesson')
);
CREATE INDEX teaching_documents_owner_snapshot ON public.teaching_documents
  (owner_staff_id, session_id, document_id, purpose, sha256, created_at DESC);
CREATE INDEX teaching_documents_log ON public.teaching_documents(tutor_log_id) WHERE tutor_log_id IS NOT NULL;
CREATE INDEX teaching_documents_expiry ON public.teaching_documents(expires_at) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX teaching_documents_print_file ON public.teaching_documents(file_id) WHERE file_id IS NOT NULL;
ALTER TABLE public.teaching_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ADMINSTAFF read teaching documents" ON public.teaching_documents FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()));
REVOKE ALL ON public.teaching_documents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.teaching_documents TO authenticated;
GRANT ALL ON public.teaching_documents TO service_role;

-- Like existing tutor views, this is an explicit scoped projection, not a base-table grant.
CREATE VIEW public.vtutor_teaching_uploads WITH (security_invoker = false) AS
SELECT id, owner_staff_id, session_id, document_id, purpose, canonical_topics_file_id,
       filename, size_bytes, sha256, state, expires_at, file_id
FROM public.teaching_documents
WHERE owner_staff_id = (SELECT public.current_tutor_id()) AND (SELECT public.is_tutor())
  AND deleted_at IS NULL;
REVOKE ALL ON public.vtutor_teaching_uploads FROM PUBLIC, anon;
GRANT SELECT ON public.vtutor_teaching_uploads TO authenticated;

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('teaching-print', 'teaching-print', false, 52428800, ARRAY['application/pdf']),
       ('teaching-lessons', 'teaching-lessons', false, 52428800, ARRAY['application/pdf']);
-- No direct client Storage read/write policies. The server issues immutable signed uploads
-- and authorizes each short-lived download; print-bridge uses its existing service client.
