-- Service adapters temporarily attribute work to an explicit tutor/student.
-- Preserve the complete incoming context for later work in the same transaction.
-- Reuse the current definitions so validation, provenance, ACLs, and lifecycle
-- behavior stay intact. Fail closed if a target no longer has the expected body.
DO $migration$
DECLARE
  target regprocedure;
  original_source text;
  updated_source text;
  definition text;
  restore_before_return constant text := E'\\1PERFORM set_config(''request.jwt.claim.sub'', COALESCE(v_request_prior_subject, ''''), true);\n\\1PERFORM set_config(''request.jwt.claims'', COALESCE(v_request_prior_claims, ''''), true);\n\\1RETURN ';
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'public.create_tutor_log(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)'::regprocedure,
    'public.update_tutor_log(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb)'::regprocedure,
    'public.service_ucat_persist_generated_stem(uuid,integer,jsonb)'::regprocedure,
    'public.service_ucat_apply_verified_assessment_repair(uuid,timestamptz,jsonb,jsonb,jsonb,text,text,jsonb)'::regprocedure,
    'public.get_student_ucat_study_plan_generation_bundle(uuid)'::regprocedure
  ] LOOP
    SELECT prosrc, pg_get_functiondef(oid)
      INTO original_source, definition FROM pg_proc WHERE oid = target;
    IF original_source NOT LIKE '%DECLARE%'
       OR original_source NOT LIKE '%set_config(%'
       OR original_source LIKE '%v_request_prior_subject%'
       OR original_source ~* '\mRETURN[[:space:]]+(NEXT|QUERY)\M'
       OR original_source !~ '(?m)^[ \t]*RETURN ' THEN
      RAISE EXCEPTION 'Unexpected request-identity adapter body: %', target;
    END IF;
    updated_source := replace(original_source, 'DECLARE',
      E'DECLARE\n  v_request_prior_subject text := current_setting(''request.jwt.claim.sub'', true);\n  v_request_prior_claims text := current_setting(''request.jwt.claims'', true);');
    updated_source := regexp_replace(updated_source,
      '(?m)^([ \t]*)RETURN ', restore_before_return, 'g');
    IF target = 'public.get_student_ucat_study_plan_generation_bundle(uuid)'::regprocedure THEN
      -- auth.uid() prefers the legacy subject over claims. The bundle must
      -- evaluate its Student views as the selected Student, not the caller.
      IF updated_source NOT LIKE E'%  PERFORM set_config(\n    ''request.jwt.claims'',%' THEN
        RAISE EXCEPTION 'Unexpected Student bundle claims setter';
      END IF;
      updated_source := replace(updated_source,
        E'  PERFORM set_config(\n    ''request.jwt.claims'',',
        E'  PERFORM set_config(''request.jwt.claim.sub'', '''', true);\n  PERFORM set_config(\n    ''request.jwt.claims'',');
    END IF;
    EXECUTE replace(definition, original_source, updated_source);
  END LOOP;
END;
$migration$;
