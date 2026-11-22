BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT no_plan();
INSERT INTO public.staff_subjects(staff_id,subject_id)
SELECT '00000000-0000-0000-0000-000000000010',id FROM public.subjects WHERE name='Medicine Interview' ON CONFLICT DO NOTHING;
UPDATE public.classes SET subject_id=(SELECT id FROM public.subjects WHERE name='Medicine Interview' LIMIT 1)
WHERE id='20000000-0000-0000-0000-000000000001';
INSERT INTO public.interviews(id,data) VALUES('e4919000-0000-4000-8000-000000000000','{}');
INSERT INTO public.interview_rounds(id,interview_id,created_by,tutor_ids,student_ids,data)
SELECT ('e4919000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'e4919000-0000-4000-8000-000000000000',
 CASE WHEN n IN(2,5,9) THEN '00000000-0000-0000-0000-000000000010'::uuid ELSE '00000000-0000-0000-0000-000000000011'::uuid END,
 CASE WHEN n IN(3,5) THEN ARRAY[NULL]::uuid[] WHEN n=9 THEN ARRAY[]::uuid[]
  WHEN n=4 THEN ARRAY['00000000-0000-0000-0000-000000000010'::uuid,NULL]
  WHEN n%100=0 THEN ARRAY['00000000-0000-0000-0000-000000000010']::uuid[]
  ELSE ARRAY['00000000-0000-0000-0000-000000000011']::uuid[] END,
 CASE WHEN n=6 THEN ARRAY[NULL]::uuid[] WHEN n=8 THEN ARRAY[]::uuid[]
  WHEN n=7 THEN ARRAY['10000000-0000-0000-0000-000000000001'::uuid,NULL]
  WHEN n IN(11,12,13) THEN ARRAY['10000000-0000-0000-0000-000000000001']::uuid[]
  WHEN n%100=0 THEN ARRAY['10000000-0000-0000-0000-000000000001']::uuid[]
  ELSE ARRAY['10000000-0000-0000-0000-000000000002']::uuid[] END,
 jsonb_build_object('name','dev491live discovery '||n,'delivery','in_person','recordingEnabled',false,
 'startedAt',CASE WHEN n%17=0 OR n=12 THEN NULL ELSE now()-interval '1 hour' END,
 'phase',CASE WHEN n%100=0 OR n<=10 OR n IN(12,13) THEN 'waiting' ELSE 'completed' END,
 'deletedAt',CASE WHEN n%19=0 OR n=13 THEN now() ELSE NULL END,
 'assignments',jsonb_build_array(jsonb_build_object('tutorId',CASE WHEN n%100=0 OR n IN(2,4,5,9) THEN '00000000-0000-0000-0000-000000000010' ELSE '00000000-0000-0000-0000-000000000011' END)),
 'payload',repeat(md5(n::text),256))
FROM generate_series(1,1000)n;

CREATE TEMP SEQUENCE discovery_access_checks;
CREATE TEMP TABLE discovery_access_definition AS
 SELECT pg_get_functiondef('public.interview_student_has_access(uuid)'::regprocedure) AS definition;
DO $test$ DECLARE definition text; BEGIN
 SELECT source.definition INTO definition FROM discovery_access_definition source;
 EXECUTE replace(definition,'public.interview_student_has_access','pg_temp.dev491_original_student_access');
END $test$;
CREATE OR REPLACE FUNCTION public.interview_student_has_access(p_student_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF nextval('pg_temp.discovery_access_checks')>1 THEN RAISE EXCEPTION 'Entitlement rechecked for unrelated interview history'; END IF;
 RETURN pg_temp.dev491_original_student_access(p_student_id);
END;
$$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT lives_ok($$SELECT id,version,phase FROM public.vstudent_interview_round_index ORDER BY id$$,
 'One caller entitlement check serves the whole Student history index');
RESET ROLE;
DO $restore$ DECLARE definition text; BEGIN
 SELECT source.definition INTO definition FROM discovery_access_definition source;
 EXECUTE definition;
END $restore$;
SET LOCAL ROLE authenticated;
SELECT results_eq($$SELECT id FROM public.vstudent_interview_round_index WHERE id::text LIKE 'e4919000-%' ORDER BY id$$,
 $$SELECT ('e4919000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM unnest(ARRAY[7,11,12,100,200,300,400,500,600,700,800,900,1000])n$$,
 'History includes own completed and unstarted rounds, preserves null-element membership, and excludes unrelated, deleted, null-only or empty rosters');
SELECT results_eq($$SELECT id FROM public.vstudent_interview_active_rounds WHERE id::text LIKE 'e4919000-%' ORDER BY id$$,
 $$SELECT ('e4919000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM unnest(ARRAY[7,100,200,300,400,500,600,700,800,900,1000])n$$,
 'Active discovery preserves started, noncompleted and nondeleted membership');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vstudent_interview_round_index),0::bigint,'A Tutor has no Student history visibility');
SELECT is((SELECT count(*) FROM public.vstudent_interview_active_rounds),0::bigint,'A Tutor has no Student active-round visibility');
SELECT set_config('request.jwt.claims','{"role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vstudent_interview_round_index),0::bigint,'A missing actor has no Student history visibility');
SELECT is((SELECT count(*) FROM public.vstudent_interview_active_rounds),0::bigint,'A missing actor has no Student active-round visibility');
RESET ROLE;
UPDATE public.classes_students SET unenrolled_at=now()-interval '1 second' WHERE student_id='10000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vstudent_interview_round_index),0::bigint,'Ended enrolment is rechecked on the next history read');
SELECT is((SELECT count(*) FROM public.vstudent_interview_active_rounds),0::bigint,'Ended enrolment is rechecked on the next active-round read');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
