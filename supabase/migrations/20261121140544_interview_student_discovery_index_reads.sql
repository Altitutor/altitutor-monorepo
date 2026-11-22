-- DEV-491: use the existing participant GIN index before decoding unrelated
-- history. Entitlement remains fresh per statement, independent of join order.
-- No new indexes, base-table changes or cached authorization are introduced.
CREATE OR REPLACE VIEW public.vstudent_interview_active_rounds
WITH (security_invoker=false) AS
WITH actor AS MATERIALIZED (
 SELECT (SELECT public.current_student_id()) AS id
), enrolled_actor AS MATERIALIZED (
 SELECT id FROM actor WHERE public.interview_student_has_access(id)
)
SELECT round.id,
 CASE WHEN jsonb_typeof(round.data->'name')='string'
  THEN round.data->>'name' ELSE 'Mock interview' END AS name
FROM public.interview_rounds round CROSS JOIN enrolled_actor actor
WHERE round.student_ids @> ARRAY[actor.id]
 AND round.data->>'startedAt' IS NOT NULL
 AND round.data->>'phase'<>'completed'
 AND round.data->>'deletedAt' IS NULL;

CREATE OR REPLACE VIEW public.vstudent_interview_round_index
WITH (security_invoker=false) AS
WITH actor AS MATERIALIZED (
 SELECT public.current_student_id() AS id
), enrolled_actor AS MATERIALIZED (
 SELECT id FROM actor WHERE public.interview_student_has_access(id)
)
SELECT r.id,r.version,r.data->>'phase' AS phase
FROM public.interview_rounds r CROSS JOIN enrolled_actor actor
WHERE r.student_ids @> ARRAY[actor.id]
 AND r.data->>'deletedAt' IS NULL;
