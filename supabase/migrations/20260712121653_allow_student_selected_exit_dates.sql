ALTER TABLE public.student_exit_request_enrolments
  ALTER COLUMN final_session_at DROP NOT NULL,
  ALTER COLUMN unenrolled_at DROP NOT NULL;

COMMENT ON COLUMN public.student_exit_request_enrolments.final_session_at IS
  'The final session selected by the student. Null until an unenrolment-link recipient submits the request.';
COMMENT ON COLUMN public.student_exit_request_enrolments.unenrolled_at IS
  'The effective unenrolment timestamp immediately after the selected final session. Null until selected.';

CREATE OR REPLACE FUNCTION public.require_student_exit_request_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND OLD.status = 'pending'
     AND NEW.workflow_key = 'student_unenrolment'
     AND EXISTS (
       SELECT 1
       FROM public.student_exit_request_enrolments
       WHERE student_exit_request_id = NEW.id
         AND (final_session_at IS NULL OR unenrolled_at IS NULL)
     ) THEN
    RAISE EXCEPTION 'Choose the final session for each class.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_student_exit_request_dates ON public.student_exit_requests;
CREATE TRIGGER require_student_exit_request_dates
BEFORE UPDATE OF status ON public.student_exit_requests
FOR EACH ROW EXECUTE FUNCTION public.require_student_exit_request_dates();

REVOKE ALL ON FUNCTION public.require_student_exit_request_dates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.require_student_exit_request_dates() TO service_role;
