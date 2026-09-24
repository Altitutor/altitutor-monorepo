BEGIN;
SELECT plan(5);

SELECT is(
  (
    SELECT column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ucat_mcp_audit_runs'
      AND column_name = 'published_write_mode'
  ),
  '''apply_valid_changes''::text',
  'new UCAT audit runs default to applying valid published changes'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.tutor_ucat_review_content_change(uuid,text,text)',
    'EXECUTE'
  ),
  'authenticated tutors can invoke the staff content-change review facade'
);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT staff.id, subject.id
FROM public.staff staff
CROSS JOIN public.subjects subject
WHERE staff.id = '00000000-0000-0000-0000-000000000010'
  AND subject.name = 'UCAT'
ON CONFLICT DO NOTHING;

INSERT INTO public.question_stems (
  id,
  section_id,
  stem_text,
  status,
  access_scope
)
SELECT
  '74000000-0000-4000-8000-000000000001',
  section.id,
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Before staff review"}]}]}'::jsonb,
  'draft',
  'public'
FROM public.ucat_sections section
WHERE section.section_number = 1
LIMIT 1;

INSERT INTO public.ucat_mcp_audit_runs (
  id,
  title,
  status,
  published_write_mode,
  selector,
  idempotency_key,
  request_hash,
  created_by,
  oauth_client_id
) VALUES (
  '74100000-0000-4000-8000-000000000001',
  'Proposal-only staff review test',
  'active',
  'proposal_only',
  '{"kind":"manual"}',
  'staff-review-proposal-only',
  repeat('7', 64),
  '00000000-0000-0000-0000-000000000010',
  'test-client'
);

INSERT INTO public.ucat_mcp_audit_run_targets (
  run_id,
  content_type,
  content_id,
  status
) VALUES (
  '74100000-0000-4000-8000-000000000001',
  'stem',
  '74000000-0000-4000-8000-000000000001',
  'in_progress'
);

INSERT INTO public.ucat_mcp_content_changes (
  id,
  target_type,
  target_id,
  source,
  audit_run_id,
  base_revision,
  base_snapshot,
  proposed_snapshot,
  operations,
  summary,
  created_by
)
SELECT
  '74200000-0000-4000-8000-000000000001',
  'stem',
  stem.id,
  'audit_run',
  '74100000-0000-4000-8000-000000000001',
  public.ucat_mcp_authoring_revision(stem.id, stem.updated_at),
  jsonb_build_object(
    'sectionId', stem.section_id,
    'categoryId', NULL,
    'stemText', stem.stem_text,
    'accessScope', stem.access_scope,
    'tutorSourceNote', NULL,
    'questions', '[]'::jsonb
  ),
  jsonb_build_object(
    'sectionId', stem.section_id,
    'categoryId', NULL,
    'stemText', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"After staff review"}]}]}'::jsonb,
    'accessScope', stem.access_scope,
    'tutorSourceNote', NULL,
    'questions', '[]'::jsonb
  ),
  '[{"type":"set_stem_text"}]'::jsonb,
  'Update the test stem',
  '00000000-0000-0000-0000-000000000010'
FROM public.question_stems stem
WHERE stem.id = '74000000-0000-4000-8000-000000000001';

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

SELECT is(
  public.tutor_ucat_review_content_change(
    '74200000-0000-4000-8000-000000000001',
    'apply',
    NULL
  )->>'status',
  'draft',
  'explicit staff review can apply a proposal-only audit change'
);

RESET ROLE;

SELECT is(
  (
    SELECT status::text
    FROM public.ucat_mcp_content_changes
    WHERE id = '74200000-0000-4000-8000-000000000001'
  ),
  'applied',
  'staff review records the pending change as applied'
);

SELECT is(
  (
    SELECT stem_text #>> '{content,0,content,0,text}'
    FROM public.question_stems
    WHERE id = '74000000-0000-4000-8000-000000000001'
  ),
  'After staff review',
  'staff review applies the proposed snapshot to the target'
);

SELECT * FROM finish();
ROLLBACK;
