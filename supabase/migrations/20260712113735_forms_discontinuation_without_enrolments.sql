-- The prior workflow migration is already applied in development. Repair its
-- seed-version pointers and make a no-class discontinuation complete on form submit.
UPDATE public.forms forms
SET latest_published_version_id = versions.id
FROM public.form_versions versions
WHERE forms.workflow_key IS NOT NULL
  AND forms.latest_published_version_id IS NULL
  AND versions.form_id = forms.id
  AND versions.version_number = 1;

CREATE OR REPLACE FUNCTION public.complete_no_class_discontinuation_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NEW.status = 'completed'
     AND OLD.status = 'pending'
     AND NEW.workflow_key = 'student_discontinuation'
     AND NOT EXISTS (
       SELECT 1 FROM public.student_exit_request_enrolments
       WHERE student_exit_request_id = NEW.id
     ) THEN
    SELECT public.discontinue_student(NEW.student_id, NEW.requested_by) INTO v_result;
    IF NOT COALESCE((v_result->>'success')::boolean, false) THEN
      RAISE EXCEPTION '%', COALESCE(v_result->>'error', 'Could not discontinue student');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS complete_no_class_discontinuation_request ON public.student_exit_requests;
CREATE TRIGGER complete_no_class_discontinuation_request
AFTER UPDATE OF status ON public.student_exit_requests
FOR EACH ROW EXECUTE FUNCTION public.complete_no_class_discontinuation_request();
