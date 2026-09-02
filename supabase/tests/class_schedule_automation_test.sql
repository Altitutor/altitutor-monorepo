BEGIN;

SELECT plan(2);

CREATE TEMP TABLE automation_proposal AS
SELECT jsonb_build_object(
  'class_id', '90000000-0000-0000-0000-000000000008',
  'subject_id', (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
  'schedule_type', 'RECURRING', 'start_date', '2027-01-05', 'end_date', '2027-01-05',
  'frequency_weeks', 1, 'anchor_date', '2027-01-05',
  'recurring_rows', jsonb_build_array(jsonb_build_object('day_of_week', 2, 'start_time', '13:00', 'end_time', '14:00'))
) AS proposal;

SELECT public.apply_class_schedule(proposal, public.preview_class_schedule(proposal)->>'proposal_hash')
FROM automation_proposal;

INSERT INTO public.classes_staff (id, class_id, staff_id, assigned_at, assigned_by)
VALUES (
  gen_random_uuid(),
  '90000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000010',
  '2026-08-01'::TIMESTAMPTZ,
  '00000000-0000-0000-0000-000000000001'
);

UPDATE automation_proposal
SET proposal = jsonb_set(proposal, '{end_date}', '"2027-01-12"'::JSONB);

SELECT public.apply_class_schedule(proposal, public.preview_class_schedule(proposal)->>'proposal_hash')
FROM automation_proposal;

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.sessions_staff ss
    JOIN public.sessions s ON s.id = ss.session_id
    WHERE s.class_id = '90000000-0000-0000-0000-000000000008'
  ),
  2,
  'Class-wide tutor assignments populate every generated occurrence'
);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.domain_events event
    JOIN public.domain_event_entities session_entity
      ON session_entity.domain_event_id = event.id
     AND session_entity.entity_type = 'session'
    JOIN public.sessions s ON s.id = session_entity.entity_id
    WHERE s.class_id = '90000000-0000-0000-0000-000000000008'
      AND event.event_name = 'session.staff_added'
  ),
  0,
  'generated per-Session tutor assignments do not emit lifecycle or notification noise'
);

SELECT * FROM finish();

ROLLBACK;
