BEGIN;
SELECT plan(4);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000010', subject.id
FROM public.subjects subject
WHERE subject.name = 'UCAT'
ON CONFLICT DO NOTHING;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

INSERT INTO public.question_stems (id, section_id, stem_text, status)
VALUES (
  'd0920000-0000-4000-8000-000000000001',
  '8dfbf286-e952-4581-b065-255ead834628',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Should a deleted stem keep its nested snapshot?"}]}]}'::JSONB,
  'draft'
);

INSERT INTO public.ucat_questions (
  id, question_stem_id, question_text, index, response_type, answer_scheme
) VALUES (
  'd0920000-0000-4000-8000-000000000011',
  'd0920000-0000-4000-8000-000000000001',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Select the strongest argument."}]}]}'::JSONB,
  1,
  'multiple_choice',
  'single_choice'
);

INSERT INTO public.question_answer_options (
  id, question_id, answer_text, index, answer_key_value
) VALUES
  (
    'd0920000-0000-4000-8000-000000000021',
    'd0920000-0000-4000-8000-000000000011',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Yes."}]}]}'::JSONB,
    1,
    NULL
  ),
  (
    'd0920000-0000-4000-8000-000000000022',
    'd0920000-0000-4000-8000-000000000011',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"No."}]}]}'::JSONB,
    2,
    'correct'
  );

INSERT INTO public.question_stems (id, section_id, stem_text, status)
VALUES (
  'd0920000-0000-4000-8000-000000000002',
  '8dfbf286-e952-4581-b065-255ead834628',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Live stem with one deleted child question."}]}]}'::JSONB,
  'published'
);

INSERT INTO public.ucat_questions (
  id, question_stem_id, question_text, index, response_type, answer_scheme
) VALUES
  (
    'd0920000-0000-4000-8000-000000000012',
    'd0920000-0000-4000-8000-000000000002',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Live question."}]}]}'::JSONB,
    1,
    'multiple_choice',
    'single_choice'
  ),
  (
    'd0920000-0000-4000-8000-000000000013',
    'd0920000-0000-4000-8000-000000000002',
    '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Deleted child question."}]}]}'::JSONB,
    2,
    'multiple_choice',
    'single_choice'
  );

UPDATE public.ucat_questions
SET deleted_at = TIMESTAMPTZ '2026-08-25 13:21:59+00'
WHERE id = 'd0920000-0000-4000-8000-000000000013';

UPDATE public.question_stems
SET deleted_at = TIMESTAMPTZ '2026-08-25 13:21:59+00'
WHERE id = 'd0920000-0000-4000-8000-000000000001';

UPDATE public.ucat_questions
SET deleted_at = TIMESTAMPTZ '2026-08-25 13:21:59+00'
WHERE question_stem_id = 'd0920000-0000-4000-8000-000000000001';

UPDATE public.question_answer_options
SET deleted_at = TIMESTAMPTZ '2026-08-25 13:21:59+00'
WHERE question_id = 'd0920000-0000-4000-8000-000000000011';

SELECT is(
  json_array_length(
    (SELECT questions FROM public.vtutor_ucat_question_stem_detail
     WHERE id = 'd0920000-0000-4000-8000-000000000001')
  ),
  1,
  'a deleted stem still exposes its nested questions in tutor detail'
);

SELECT is(
  json_array_length(
    (SELECT questions->0->'answer_options' FROM public.vtutor_ucat_question_stem_detail
     WHERE id = 'd0920000-0000-4000-8000-000000000001')
  ),
  2,
  'a deleted stem still exposes its nested answer options in tutor detail'
);

SELECT is(
  json_array_length(
    (SELECT questions FROM public.vtutor_ucat_question_stem_detail
     WHERE id = 'd0920000-0000-4000-8000-000000000002')
  ),
  1,
  'a live stem still hides individually deleted child questions'
);

SELECT is(
  (SELECT questions->0->>'id' FROM public.vtutor_ucat_question_stem_detail
   WHERE id = 'd0920000-0000-4000-8000-000000000002'),
  'd0920000-0000-4000-8000-000000000012',
  'the live stem detail keeps only the live child question'
);

SELECT * FROM finish();
ROLLBACK;
