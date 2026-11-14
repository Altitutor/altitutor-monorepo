BEGIN;
-- Match the fixture class timezone when current_date crosses UTC midnight.
SET LOCAL TIME ZONE 'Australia/Adelaide';
SELECT no_plan();

CREATE TEMP TABLE schedule_fixture AS
SELECT jsonb_build_object(
  'class_id', 'f9930000-0000-4000-8000-000000000001',
  'subject_id', (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
  'cohort_label', 'Projection regression',
  'status', 'ACTIVE', 'schedule_type', 'RECURRING', 'billing_type', 'CLASS',
  'start_date', current_date, 'end_date', current_date + 28,
  'effective_from', current_date, 'timezone', 'Australia/Adelaide',
  'frequency_weeks', 1, 'anchor_date', current_date,
  'recurring_rows', jsonb_build_array(jsonb_build_object(
    'day_of_week', 6, 'start_time', '13:00', 'end_time', '14:00', 'position', 0
  ))
) AS proposal;
SELECT public.apply_class_schedule(proposal, public.preview_class_schedule(proposal)->>'proposal_hash')
FROM schedule_fixture;
CREATE TEMP TABLE projection_fixture AS
SELECT id, short_name, long_name FROM public.classes WHERE id='f9930000-0000-4000-8000-000000000001';
SELECT is((SELECT count(*)::integer FROM projection_fixture), 1, 'scheduled class fixture exists');

-- DEV-381: the class-schedule API keeps identity separate from the timetable.
SELECT is((SELECT c.short_name FROM public.classes c JOIN projection_fixture f USING (id)),
  (SELECT concat_ws(' ', nullif(btrim(s.short_name), ''), 'Projection regression')
   FROM public.subjects s WHERE s.id = (SELECT (proposal->>'subject_id')::uuid FROM schedule_fixture)),
  'class short name contains subject and cohort label without the schedule');
SELECT is((SELECT long_name FROM public.classes WHERE id=(SELECT id FROM projection_fixture)),
  (SELECT concat_ws(' ', nullif(btrim(s.long_name), ''), 'Projection regression')
   FROM public.subjects s WHERE s.id = (SELECT (proposal->>'subject_id')::uuid FROM schedule_fixture)),
  'class long name contains subject and cohort label without the schedule');
SELECT is((SELECT schedule_summary_short FROM public.classes WHERE id=(SELECT id FROM projection_fixture)),
  'Sat 1:00', 'schedule remains available separately from the class name');

UPDATE schedule_fixture SET proposal = jsonb_set(proposal, '{recurring_rows}',
  '[{"day_of_week": 2, "start_time": "15:00", "end_time": "16:00", "position": 0}]');
SELECT public.apply_class_schedule(proposal, public.preview_class_schedule(proposal)->>'proposal_hash')
FROM schedule_fixture;
SELECT is((SELECT short_name FROM public.classes WHERE id=(SELECT id FROM projection_fixture)),
  (SELECT short_name FROM projection_fixture), 'changing the class schedule preserves its name');
SELECT is((SELECT long_name FROM public.classes WHERE id=(SELECT id FROM projection_fixture)),
  (SELECT long_name FROM projection_fixture), 'changing the class schedule preserves its long name');
SELECT is((SELECT schedule_summary_short FROM public.classes WHERE id=(SELECT id FROM projection_fixture)),
  'Tue 3:00', 'changing the class schedule updates the separate timetable summary');

-- Simulate a persisted label left behind when the effective date advances.
UPDATE public.classes SET short_name='STALE WEDNESDAY',
  schedule_weekdays=ARRAY[3]::smallint[], schedule_projected_on=current_date-1
WHERE id='f9930000-0000-4000-8000-000000000001';
SELECT lives_ok($$SELECT public.refresh_due_class_schedule_projections()$$,
  'scheduled refresh updates persisted timetable projections');
SELECT is((SELECT short_name FROM public.classes WHERE id=(SELECT id FROM projection_fixture)),
  (SELECT short_name FROM projection_fixture), 'current class label is restored without another staff edit');
SELECT is((SELECT schedule_weekdays FROM public.classes WHERE id=(SELECT id FROM projection_fixture)),
  ARRAY[2]::smallint[], 'weekday filter agrees with the current Tuesday timetable');
SELECT is((SELECT schedule_projected_on FROM public.classes WHERE id=(SELECT id FROM projection_fixture)),
  (now() AT TIME ZONE 'Australia/Adelaide')::date, 'refresh records the class-local date');
SELECT CASE WHEN to_regclass('cron.job') IS NULL THEN skip('pg_cron is not preloaded locally')
  ELSE results_eq($$SELECT count(*) FROM cron.job WHERE jobname='refresh-class-schedule-projections' AND active$$,
    $$VALUES (1::bigint)$$, 'effective-date refresh is scheduled') END;
SELECT * FROM finish();
ROLLBACK;
