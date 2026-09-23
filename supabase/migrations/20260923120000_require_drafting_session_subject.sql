-- Drafting sessions are subject-specific even though they are not attached to a Class.
-- Existing historical rows cannot be backfilled reliably, so retain them while enforcing
-- the invariant for every new or updated Drafting session.
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_drafting_subject_required_check
  CHECK (
    type <> 'DRAFTING'::public.session_type
    OR subject_id IS NOT NULL
  ) NOT VALID;

COMMENT ON CONSTRAINT sessions_drafting_subject_required_check ON public.sessions IS
  'Drafting sessions must store their selected Subject directly on the Session.';
