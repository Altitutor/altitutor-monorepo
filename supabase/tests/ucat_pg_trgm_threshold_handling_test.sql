BEGIN;
SELECT plan(7);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000010', subject.id
FROM public.subjects subject
WHERE subject.name = 'UCAT'
ON CONFLICT DO NOTHING;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  TRUE
);

SELECT ok(
  current_setting('pg_trgm.similarity_threshold', TRUE) IS NULL,
  'the regression session starts without a registered pg_trgm threshold'
);

SELECT ok(
  pg_get_functiondef('public.refresh_ucat_duplicate_stem_pairs()'::REGPROCEDURE)
    ~ 'current_setting\(''pg_trgm\.similarity_threshold'',\s*(true|TRUE)\)',
  'incremental pair maintenance reads an absent pg_trgm threshold safely'
);

SELECT ok(
  pg_get_functiondef(
    'public.tutor_ucat_match_import_stems(jsonb,double precision)'::REGPROCEDURE
  ) ~ 'current_setting\(''pg_trgm\.similarity_threshold'',\s*(true|TRUE)\)',
  'bulk import matching reads an absent pg_trgm threshold safely'
);

SELECT ok(
  pg_get_functiondef('public.rebuild_ucat_duplicate_stem_pairs()'::REGPROCEDURE)
    ~ 'current_setting\(''pg_trgm\.similarity_threshold'',\s*(true|TRUE)\)',
  'set-wise pair rebuilds read an absent pg_trgm threshold safely'
);

SELECT lives_ok(
  $$
    INSERT INTO public.question_stems (id, section_id, stem_text)
    VALUES
      (
        'd0920000-0000-4000-8000-000000000001',
        '8dfbf286-e952-4581-b065-255ead834628',
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Fresh backend pg trgm marker alpha bravo charlie delta echo."}]}]}'::JSONB
      ),
      (
        'd0920000-0000-4000-8000-000000000002',
        '8dfbf286-e952-4581-b065-255ead834628',
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Fresh backend pg trgm marker alpha bravo charlie delta echo."}]}]}'::JSONB
      )
  $$,
  'incremental pair maintenance works when the backend starts without a threshold'
);

SELECT lives_ok(
  $$
    SELECT public.tutor_ucat_match_import_stems(
      '[{"id":"unset-guc-draft","sectionId":"8dfbf286-e952-4581-b065-255ead834628","stemText":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Fresh backend pg trgm marker alpha bravo charlie delta echo."}]}]}}]'::JSONB,
      0.95
    )
  $$,
  'bulk import matching works without a preconfigured threshold'
);

SELECT lives_ok(
  $$SELECT public.rebuild_ucat_duplicate_stem_pairs()$$,
  'set-wise pair rebuilds work without a preconfigured threshold'
);

SELECT * FROM finish();
ROLLBACK;
