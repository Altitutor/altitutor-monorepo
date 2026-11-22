BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT no_plan();

INSERT INTO public.staff_subjects(staff_id,subject_id)
SELECT st.id,sub.id FROM public.staff st CROSS JOIN public.subjects sub
WHERE st.id IN ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011')
 AND sub.name='Medicine Interview' ON CONFLICT DO NOTHING;
INSERT INTO public.interviews(id,data) VALUES('e4960000-0000-4000-8000-000000000000','{}');
-- Realistic, poorly compressible round payloads make history reads observable.
-- Both tutors own history: discovery must stay cheap for creators as well as
-- participants without depending on a particular planner/index implementation.
INSERT INTO public.interview_rounds(id,interview_id,created_by,tutor_ids,student_ids,data)
SELECT ('e4960000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'e4960000-0000-4000-8000-000000000000',
 CASE WHEN n%2=0 THEN '00000000-0000-0000-0000-000000000010'::uuid
  ELSE '00000000-0000-0000-0000-000000000011'::uuid END,
 ARRAY[CASE WHEN n%2=0 THEN '00000000-0000-0000-0000-000000000010'::uuid
  ELSE '00000000-0000-0000-0000-000000000011'::uuid END],ARRAY[]::uuid[],
 jsonb_build_object('name','Discovery fixture '||n,'startedAt',now()-interval '1 hour',
  'phase',CASE WHEN n<=2 THEN 'waiting' ELSE 'completed' END,
  'assignments',jsonb_build_array(jsonb_build_object('tutorId',
   CASE WHEN n%2=0 THEN '00000000-0000-0000-0000-000000000010'
    ELSE '00000000-0000-0000-0000-000000000011' END)),
  'payload',(SELECT string_agg(md5(n::text||':'||part::text),'') FROM generate_series(1,1024)part))
FROM generate_series(1,1000)n;
ANALYZE public.interview_rounds;

CREATE FUNCTION pg_temp.tutor_discovery_buffers() RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE plan jsonb;
BEGIN
 -- Measure repeated discovery, independently of first-call actor-function
 -- planning. Both the warmup and measured read use the public caller facade.
 PERFORM id,name FROM public.vtutor_interview_active_rounds ORDER BY id;
 EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id,name FROM public.vtutor_interview_active_rounds ORDER BY id' INTO plan;
 RETURN (plan->0->'Plan'->>'Shared Hit Blocks')::bigint
      + (plan->0->'Plan'->>'Shared Read Blocks')::bigint;
END;
$$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SELECT cmp_ok(pg_temp.tutor_discovery_buffers(),'<',250::bigint,
 'Tutor discovery reads fewer than 250 shared buffers despite 1000 historical round payloads');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
