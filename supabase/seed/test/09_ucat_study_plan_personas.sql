-- Resettable Study plan personas. These attach to the deterministic local test
-- students from 01_core_entities.sql. The same scenarios can be assigned to a
-- hosted-dev student by changing only the student UUIDs.

DELETE FROM public.ucat_student_study_plan_generations
WHERE student_id IN (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000006'
);

INSERT INTO public.ucat_student_study_plan_profiles (
  id, student_id, target_score, test_year, test_date,
  available_days, preferred_mock_weekday, setup_completed_at,
  last_generated_at, next_weekly_replan_on
)
VALUES
  -- Alice: new student, no historical evidence.
  ('f5000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000001', 2100, 2026, '2026-08-05', '[{"weekday":1,"maxMinutes":60},{"weekday":3,"maxMinutes":60},{"weekday":6,"maxMinutes":120}]', 6, NOW(), NULL, NULL),
  -- Bob: severely constrained availability, used to verify warning-not-blocking.
  ('f5000000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000002', 2500, 2026, '2026-08-05', '[{"weekday":6,"maxMinutes":30}]', 6, NOW(), NULL, NULL),
  -- Charlie: experienced and ready for performance work.
  ('f5000000-0000-4000-8000-000000000003', '10000000-0000-0000-0000-000000000003', 2400, 2026, '2026-08-05', '[{"weekday":1,"maxMinutes":90},{"weekday":2,"maxMinutes":90},{"weekday":4,"maxMinutes":90},{"weekday":6,"maxMinutes":150}]', 6, NOW(), NULL, NULL),
  -- Diana: partially completed beginner curriculum.
  ('f5000000-0000-4000-8000-000000000004', '10000000-0000-0000-0000-000000000004', 2200, 2026, '2026-08-05', '[{"weekday":1,"maxMinutes":60},{"weekday":3,"maxMinutes":60},{"weekday":5,"maxMinutes":60}]', 5, NOW(), NULL, NULL),
  -- Edward: near-test taper with high daily capacity.
  ('f5000000-0000-4000-8000-000000000005', '10000000-0000-0000-0000-000000000005', 2300, 2026, '2026-08-05', '[{"weekday":0,"maxMinutes":120},{"weekday":2,"maxMinutes":120},{"weekday":4,"maxMinutes":120},{"weekday":6,"maxMinutes":150}]', 6, NOW(), NULL, NULL),
  -- Fiona: one-section weakness with otherwise strong evidence.
  ('f5000000-0000-4000-8000-000000000006', '10000000-0000-0000-0000-000000000006', 2400, 2026, '2026-08-05', '[{"weekday":1,"maxMinutes":75},{"weekday":3,"maxMinutes":75},{"weekday":5,"maxMinutes":120}]', 5, NOW(), NULL, NULL)
ON CONFLICT (student_id) DO UPDATE SET
  target_score = EXCLUDED.target_score,
  test_year = EXCLUDED.test_year,
  test_date = EXCLUDED.test_date,
  available_days = EXCLUDED.available_days,
  preferred_mock_weekday = EXCLUDED.preferred_mock_weekday,
  setup_completed_at = EXCLUDED.setup_completed_at,
  last_generated_at = NULL,
  next_weekly_replan_on = NULL,
  updated_at = NOW();

-- Diana has a partially completed essential lesson and a finished one, which
-- verifies that regeneration continues one and excludes the other.
INSERT INTO public.ucat_student_learning_module_progress (
  student_id, learning_module_id, started_at, completion_percent, completed_at
)
VALUES
  ('10000000-0000-0000-0000-000000000004', 'f2000000-0000-4000-8000-000000000001', NOW() - INTERVAL '2 days', 50, NULL),
  ('10000000-0000-0000-0000-000000000004', 'f2000000-0000-4000-8000-000000000003', NOW() - INTERVAL '5 days', 100, NOW() - INTERVAL '4 days')
ON CONFLICT (student_id, learning_module_id) DO UPDATE SET
  completion_percent = EXCLUDED.completion_percent,
  completed_at = EXCLUDED.completed_at;

-- Lightweight section evidence is enough for score projection and planner
-- prioritisation; full question attempts are exercised by browser E2E.
DELETE FROM public.student_practice_sessions
WHERE id::TEXT LIKE 'f6000000-0000-4000-8000-%';

WITH evidence(student_id, section_number, score_points, total_points, days_ago, suffix) AS (
  VALUES
    ('10000000-0000-0000-0000-000000000003'::UUID, 1, 8, 10, 12, 1),
    ('10000000-0000-0000-0000-000000000003'::UUID, 2, 8, 10, 10, 2),
    ('10000000-0000-0000-0000-000000000003'::UUID, 3, 9, 10, 8, 3),
    ('10000000-0000-0000-0000-000000000006'::UUID, 1, 4, 10, 10, 4),
    ('10000000-0000-0000-0000-000000000006'::UUID, 2, 8, 10, 9, 5),
    ('10000000-0000-0000-0000-000000000006'::UUID, 3, 8, 10, 8, 6)
)
INSERT INTO public.student_practice_sessions (
  id, student_id, ucat_section_id, section_key, filters_snapshot,
  stems_snapshot, score_points, total_points, question_count,
  started_at, completed_at, unlimited
)
SELECT
  ('f6000000-0000-4000-8000-' || lpad(evidence.suffix::TEXT, 12, '0'))::UUID,
  evidence.student_id,
  section.id,
  CASE section.section_number
    WHEN 1 THEN 'verbal_reasoning'
    WHEN 2 THEN 'decision_making'
    ELSE 'quantitative_reasoning'
  END,
  jsonb_build_object('categoryIds', '[]'::JSONB, 'timeMode', 'speed', 'reviewTiming', 'atEnd'),
  '[]'::JSONB,
  evidence.score_points,
  evidence.total_points,
  10,
  NOW() - make_interval(days => evidence.days_ago),
  NOW() - make_interval(days => evidence.days_ago) + INTERVAL '20 minutes',
  false
FROM evidence
JOIN public.ucat_sections section ON section.section_number = evidence.section_number;

-- Charlie has completed one full set in every cognitive section, so a freshly
-- generated plan can legitimately introduce a mock.
INSERT INTO public.student_question_set_attempts (
  id, student_id, question_set_id, score_points, total_points, scaled_score,
  attempted_at, completed_at, set_time_limit_seconds,
  set_time_limit_at_exam_speed_seconds, set_speed, student_set_speed,
  student_exam_speed, was_timed, content_snapshot
)
VALUES
  ('f7000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000003', 'f3000000-0000-4000-8000-000000000001', 35, 44, 780, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days' + INTERVAL '21 minutes', 1260, 1260, 1, 1, 1, true, '{}'::JSONB),
  ('f7000000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000003', 'f3000000-0000-4000-8000-000000000003', 27, 35, 760, NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days' + INTERVAL '31 minutes', 1860, 1860, 1, 1, 1, true, '{}'::JSONB),
  ('f7000000-0000-4000-8000-000000000003', '10000000-0000-0000-0000-000000000003', 'f3000000-0000-4000-8000-000000000005', 30, 36, 800, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '25 minutes', 1500, 1500, 1, 1, 1, true, '{}'::JSONB)
ON CONFLICT (id) DO UPDATE SET
  score_points = EXCLUDED.score_points,
  total_points = EXCLUDED.total_points,
  scaled_score = EXCLUDED.scaled_score,
  completed_at = EXCLUDED.completed_at;
