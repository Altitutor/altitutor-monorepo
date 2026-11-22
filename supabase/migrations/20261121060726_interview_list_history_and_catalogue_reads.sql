-- DEV-488: list polling checks a cheap caller-scoped identity/revision index.
-- Completed payloads are fetched in bounded pages only when the index changes.
CREATE VIEW public.vtutor_interview_round_index WITH (security_invoker=false) AS
WITH actor AS MATERIALIZED (SELECT public.interview_tutor_id((select auth.uid())) AS id)
SELECT r.id,r.version,r.data->>'phase' AS phase
FROM public.interview_rounds r CROSS JOIN actor
WHERE (actor.id=ANY(r.tutor_ids) OR actor.id=r.created_by)
 AND r.data->>'deletedAt' IS NULL;

CREATE VIEW public.vstudent_interview_round_index WITH (security_invoker=false) AS
WITH actor AS MATERIALIZED (SELECT public.current_student_id() AS id)
SELECT r.id,r.version,r.data->>'phase' AS phase
FROM public.interview_rounds r CROSS JOIN actor
WHERE actor.id=ANY(r.student_ids) AND public.interview_student_has_access(actor.id)
 AND r.data->>'deletedAt' IS NULL;

REVOKE ALL ON public.vtutor_interview_round_index,public.vstudent_interview_round_index FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vtutor_interview_round_index,public.vstudent_interview_round_index TO authenticated,service_role;

-- Names and roster filters do not need bank prompts/questions/rubrics or editor
-- class memberships. The full existing catalogue remains the editing contract.
CREATE VIEW public.vtutor_interview_list_catalog WITH (security_invoker=false) AS
SELECT jsonb_build_object('actorId',public.interview_tutor_id((select auth.uid())),
 'interviews',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',data->'name') ORDER BY updated_at DESC),'[]') FROM public.interviews),
 'tutors',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',first_name||' '||last_name) ORDER BY first_name),'[]') FROM public.staff WHERE public.interview_tutor_id(user_id)=id),
 'students',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.first_name||' '||s.last_name) ORDER BY s.first_name),'[]')
   FROM public.students s WHERE public.interview_student_has_access(s.id))) AS data
WHERE public.interview_tutor_id((select auth.uid())) IS NOT NULL;
REVOKE ALL ON public.vtutor_interview_list_catalog FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vtutor_interview_list_catalog TO authenticated,service_role;
