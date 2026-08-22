BEGIN;

SELECT plan(5);

SELECT has_table(
  'public',
  'class_schedule_revisions',
  'Classes own durable schedule revisions'
);

SELECT has_function(
  'public',
  'preview_class_schedule',
  ARRAY['jsonb'],
  'ADMINSTAFF can preview a Class schedule through one planner interface'
);

SELECT is(
  (
    public.preview_class_schedule(
      jsonb_build_object(
        'schedule_type', 'RECURRING',
        'start_date', '2026-09-01',
        'end_date', '2026-09-09',
        'effective_from', '2026-09-01',
        'timezone', 'Australia/Adelaide',
        'frequency_weeks', 1,
        'anchor_date', '2026-09-01',
        'recurring_rows', jsonb_build_array(
          jsonb_build_object('day_of_week', 2, 'start_time', '13:00', 'end_time', '14:00', 'room', 'Room 1'),
          jsonb_build_object('day_of_week', 3, 'start_time', '14:00', 'end_time', '15:00', 'room', 'Room 2')
        )
      )
    )->'counts'->>'create'
  )::INTEGER,
  4,
  'a weekly multi-row schedule previews every concrete Class session'
);

SELECT has_function(
  'public',
  'apply_class_schedule',
  ARRAY['jsonb', 'text'],
  'ADMINSTAFF applies the exact previewed Class schedule transactionally'
);

SELECT has_table(
  'public',
  'class_schedule_slots',
  'Recurring schedules own weekday, time, and room rows'
);

SELECT * FROM finish();

ROLLBACK;
