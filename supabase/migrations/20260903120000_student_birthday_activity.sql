-- Birthday is an explicit student profile lifecycle property. Keep this narrow:
-- ordinary student row updates must not become generic activity noise.

CREATE OR REPLACE FUNCTION public.capture_student_birthday_domain_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF OLD.birthday IS DISTINCT FROM NEW.birthday THEN
    PERFORM public.record_domain_event(
      'student.properties_changed',
      'student',
      NEW.id,
      jsonb_build_array(public.domain_event_entity(
        'student',
        NEW.id,
        'subject',
        BTRIM(CONCAT_WS(' ', NEW.first_name, NEW.last_name))
      )),
      jsonb_build_object(
        'changes',
        jsonb_build_object(
          'birthday',
          jsonb_build_object('old', OLD.birthday, 'new', NEW.birthday)
        )
      ),
      NOW(),
      public.current_staff_id()
    );
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.capture_student_birthday_domain_event()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_student_birthday_domain_event()
  TO service_role, postgres;

CREATE TRIGGER domain_event_capture_student_birthday
AFTER UPDATE OF birthday ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.capture_student_birthday_domain_event();

COMMENT ON FUNCTION public.capture_student_birthday_domain_event() IS
  'Records the explicitly allowlisted student birthday property lifecycle event.';
