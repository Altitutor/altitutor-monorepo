-- Resettable Study plan personas. These attach to the deterministic local test
-- students from 01_core_entities.sql. The same scenarios can be assigned to a
-- hosted-dev student by changing only the student UUIDs.

-- These are post-onboarding product personas. Keep them out of the signup
-- wizard so browser tests land on the Study plan surface they are exercising.
UPDATE public.students
SET ucat_signup_step = 5,
    ucat_signup_completed_at = COALESCE(ucat_signup_completed_at, NOW()),
    ucat_onboarding_completed_at = COALESCE(ucat_onboarding_completed_at, NOW()),
    onboarding_progress = COALESCE(onboarding_progress, '{}'::jsonb) || jsonb_build_object(
      'ucat-dashboard-intro', jsonb_build_object('completed_at', NOW(), 'version', 2),
      'ucat-study-plan-intro', jsonb_build_object('completed_at', NOW(), 'version', 2),
      'ucat-progress-intro', jsonb_build_object('completed_at', NOW(), 'version', 4),
      'ucat-learn-intro', jsonb_build_object('completed_at', NOW(), 'version', 3),
      'ucat-skill-trainer-intro', jsonb_build_object('completed_at', NOW(), 'version', 3),
      'ucat-practice-intro', jsonb_build_object('completed_at', NOW(), 'version', 2),
      'ucat-sets-intro', jsonb_build_object('completed_at', NOW(), 'version', 2),
      'ucat-mocks-intro', jsonb_build_object('completed_at', NOW(), 'version', 3),
      'ucat-question-engine-controls-intro', jsonb_build_object('completed_at', NOW(), 'version', 1),
      'ucat-question-engine-intro', jsonb_build_object('completed_at', NOW(), 'version', 2),
      'ucat-attempt-review-intro', jsonb_build_object('completed_at', NOW(), 'version', 2),
      'ucat-study-orb-intro-seen', jsonb_build_object('completed_at', NOW(), 'version', 1),
      'ucat-study-plan-decided', jsonb_build_object('completed_at', NOW(), 'version', 1)
    )
WHERE id IN (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000006'
);

INSERT INTO public.student_online_product_relationships (
  student_id, product, started_at, closed_at
)
SELECT
  student.id, 'UCAT_WEB', COALESCE(student.ucat_signup_completed_at, NOW()), NULL
FROM public.students student
WHERE student.id IN (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000006'
)
ON CONFLICT (student_id, product) DO UPDATE SET closed_at = NULL;

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
  ('f5000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000001', 2100, EXTRACT(YEAR FROM CURRENT_DATE + 21)::INT, CURRENT_DATE + 21, jsonb_build_array(jsonb_build_object('weekday', EXTRACT(DOW FROM CURRENT_DATE)::INT), jsonb_build_object('weekday', (EXTRACT(DOW FROM CURRENT_DATE)::INT + 2) % 7), jsonb_build_object('weekday', (EXTRACT(DOW FROM CURRENT_DATE)::INT + 4) % 7)), EXTRACT(DOW FROM CURRENT_DATE)::INT, NOW(), NULL, NULL),
  -- Bob: severely constrained availability, used to verify warning-not-blocking.
  ('f5000000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000002', 2500, EXTRACT(YEAR FROM CURRENT_DATE + 21)::INT, CURRENT_DATE + 21, jsonb_build_array(jsonb_build_object('weekday', EXTRACT(DOW FROM CURRENT_DATE)::INT)), EXTRACT(DOW FROM CURRENT_DATE)::INT, NOW(), NULL, NULL),
  -- Charlie: experienced and ready for performance work.
  ('f5000000-0000-4000-8000-000000000003', '10000000-0000-0000-0000-000000000003', 2400, EXTRACT(YEAR FROM CURRENT_DATE + 21)::INT, CURRENT_DATE + 21, jsonb_build_array(jsonb_build_object('weekday', EXTRACT(DOW FROM CURRENT_DATE)::INT), jsonb_build_object('weekday', (EXTRACT(DOW FROM CURRENT_DATE)::INT + 2) % 7), jsonb_build_object('weekday', (EXTRACT(DOW FROM CURRENT_DATE)::INT + 4) % 7), jsonb_build_object('weekday', (EXTRACT(DOW FROM CURRENT_DATE)::INT + 6) % 7)), EXTRACT(DOW FROM CURRENT_DATE)::INT, NOW(), NULL, NULL),
  -- Diana: partially completed beginner curriculum.
  ('f5000000-0000-4000-8000-000000000004', '10000000-0000-0000-0000-000000000004', 2200, EXTRACT(YEAR FROM CURRENT_DATE + 90)::INT, CURRENT_DATE + 90, jsonb_build_array(jsonb_build_object('weekday', EXTRACT(DOW FROM CURRENT_DATE)::INT), jsonb_build_object('weekday', (EXTRACT(DOW FROM CURRENT_DATE)::INT + 2) % 7), jsonb_build_object('weekday', (EXTRACT(DOW FROM CURRENT_DATE)::INT + 4) % 7)), EXTRACT(DOW FROM CURRENT_DATE)::INT, NOW(), NULL, NULL),
  -- Edward: near-test taper with high daily capacity.
  ('f5000000-0000-4000-8000-000000000005', '10000000-0000-0000-0000-000000000005', 2300, EXTRACT(YEAR FROM CURRENT_DATE + 10)::INT, CURRENT_DATE + 10, jsonb_build_array(jsonb_build_object('weekday', EXTRACT(DOW FROM CURRENT_DATE)::INT), jsonb_build_object('weekday', (EXTRACT(DOW FROM CURRENT_DATE)::INT + 1) % 7), jsonb_build_object('weekday', (EXTRACT(DOW FROM CURRENT_DATE)::INT + 3) % 7), jsonb_build_object('weekday', (EXTRACT(DOW FROM CURRENT_DATE)::INT + 5) % 7)), EXTRACT(DOW FROM CURRENT_DATE)::INT, NOW(), NULL, NULL),
  -- Fiona: one-section weakness with otherwise strong evidence.
  ('f5000000-0000-4000-8000-000000000006', '10000000-0000-0000-0000-000000000006', 2400, EXTRACT(YEAR FROM CURRENT_DATE + 21)::INT, CURRENT_DATE + 21, jsonb_build_array(jsonb_build_object('weekday', EXTRACT(DOW FROM CURRENT_DATE)::INT), jsonb_build_object('weekday', (EXTRACT(DOW FROM CURRENT_DATE)::INT + 2) % 7), jsonb_build_object('weekday', (EXTRACT(DOW FROM CURRENT_DATE)::INT + 4) % 7)), EXTRACT(DOW FROM CURRENT_DATE)::INT, NOW(), NULL, NULL)
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

-- Charlie is an experienced persona whose cognitive sections have permanently
-- graduated from Learning in this preparation cycle. Completed sets alone do
-- not grant graduation; the state is explicit and evidence-versioned.
INSERT INTO public.ucat_student_preparation_section_states (
  student_id, test_year, section_id, learning_graduated_at,
  learning_graduation_route, policy_version, evidence_snapshot
)
SELECT
  profile.student_id,
  profile.test_year,
  section.id,
  NOW() - INTERVAL '14 days',
  'accuracy',
  'evidence-driven-preparation-policy-v5',
  jsonb_build_object('fixture', 'experienced-e2e-persona')
FROM public.ucat_student_study_plan_profiles profile
CROSS JOIN public.ucat_sections section
WHERE profile.student_id = '10000000-0000-0000-0000-000000000003'
  AND section.section_number <= 3
ON CONFLICT (student_id, test_year, section_id) DO UPDATE SET
  learning_graduated_at = EXCLUDED.learning_graduated_at,
  learning_graduation_route = EXCLUDED.learning_graduation_route,
  policy_version = EXCLUDED.policy_version,
  evidence_snapshot = EXCLUDED.evidence_snapshot;

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

-- The student progress view resolves a set's section from immutable question
-- attempt snapshots rather than today's editable set membership. One snapshot
-- row per attempt is enough for this experienced-persona prerequisite.
WITH fixture(set_attempt_id, section_number, suffix) AS (
  VALUES
    ('f7000000-0000-4000-8000-000000000001'::UUID, 1, 1),
    ('f7000000-0000-4000-8000-000000000002'::UUID, 2, 2),
    ('f7000000-0000-4000-8000-000000000003'::UUID, 3, 3)
)
INSERT INTO public.student_question_attempts (
  id, student_id, student_question_set_attempt_id, question_id,
  content_snapshot, score, is_submitted, attempted_at, was_timed, mode
)
SELECT
  ('f8000000-0000-4000-8000-' || lpad(fixture.suffix::TEXT, 12, '0'))::UUID,
  '10000000-0000-0000-0000-000000000003',
  fixture.set_attempt_id,
  NULL,
  jsonb_build_object('stem', jsonb_build_object('sectionId', section.id)),
  1,
  true,
  NOW() - make_interval(days => 8 - fixture.section_number),
  true,
  'set'
FROM fixture
JOIN public.ucat_sections section ON section.section_number = fixture.section_number
ON CONFLICT (id) DO UPDATE SET
  content_snapshot = EXCLUDED.content_snapshot,
  is_submitted = true,
  was_timed = true;
