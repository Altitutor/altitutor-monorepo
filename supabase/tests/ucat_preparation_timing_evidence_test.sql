BEGIN;

SELECT plan(8);

SELECT has_view(
  'public',
  'vstudent_ucat_preparation_timing_evidence',
  'Timing progression has a completed-evidence facade'
);
SELECT has_column(
  'public',
  'ucat_student_preparation_section_states',
  'prescribed_pace',
  'prescribed pace is durable'
);
SELECT has_column(
  'public',
  'ucat_student_preparation_section_states',
  'prescribed_pace_set_at',
  'rung evidence has an explicit reset timestamp'
);
SELECT has_column(
  'public',
  'vstudent_ucat_preparation_timing_evidence',
  'breadth',
  'completed Timing evidence exposes breadth'
);
SELECT has_column(
  'public',
  'vstudent_ucat_preparation_timing_evidence',
  'section_equivalents',
  'completed Timing evidence exposes section-equivalent dose'
);
SELECT matches(
  pg_get_viewdef('public.vstudent_ucat_preparation_timing_evidence'::regclass, true),
  'completed_at IS NOT NULL',
  'incomplete work cannot enter Timing evidence'
);
SELECT matches(
  pg_get_viewdef('public.vstudent_ucat_preparation_timing_evidence'::regclass, true),
  'discarded_at IS NULL',
  'abandoned work cannot enter Timing evidence'
);
SELECT matches(
  pg_get_viewdef('public.vstudent_ucat_preparation_timing_evidence'::regclass, true),
  'current_student_id',
  'Timing evidence is scoped to the current Student'
);

SELECT * FROM finish();
ROLLBACK;
