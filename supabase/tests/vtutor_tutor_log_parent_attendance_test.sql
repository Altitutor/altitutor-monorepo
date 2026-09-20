BEGIN;
SELECT plan(2);

SELECT has_column(
  'public',
  'vtutor_tutor_log',
  'parent_attendance',
  'Tutor tutor-log view exposes parent attendance'
);

SELECT matches(
  pg_get_viewdef('public.vtutor_tutor_log'::regclass, true),
  'tutor_logs_parent_attendance',
  'Tutor tutor-log view reads parent attendance from the join table'
);

SELECT * FROM finish();
ROLLBACK;
