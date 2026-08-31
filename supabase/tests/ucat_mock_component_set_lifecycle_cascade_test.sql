BEGIN;
SELECT plan(11);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000010', id
FROM public.subjects WHERE name = 'UCAT'
ON CONFLICT DO NOTHING;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

CREATE TEMP TABLE cascade_review AS
SELECT public.tutor_ucat_upsert_mock_v2(
  NULL, 'Review cascade fixture', 'public', NULL,
  '54100000-0000-4000-8000-000000000001'
) AS mock_id;

CREATE TEMP TABLE cascade_review_set AS
SELECT public.tutor_ucat_upsert_question_set_v2(
  NULL, NULL, '{}'::JSONB, 'pace', 1, NULL, 'full_section', 'public', '[]'::JSONB,
  (SELECT id FROM public.ucat_sections WHERE section_number = 1),
  '54100000-0000-4000-8000-000000000001'
) AS set_id;

SELECT public.tutor_ucat_attach_mock_set(
  (SELECT mock_id FROM cascade_review),
  (SELECT set_id FROM cascade_review_set)
);

SELECT lives_ok(
  format(
    $$SELECT public.tutor_ucat_set_content_status('mock', %L::uuid, 'in_review')$$,
    (SELECT mock_id FROM cascade_review)
  ),
  'sending a mock for review also submits an empty draft component set'
);

SELECT is(
  (SELECT status FROM public.ucat_mocks WHERE id = (SELECT mock_id FROM cascade_review)),
  'in_review',
  'the mock enters review after its draft component set is submitted'
);

SELECT is(
  (SELECT status FROM public.question_sets WHERE id = (SELECT set_id FROM cascade_review_set)),
  'in_review',
  'the attached draft set is submitted for review with the mock'
);

SELECT throws_like(
  format(
    $$SELECT public.tutor_ucat_set_content_status('mock', %L::uuid, 'published')$$,
    (SELECT mock_id FROM cascade_review)
  ),
  '%publication_blocked%',
  'publishing a mock fails when a cascaded component set is not publication-ready'
);

SELECT is(
  (SELECT status FROM public.ucat_mocks WHERE id = (SELECT mock_id FROM cascade_review)),
  'in_review',
  'a failed mock publish leaves the mock in review'
);

SELECT is(
  (SELECT status FROM public.question_sets WHERE id = (SELECT set_id FROM cascade_review_set)),
  'in_review',
  'a failed mock publish rolls back cascaded component-set publication'
);

SELECT ok(
  public.tutor_ucat_content_status_blockers(
    'mock',
    (SELECT mock_id FROM cascade_review),
    'published'
  )::TEXT LIKE '%full_section_question_count_mismatch%',
  'mock publish blockers include the failing component set publication issue'
);

CREATE TEMP TABLE cascade_blocked AS
SELECT public.tutor_ucat_upsert_mock_v2(
  NULL, 'Blocked review cascade fixture', 'public', NULL,
  '54100000-0000-4000-8000-000000000001'
) AS mock_id;

CREATE TEMP TABLE cascade_blocked_set AS
SELECT public.tutor_ucat_upsert_question_set_v2(
  NULL, NULL, '{}'::JSONB, 'pace', 1, NULL, 'full_section', 'public', '[]'::JSONB,
  (SELECT id FROM public.ucat_sections WHERE section_number = 1),
  '54100000-0000-4000-8000-000000000001'
) AS set_id;

INSERT INTO public.question_stems (id, section_id, stem_text, status, access_scope)
SELECT
  'c7100000-0000-4000-8000-000000000001',
  section.id,
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft cascade stem"}]}]}'::jsonb,
  'draft',
  'public'
FROM public.ucat_sections section
WHERE section.section_number = 1
LIMIT 1;

INSERT INTO public.question_stems_question_sets (question_stem_id, question_set_id, index)
VALUES (
  'c7100000-0000-4000-8000-000000000001',
  (SELECT set_id FROM cascade_blocked_set),
  0
);

SELECT public.tutor_ucat_attach_mock_set(
  (SELECT mock_id FROM cascade_blocked),
  (SELECT set_id FROM cascade_blocked_set)
);

SELECT throws_ok(
  format(
    $$SELECT public.tutor_ucat_set_content_status('mock', %L::uuid, 'in_review')$$,
    (SELECT mock_id FROM cascade_blocked)
  ),
  'P0001',
  'in_review_set_contains_draft_stem',
  'a mock stays out of review when a draft component set cannot be submitted'
);

SELECT is(
  (SELECT status FROM public.ucat_mocks WHERE id = (SELECT mock_id FROM cascade_blocked)),
  'draft',
  'a failed review cascade leaves the mock in draft'
);

SELECT is(
  (SELECT status FROM public.question_sets WHERE id = (SELECT set_id FROM cascade_blocked_set)),
  'draft',
  'a failed review cascade leaves the component set in draft'
);

SELECT ok(
  public.tutor_ucat_content_status_blockers(
    'mock',
    (SELECT mock_id FROM cascade_blocked),
    'in_review'
  )::TEXT LIKE '%draft_child_stem%',
  'mock review blockers include the draft question that blocked the component set'
);

SELECT * FROM finish();
ROLLBACK;
