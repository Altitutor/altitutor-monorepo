BEGIN;

SELECT plan(10);

SELECT is(
  (public.preview_class_schedule(jsonb_build_object(
    'schedule_type', 'RECURRING', 'start_date', '2027-01-05', 'end_date', '2027-02-02',
    'effective_from', '2027-01-05', 'timezone', 'Australia/Adelaide',
    'frequency_weeks', 2, 'anchor_date', '2027-01-05',
    'recurring_rows', jsonb_build_array(jsonb_build_object('day_of_week', 2, 'start_time', '13:00', 'end_time', '14:00'))
  ))->'counts'->>'create')::INTEGER,
  3,
  'fortnightly recurrence follows its explicit anchor week'
);

SELECT is(
  (public.preview_class_schedule(jsonb_build_object(
    'schedule_type', 'CUSTOM', 'start_date', '2027-01-05', 'end_date', '2027-02-03',
    'effective_from', '2027-01-05', 'timezone', 'Australia/Adelaide',
    'custom_sessions', jsonb_build_array(
      jsonb_build_object('date', '2027-01-07', 'start_time', '13:00', 'end_time', '14:00'),
      jsonb_build_object('date', '2027-01-21', 'start_time', '15:00', 'end_time', '16:00')
    )
  ))->'counts'->>'create')::INTEGER,
  2,
  'custom timetables materialize explicitly dated Sessions'
);

SELECT results_eq(
  $$
    SELECT (value->>'start_at')::TIMESTAMPTZ
    FROM jsonb_array_elements(public.preview_class_schedule(jsonb_build_object(
      'schedule_type', 'RECURRING', 'start_date', '2026-09-27', 'end_date', '2026-10-04',
      'effective_from', '2026-09-27', 'timezone', 'Australia/Adelaide',
      'frequency_weeks', 1, 'anchor_date', '2026-09-27',
      'recurring_rows', jsonb_build_array(jsonb_build_object('day_of_week', 0, 'start_time', '13:00', 'end_time', '14:00'))
    ))->'occurrences')
    ORDER BY 1
  $$,
  $$ VALUES ('2026-09-27 03:30:00+00'::TIMESTAMPTZ), ('2026-10-04 02:30:00+00'::TIMESTAMPTZ) $$,
  'Adelaide wall-clock recurrence follows daylight-saving changes'
);

SELECT throws_ok(
  $$ SELECT public.preview_class_schedule(jsonb_build_object(
    'schedule_type', 'RECURRING', 'start_date', '2027-01-05', 'end_date', '2027-02-03',
    'frequency_weeks', 1, 'anchor_date', '2027-01-05',
    'recurring_rows', jsonb_build_array(
      jsonb_build_object('day_of_week', 2, 'start_time', '13:00', 'end_time', '14:00'),
      jsonb_build_object('day_of_week', 2, 'start_time', '13:30', 'end_time', '14:30')
    )
  )) $$,
  'P0001', 'Recurring schedule rows cannot overlap',
  'partially overlapping recurring rows are rejected'
);

SELECT throws_ok(
  $$ SELECT public.preview_class_schedule(jsonb_build_object(
    'schedule_type', 'RECURRING', 'start_date', '2027-01-05', 'end_date', '2027-02-03',
    'frequency_weeks', 1, 'anchor_date', '2027-01-05',
    'recurring_rows', jsonb_build_array(
      jsonb_build_object('day_of_week', 2, 'start_time', '13:00', 'end_time', '14:00'),
      jsonb_build_object('day_of_week', 2, 'start_time', '13:00', 'end_time', '14:00')
    )
  )) $$,
  'P0001', 'Recurring schedule rows cannot overlap',
  'duplicate recurring rows are rejected during preview'
);

SELECT throws_ok(
  $$ SELECT public.preview_class_schedule(jsonb_build_object(
    'schedule_type', 'CUSTOM', 'start_date', '2027-01-05', 'end_date', '2027-02-03',
    'custom_sessions', jsonb_build_array(
      jsonb_build_object('date', '2027-01-07', 'start_time', '13:00', 'end_time', '14:00'),
      jsonb_build_object('date', '2027-01-07', 'start_time', '13:30', 'end_time', '14:30')
    )
  )) $$,
  'P0001', 'Custom timetable Sessions cannot overlap',
  'overlapping custom Sessions are rejected during preview'
);

SELECT throws_ok(
  $$ SELECT public.preview_class_schedule(jsonb_build_object(
    'schedule_type', 'RECURRING', 'start_date', '2027-01-05', 'end_date', '2046-12-31',
    'frequency_weeks', 1, 'anchor_date', '2027-01-05',
    'recurring_rows', jsonb_build_array(jsonb_build_object('day_of_week', 4, 'start_time', '13:00', 'end_time', '14:00'))
  )) $$,
  'P0001', 'A Class timetable cannot contain more than 1000 Sessions',
  'bounded plans still enforce the 1000-Session safety cap'
);

SELECT throws_ok(
  $$ SELECT public.preview_class_schedule(jsonb_build_object(
    'schedule_type', 'RECURRING',
    'start_date', ((NOW() AT TIME ZONE 'Australia/Adelaide')::DATE - 7)::TEXT,
    'end_date', ((NOW() AT TIME ZONE 'Australia/Adelaide')::DATE + 7)::TEXT,
    'effective_from', ((NOW() AT TIME ZONE 'Australia/Adelaide')::DATE - 1)::TEXT,
    'timezone', 'Australia/Adelaide',
    'frequency_weeks', 1,
    'anchor_date', ((NOW() AT TIME ZONE 'Australia/Adelaide')::DATE - 7)::TEXT,
    'recurring_rows', jsonb_build_array(jsonb_build_object('day_of_week', 4, 'start_time', '13:00', 'end_time', '14:00'))
  )) $$,
  'P0001', 'The schedule effective date must be today or later',
  'the server rejects historical schedule reconciliation'
);

SELECT throws_ok(
  $$ SELECT public.apply_class_schedule(jsonb_build_object(
    'class_id', '90000000-0000-0000-0000-000000000004',
    'schedule_type', 'RECURRING', 'start_date', '2027-01-05', 'end_date', '2027-01-05',
    'frequency_weeks', 1, 'anchor_date', '2027-01-05',
    'recurring_rows', jsonb_build_array(jsonb_build_object('day_of_week', 2, 'start_time', '13:00', 'end_time', '14:00'))
  ), 'stale-hash') $$,
  'P0001', 'The Class schedule changed after preview; preview it again',
  'apply rejects a proposal that does not match the confirmed preview hash'
);

CREATE TEMP TABLE occupied_room_proposal AS
SELECT jsonb_build_object(
  'class_id', '90000000-0000-0000-0000-000000000006',
  'subject_id', (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
  'schedule_type', 'RECURRING', 'start_date', '2027-01-05', 'end_date', '2027-01-05',
  'frequency_weeks', 1, 'anchor_date', '2027-01-05',
  'recurring_rows', jsonb_build_array(jsonb_build_object(
    'day_of_week', 2, 'start_time', '13:00', 'end_time', '14:00', 'room', 'Interview Room'
  ))
) AS proposal;

SELECT public.apply_class_schedule(proposal, public.preview_class_schedule(proposal)->>'proposal_hash')
FROM occupied_room_proposal;

SELECT is(
  jsonb_array_length(public.preview_class_schedule(jsonb_build_object(
    'class_id', '90000000-0000-0000-0000-000000000007',
    'subject_id', (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
    'schedule_type', 'RECURRING', 'start_date', '2027-01-05', 'end_date', '2027-01-05',
    'frequency_weeks', 1, 'anchor_date', '2027-01-05',
    'recurring_rows', jsonb_build_array(jsonb_build_object(
      'day_of_week', 2, 'start_time', '13:30', 'end_time', '14:30', 'room', 'Interview Room'
    ))
  ))->'conflicts'),
  1,
  'cross-Class room overlaps are warning-only preview conflicts'
);

SELECT * FROM finish();

ROLLBACK;
