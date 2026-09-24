-- Class schedule mutations run as the authenticated ADMINSTAFF caller. Keep bearer-token
-- tombstones private while allowing the bounded pristine-session check to inspect them.
CREATE OR REPLACE FUNCTION public.is_pristine_generated_class_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
     AND NOT (SELECT public.is_adminstaff_active()) THEN
    RAISE EXCEPTION 'ADMINSTAFF access required' USING ERRCODE = '42501';
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.sessions s
    WHERE s.id = p_session_id
      AND s.type = 'CLASS'
      AND s.schedule_origin IN ('GENERATED', 'CUSTOM')
      AND NOT s.is_schedule_exception
      AND s.original_start_at = s.start_at
      AND s.original_end_at = s.end_at
      AND NOT EXISTS (
        SELECT 1
        FROM public.sessions_students ss
        WHERE ss.session_id = s.id
          AND (ss.planned_absence OR ss.is_rescheduled OR ss.is_credited OR ss.was_trial)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.sessions_staff ss
        WHERE ss.session_id = s.id
          AND (ss.planned_absence OR ss.is_swapped OR ss.was_trial)
      )
      AND NOT EXISTS (SELECT 1 FROM public.tutor_logs tl WHERE tl.session_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.sessions_files sf WHERE sf.session_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.ucat_sessions_resources usr WHERE usr.session_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.invoice_items ii WHERE ii.session_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.form_responses fr WHERE fr.session_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.sessions_parents sp WHERE sp.session_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.public_link_revocations plr WHERE plr.session_id = s.id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_pristine_generated_class_session(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_pristine_generated_class_session(UUID)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.is_pristine_generated_class_session(UUID) IS
  'Returns whether a generated Class Session has no exception or independently authored operational data without exposing private public-link tombstones.';

-- The cleanup routine is an internal SECURITY DEFINER function and is deliberately not an
-- authenticated RPC. Run it through its database trigger's definer boundary instead of granting
-- browser callers permission to invoke it directly.
CREATE OR REPLACE FUNCTION public.trigger_cleanup_session_files()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.cleanup_session_files(OLD.id);
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_cleanup_session_files()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.trigger_cleanup_session_files() IS
  'Runs the private session-file cleanup routine when a Session is deleted.';
