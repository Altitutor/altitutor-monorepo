-- A trial Student may manage either supported onboarding booking type.
-- Keep the literal legacy seam so the separately held DEV-210 migration can
-- still apply later, without publishing any of its unrelated booking changes.
DO $migration$
DECLARE
  definition text;
  legacy text := 'v_student_status = ''TRIAL'' AND p_session_type != ''TRIAL_SESSION''';
  permitted text := 'v_student_status = ''TRIAL'' AND p_session_type NOT IN (''TRIAL_SESSION'', ''SUBSIDY_INTERVIEW'')';
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.reschedule_session(uuid,uuid,public.session_type,timestamptz,timestamptz,uuid,uuid,uuid,uuid,boolean)'::pg_catalog.regprocedure
  ) INTO definition;
  IF pg_catalog.strpos(definition, permitted) > 0 THEN
    RETURN;
  END IF;
  IF pg_catalog.strpos(definition, legacy) = 0 THEN
    RAISE EXCEPTION 'Unrecognized trial reschedule eligibility definition';
  END IF;
  definition := pg_catalog.replace(definition, legacy,
    legacy || ' AND p_session_type != ''SUBSIDY_INTERVIEW''');
  definition := pg_catalog.replace(definition,
    '-- TRIAL students can only reschedule TRIAL_SESSION',
    '-- TRIAL students can reschedule trial sessions and subsidy interviews');
  EXECUTE definition;
END;
$migration$;
