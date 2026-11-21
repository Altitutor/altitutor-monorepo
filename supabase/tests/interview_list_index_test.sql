BEGIN;
SELECT no_plan();

INSERT INTO public.staff_subjects(staff_id,subject_id)
SELECT st.id,sub.id FROM public.staff st CROSS JOIN public.subjects sub
WHERE st.id IN ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011')
 AND sub.name='Medicine Interview' ON CONFLICT DO NOTHING;
UPDATE public.classes SET subject_id=(SELECT id FROM public.subjects WHERE name='Medicine Interview' LIMIT 1)
WHERE id='20000000-0000-0000-0000-000000000001';
INSERT INTO public.interviews(id,data) VALUES('e4881100-0000-4000-8000-000000000000','{"name":"List-only template"}');
INSERT INTO public.interview_rounds(id,interview_id,created_by,tutor_ids,student_ids,data)
SELECT ('e4881100-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'e4881100-0000-4000-8000-000000000000',
 CASE WHEN n=4 THEN '00000000-0000-0000-0000-000000000011' ELSE '00000000-0000-0000-0000-000000000010' END::uuid,
 ARRAY[CASE WHEN n=4 THEN '00000000-0000-0000-0000-000000000011' ELSE '00000000-0000-0000-0000-000000000010' END]::uuid[],
 ARRAY[CASE WHEN n IN (4,5) THEN '10000000-0000-0000-0000-000000000002' ELSE '10000000-0000-0000-0000-000000000001' END]::uuid[],
 jsonb_build_object('name','Round '||n,'phase',CASE WHEN n IN (2,5) THEN 'completed' ELSE 'waiting' END,
 'deletedAt',CASE WHEN n=3 THEN now() ELSE NULL END)
FROM generate_series(1,5) n;
INSERT INTO public.interview_categories(id,name) VALUES('e4881100-0000-4000-8000-000000000010','List test');
INSERT INTO public.interview_stations(id,name,category_id,prompt)
VALUES('e4881100-0000-4000-8000-000000000011','Private bank station','e4881100-0000-4000-8000-000000000010','"Private prompt"');

SELECT ok(NOT has_table_privilege('anon','public.vtutor_interview_round_index','SELECT'),'Anon cannot read tutor index');
SELECT ok(NOT has_table_privilege('anon','public.vstudent_interview_round_index','SELECT'),'Anon cannot read student index');
SELECT ok(NOT has_table_privilege('authenticated','public.vtutor_interview_round_index','UPDATE'),'Index grants no writes');
SELECT ok(NOT has_table_privilege('anon','public.vtutor_interview_list_catalog','SELECT'),'Anon cannot read list catalogue');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vtutor_interview_round_index WHERE id::text LIKE 'e4881100-%'),3::bigint,'Tutor index includes own current and history, excluding deleted and unrelated rows');
SELECT is((SELECT count(*) FROM public.vtutor_interview_round_index WHERE id::text LIKE 'e4881100-%' AND phase='completed'),2::bigint,'Completed metadata identifies both history rows');
SELECT is((SELECT data->'interviews' @> '[{"id":"e4881100-0000-4000-8000-000000000000","name":"List-only template"}]'::jsonb FROM public.vtutor_interview_list_catalog),true,'List catalogue retains interview name for global search');
SELECT ok((SELECT NOT(data ?| ARRAY['stations','categories','tags','classes']) FROM public.vtutor_interview_list_catalog),'List catalogue excludes authoring content');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is((SELECT count(*) FROM public.vstudent_interview_round_index WHERE id::text LIKE 'e4881100-%'),2::bigint,'Student index preserves current and historical actor scope');
SELECT is((SELECT count(*) FROM public.vtutor_interview_list_catalog),0::bigint,'Student cannot use Tutor list catalogue');
RESET ROLE;

-- Actual metadata/list reads must not render phase payloads or bank stations.
CREATE OR REPLACE FUNCTION public.interview_effective_phase_state(d jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Phase payload forbidden in list index'; END; $$;
CREATE OR REPLACE FUNCTION public.interview_station_json(s public.interview_stations) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Bank projection forbidden in list catalogue'; END; $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SELECT lives_ok($$SELECT id,version,phase FROM public.vtutor_interview_round_index$$,'Actual Tutor index bypasses summary payload construction');
SELECT lives_ok($$SELECT data FROM public.vtutor_interview_list_catalog$$,'Actual list catalogue bypasses private bank rendering');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT lives_ok($$SELECT id,version,phase FROM public.vstudent_interview_round_index$$,'Actual Student index bypasses summary payload construction');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
