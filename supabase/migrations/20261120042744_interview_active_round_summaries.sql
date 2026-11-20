-- DEV-482: discovery must not render assessment, timing, presence or media JSON.
-- Keep these definer facades caller-scoped, just like the existing rich views.
CREATE VIEW public.vtutor_interview_active_rounds
WITH (security_invoker=false) AS
WITH actor AS MATERIALIZED (
  SELECT (SELECT public.interview_tutor_id((SELECT auth.uid()))) AS id,
         (SELECT public.current_tutor_id()) AS profile_id
)
SELECT round.id,
       CASE WHEN jsonb_typeof(round.data->'name')='string'
         THEN round.data->>'name' ELSE 'Mock interview' END AS name
FROM public.interview_rounds AS round
CROSS JOIN actor
WHERE actor.id IS NOT NULL
  AND actor.profile_id IS NOT NULL
  AND (actor.id=ANY(round.tutor_ids) OR actor.id=round.created_by)
  AND round.data->'assignments' @> jsonb_build_array(jsonb_build_object('tutorId',actor.profile_id))
  AND round.data->>'startedAt' IS NOT NULL
  AND round.data->>'phase'<>'completed'
  AND round.data->>'deletedAt' IS NULL;

CREATE VIEW public.vstudent_interview_active_rounds
WITH (security_invoker=false) AS
WITH actor AS MATERIALIZED (
  SELECT (SELECT public.current_student_id()) AS id
), enrolled_actor AS MATERIALIZED (
  SELECT id FROM actor WHERE public.interview_student_has_access(id)
)
SELECT round.id,
       CASE WHEN jsonb_typeof(round.data->'name')='string'
         THEN round.data->>'name' ELSE 'Mock interview' END AS name
FROM public.interview_rounds AS round
CROSS JOIN enrolled_actor AS actor
WHERE actor.id=ANY(round.student_ids)
  AND round.data->>'startedAt' IS NOT NULL
  AND round.data->>'phase'<>'completed'
  AND round.data->>'deletedAt' IS NULL;

REVOKE ALL ON public.vtutor_interview_active_rounds,public.vstudent_interview_active_rounds FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vtutor_interview_active_rounds,public.vstudent_interview_active_rounds TO authenticated;
COMMENT ON VIEW public.vtutor_interview_active_rounds IS 'Caller-scoped rejoin links for assigned Medicine interview tutors; no rich round projection.';
COMMENT ON VIEW public.vstudent_interview_active_rounds IS 'Caller-scoped rejoin links for enrolled Medicine interview students; no rich round projection.';
