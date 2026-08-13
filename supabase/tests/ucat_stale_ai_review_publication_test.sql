BEGIN;
SELECT plan(3);

INSERT INTO public.question_stems (id, section_id, stem_text)
VALUES (
  'a1310000-0000-4000-8000-000000000001',
  'f659f363-ffcc-4ade-ad2f-8a9dd3a4dfcc',
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"First paragraph."}]},{"type":"paragraph","content":[{"type":"text","text":"Second paragraph."}]}]}'::jsonb
);

INSERT INTO public.ucat_ai_question_assessment_cycles (
  id,
  stem_id,
  is_current
)
VALUES (
  'a1310000-0000-4000-8000-000000000010',
  'a1310000-0000-4000-8000-000000000001',
  TRUE
);

INSERT INTO public.ucat_ai_question_assessment_runs (
  id,
  cycle_id,
  stem_id,
  trigger_kind,
  scope_type,
  target_question_ids,
  dedupe_key,
  content_fingerprint,
  shared_fingerprint,
  question_fingerprints,
  content_snapshot,
  status,
  prompt_version,
  assessment_result
)
VALUES (
  'a1310000-0000-4000-8000-000000000020',
  'a1310000-0000-4000-8000-000000000010',
  'a1310000-0000-4000-8000-000000000001',
  'manual_request',
  'full',
  '{}'::uuid[],
  'stale-ai-review-v3',
  'content-fingerprint',
  public.ucat_ai_current_shared_fingerprint('a1310000-0000-4000-8000-000000000001'),
  '{}'::jsonb,
  '{}'::jsonb,
  'completed',
  3,
  jsonb_build_object(
    'overallSummary', 'Stale review',
    'categories', '[]'::jsonb,
    'findings', jsonb_build_array(jsonb_build_object(
      'key', 'shared-stale-finding',
      'scopeType', 'shared',
      'questionId', NULL,
      'category', 'ucat_authenticity_task_quality',
      'rating', 'concern',
      'title', 'Stale finding',
      'detail', 'This review used an older contract.'
    ))
  )
);

SELECT isnt(
  public.ucat_content_publication_issues(
    'stem',
    'a1310000-0000-4000-8000-000000000001'
  ) @> '[{"code":"unresolved_ai_review_finding"}]'::jsonb,
  true,
  'publication ignores unresolved findings from an older AI review contract'
);

INSERT INTO public.ucat_ai_question_assessment_runs (
  id,
  cycle_id,
  stem_id,
  trigger_kind,
  scope_type,
  target_question_ids,
  dedupe_key,
  content_fingerprint,
  shared_fingerprint,
  question_fingerprints,
  content_snapshot,
  status,
  prompt_version,
  assessment_result
)
VALUES (
  'a1310000-0000-4000-8000-000000000021',
  'a1310000-0000-4000-8000-000000000010',
  'a1310000-0000-4000-8000-000000000001',
  'manual_request',
  'full',
  '{}'::uuid[],
  'current-ai-review-v18',
  'content-fingerprint',
  public.ucat_ai_current_shared_fingerprint('a1310000-0000-4000-8000-000000000001'),
  '{}'::jsonb,
  '{}'::jsonb,
  'completed',
  public.ucat_current_ai_assessment_prompt_version(),
  jsonb_build_object(
    'overallSummary', 'Current review',
    'categories', '[]'::jsonb,
    'findings', jsonb_build_array(jsonb_build_object(
      'key', 'shared-current-finding',
      'scopeType', 'shared',
      'questionId', NULL,
      'category', 'ucat_authenticity_task_quality',
      'rating', 'concern',
      'title', 'Current finding',
      'detail', 'This review used the current contract.'
    ))
  )
);

SELECT ok(
  public.ucat_content_publication_issues(
    'stem',
    'a1310000-0000-4000-8000-000000000001'
  ) @> '[{"code":"unresolved_ai_review_finding"}]'::jsonb,
  'publication still blocks unresolved findings from the current AI review contract'
);

INSERT INTO public.ucat_ai_question_assessment_decisions (
  run_id,
  stem_id,
  finding_key,
  decision,
  reviewed_content_fingerprint
)
VALUES (
  'a1310000-0000-4000-8000-000000000021',
  'a1310000-0000-4000-8000-000000000001',
  'shared-current-finding',
  'dismissed',
  'content-fingerprint'
);

SELECT isnt(
  public.ucat_content_publication_issues(
    'stem',
    'a1310000-0000-4000-8000-000000000001'
  ) @> '[{"code":"unresolved_ai_review_finding"}]'::jsonb,
  true,
  'publication accepts a current-contract finding after it is dismissed'
);

SELECT * FROM finish();
ROLLBACK;
