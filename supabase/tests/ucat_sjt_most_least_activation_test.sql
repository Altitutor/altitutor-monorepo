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

CREATE TEMP TABLE most_least_stem AS
SELECT public.tutor_ucat_upsert_question_stem_bundle(
  NULL,
  '8dfbf286-e952-4581-b065-255ead834628',
  'd97a0bf2-aa09-4ec3-86bb-5dd5146a9a57',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"SJT scenario"}]}]}'::jsonb,
  'public',
  jsonb_build_array(jsonb_build_object(
    'index', 1,
    'question_text', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Choose the most and least appropriate actions."}]}]}'::jsonb,
    'question_type', 'multiple_choice',
    'response_type', 'drag_and_drop',
    'answer_scheme', 'situational_judgement_most_least',
    'answer_explanation', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"The destinations reflect the relative appropriateness of the actions."}]}]}'::jsonb,
    'tag_ids', '[]'::jsonb,
    'answer_options', (
      SELECT jsonb_agg(jsonb_build_object(
        'index', option_index,
        'answer_text', jsonb_build_object(
          'type', 'doc',
          'content', jsonb_build_array(jsonb_build_object(
            'type', 'paragraph',
            'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Action ' || option_index))
          ))
        ),
        'is_answer', option_index = 1,
        'answer_key_value', CASE option_index WHEN 1 THEN 'most' WHEN 3 THEN 'least' ELSE NULL END
      ) ORDER BY option_index)
      FROM generate_series(1, 3) option_index
    )
  )),
  'individual',
  NULL
) AS id;

SELECT isnt(
  public.ucat_content_publication_issues('stem', (SELECT id FROM most_least_stem)) @>
    '[{"code":"sj_most_least_not_activated"}]'::jsonb,
  true,
  'Most/Least publication is activated'
);

SELECT isnt(
  public.ucat_content_publication_issues('stem', (SELECT id FROM most_least_stem)) @>
    '[{"code":"invalid_response_answer_key"}]'::jsonb,
  true,
  'publication accepts exactly three actions with distinct Most and Least keys'
);

SELECT isnt(
  public.ucat_content_publication_issues('stem', (SELECT id FROM most_least_stem)) @>
    '[{"code":"sj_most_least_question_count"}]'::jsonb,
  true,
  'publication accepts one Most/Least question in its stem'
);

INSERT INTO public.ucat_questions (
  question_stem_id,
  question_text,
  question_type,
  response_type,
  answer_scheme,
  index
)
VALUES (
  (SELECT id FROM most_least_stem),
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Conflicting second question"}]}]}'::jsonb,
  'multiple_choice',
  'multiple_choice',
  'single_choice',
  2
);

SELECT ok(
  public.ucat_content_publication_issues('stem', (SELECT id FROM most_least_stem)) @>
    '[{"code":"sj_most_least_question_count"}]'::jsonb,
  'publication rejects a Most/Least stem containing another independently categorizable question'
);

SELECT * FROM finish();
ROLLBACK;
