BEGIN;
SELECT plan(6);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000010', subject.id
FROM public.subjects subject
WHERE subject.name = 'UCAT'
ON CONFLICT DO NOTHING;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated","client_id":"revision-recovery-test"}',
  true
);
SET LOCAL ROLE authenticated;

-- A disposable draft representing the other tutor's latest saved work.
CREATE TEMP TABLE recovery_stem AS
SELECT public.tutor_ucat_mcp_upsert_question_stem_bundle(
  NULL, NULL, '8dfbf286-e952-4581-b065-255ead834628', NULL,
  '{"type":"doc","content":[]}'::JSONB, 'public', '[]'::JSONB,
  'individual', 'Concurrent tutor correction', NULL, '["create"]'::JSONB
)->>'id' AS id;

CREATE TEMP TABLE recovery_read AS
SELECT detail.id, detail.updated_at
FROM public.vtutor_ucat_question_stem_detail detail
WHERE detail.id = (SELECT id::UUID FROM recovery_stem);

SELECT throws_ok(
  format(
    $command$SELECT public.tutor_ucat_mcp_upsert_question_stem_bundle(
      %L::UUID, %L::TIMESTAMPTZ, '8dfbf286-e952-4581-b065-255ead834628', NULL,
      '{"type":"doc","content":[]}'::JSONB, 'public', '[]'::JSONB,
      'individual', 'Stale overwrite', NULL, '["set_metadata"]'::JSONB
    )$command$,
    id, updated_at - INTERVAL '1 second'
  ),
  'P0001', 'mcp_stale_revision',
  'the database rejects a stale MCP write instead of overwriting another tutor'
) FROM recovery_read;

SELECT is(
  (SELECT tutor_source_note FROM public.vtutor_ucat_question_stem_detail
   WHERE id = (SELECT id FROM recovery_read)),
  'Concurrent tutor correction',
  'a rejected mutation preserves the latest tutor content'
);

SELECT is(
  (SELECT updated_at FROM public.vtutor_ucat_question_stem_detail
   WHERE id = (SELECT id FROM recovery_read)),
  (SELECT updated_at FROM recovery_read),
  'a rejected mutation preserves the current revision'
);

SELECT lives_ok(
  format(
    $command$SELECT public.tutor_ucat_mcp_upsert_question_stem_bundle(
      %L::UUID, %L::TIMESTAMPTZ, '8dfbf286-e952-4581-b065-255ead834628', NULL,
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Reconciled correction"}]}]}'::JSONB,
      'public', '[]'::JSONB, 'individual', %L, NULL, '["set_metadata"]'::JSONB
    )$command$,
    id, updated_at, tutor_source_note
  ),
  're-reading through the tutor view supplies a revision accepted by the MCP mutation'
)
FROM public.vtutor_ucat_question_stem_detail
WHERE id = (SELECT id FROM recovery_read);

SELECT is(
  (SELECT stem_text #>> '{content,0,content,0,text}'
   FROM public.vtutor_ucat_question_stem_detail
   WHERE id = (SELECT id FROM recovery_read)),
  'Reconciled correction',
  'the recovered mutation persists the requested correction'
);

SELECT is(
  (SELECT tutor_source_note FROM public.vtutor_ucat_question_stem_detail
   WHERE id = (SELECT id FROM recovery_read)),
  'Concurrent tutor correction',
  'the recovered mutation retains the other tutor''s work'
);

SELECT * FROM finish();
ROLLBACK;
