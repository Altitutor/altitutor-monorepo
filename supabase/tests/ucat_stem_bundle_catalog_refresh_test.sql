BEGIN;
SELECT plan(2);

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

CREATE TEMP TABLE catalog_projection_writes (
  stem_id UUID NOT NULL
);

CREATE FUNCTION pg_temp.capture_catalog_projection_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO catalog_projection_writes (stem_id) VALUES (NEW.stem_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER capture_catalog_projection_write
AFTER INSERT OR UPDATE ON public.ucat_question_catalog_projection
FOR EACH ROW EXECUTE FUNCTION pg_temp.capture_catalog_projection_write();

CREATE TEMP TABLE saved_stem AS
SELECT public.tutor_ucat_upsert_question_stem_bundle(
  NULL,
  '8dfbf286-e952-4581-b065-255ead834628',
  NULL,
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Refresh once"}]}]}'::JSONB,
  'public',
  jsonb_build_array(
    jsonb_build_object(
      'index', 1,
      'question_text', '{"type":"doc","content":[]}'::JSONB,
      'response_type', 'multiple_choice',
      'answer_scheme', 'single_choice',
      'tag_ids', '[]'::JSONB,
      'answer_options', jsonb_build_array(
        jsonb_build_object('index', 1, 'answer_text', '{}'::JSONB, 'answer_key_value', 'correct'),
        jsonb_build_object('index', 2, 'answer_text', '{}'::JSONB, 'answer_key_value', NULL)
      )
    ),
    jsonb_build_object(
      'index', 2,
      'question_text', '{"type":"doc","content":[]}'::JSONB,
      'response_type', 'multiple_choice',
      'answer_scheme', 'single_choice',
      'tag_ids', '[]'::JSONB,
      'answer_options', jsonb_build_array(
        jsonb_build_object('index', 1, 'answer_text', '{}'::JSONB, 'answer_key_value', 'correct'),
        jsonb_build_object('index', 2, 'answer_text', '{}'::JSONB, 'answer_key_value', NULL)
      )
    )
  ),
  'individual',
  NULL
) AS id;

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM catalog_projection_writes
    WHERE stem_id = (SELECT id FROM saved_stem)
  ),
  1,
  'one aggregate save writes its catalog projection once'
);

SELECT is(
  (
    SELECT question_count
    FROM public.ucat_question_catalog_projection
    WHERE stem_id = (SELECT id FROM saved_stem)
  ),
  2,
  'the single catalog refresh contains the complete saved aggregate'
);

SELECT * FROM finish();
ROLLBACK;
