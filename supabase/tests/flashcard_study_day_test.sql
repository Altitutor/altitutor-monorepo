BEGIN;
SELECT plan(3);
SELECT is((SELECT study_day FROM public.flashcard_study_day_bounds('2026-09-19T17:00:00Z','Australia/Adelaide')),'2026-09-19'::DATE,'before 4 am belongs to the previous local study day');
SELECT is((SELECT starts_at FROM public.flashcard_study_day_bounds('2026-10-03T10:00:00Z','Australia/Adelaide')),'2026-10-02T18:30:00Z'::TIMESTAMPTZ,'DST study day starts at local 4 am');
SELECT is((SELECT ends_at-starts_at FROM public.flashcard_study_day_bounds('2026-10-03T10:00:00Z','Australia/Adelaide')),INTERVAL '23 hours','DST boundary produces a 23-hour study day');
SELECT * FROM finish();
ROLLBACK;
