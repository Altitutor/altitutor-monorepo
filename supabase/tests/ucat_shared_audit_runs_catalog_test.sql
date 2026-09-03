BEGIN;
SELECT plan(15);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT staff.id, subject.id
FROM public.staff staff
CROSS JOIN public.subjects subject
WHERE staff.id IN (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000011'
)
  AND subject.name = 'UCAT'
ON CONFLICT DO NOTHING;

INSERT INTO public.question_stems (id, section_id, stem_text, status, access_scope)
SELECT
  stem.id,
  (SELECT section.id FROM public.ucat_sections section WHERE section.section_number = 1 LIMIT 1),
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Audit stem"}]}]}'::jsonb,
  'draft',
  'public'
FROM (
  VALUES
    ('73000000-0000-4000-8000-000000000001'::uuid),
    ('73000000-0000-4000-8000-000000000002'::uuid),
    ('73000000-0000-4000-8000-000000000003'::uuid),
    ('73000000-0000-4000-8000-000000000004'::uuid)
) AS stem(id);

INSERT INTO public.ucat_mcp_audit_runs (
  id, title, status, published_write_mode, selector, idempotency_key,
  request_hash, created_by, oauth_client_id, created_at
) VALUES
  (
    '73100000-0000-0000-0000-000000000001', 'All draft stems', 'active',
    'proposal_only', '{"kind":"manual"}', 'audit-catalog-drafts', repeat('a', 64),
    '00000000-0000-0000-0000-000000000011', 'other-client', '2026-08-19 10:00:00+00'
  ),
  (
    '73100000-0000-0000-0000-000000000002', 'Cancelled sweep', 'cancelled',
    'proposal_only', '{"kind":"manual"}', 'audit-catalog-cancelled', repeat('b', 64),
    '00000000-0000-0000-0000-000000000010', 'test-client', '2026-08-18 10:00:00+00'
  );

INSERT INTO public.ucat_mcp_audit_run_targets (
  run_id, content_type, content_id, status, result, outcome
) VALUES
  (
    '73100000-0000-0000-0000-000000000001', 'stem',
    '73000000-0000-4000-8000-000000000001', 'failed', NULL, NULL
  ),
  (
    '73100000-0000-0000-0000-000000000001', 'stem',
    '73000000-0000-4000-8000-000000000003', 'completed', 'updated',
    '{"outcome":"updated","why":"rewrote the key"}'::jsonb
  ),
  (
    '73100000-0000-0000-0000-000000000002', 'stem',
    '73000000-0000-4000-8000-000000000004', 'completed', 'unchanged',
    '{"outcome":"unchanged"}'::jsonb
  );

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

SELECT is(
  public.tutor_ucat_mcp_list_audit_runs('active', NULL, NULL, 10)#>>'{runs,0,run,id}',
  '73100000-0000-0000-0000-000000000001',
  'any UCAT tutor can list another tutor''s active audit run'
);

SELECT is(
  public.tutor_ucat_mcp_get_audit_run('73100000-0000-0000-0000-000000000001', 0, 10)
    #>>'{run,title}',
  'All draft stems',
  'any UCAT tutor can read another tutor''s audit run'
);

SELECT is(
  (
    SELECT jsonb_agg(item->>'id' ORDER BY item->>'id')
    FROM jsonb_array_elements(
      public.tutor_ucat_list_question_catalog(
        'draft', FALSE, NULL, ARRAY['stem_text']::TEXT[],
        NULL, NULL, FALSE, NULL, NULL, NULL, FALSE, NULL, NULL, NULL, NULL,
        NULL, 'desc', 1, 20, TRUE, NULL, NULL, NULL, NULL,
        ARRAY[
          '73000000-0000-4000-8000-000000000001',
          '73000000-0000-4000-8000-000000000002',
          '73000000-0000-4000-8000-000000000003',
          '73000000-0000-4000-8000-000000000004'
        ]::UUID[],
        ARRAY['73100000-0000-0000-0000-000000000001:failed']::TEXT[]
      )->'items'
    ) item
  ),
  '["73000000-0000-4000-8000-000000000001"]'::jsonb,
  'catalog can filter stems failed in a named audit run'
);

SELECT ok(
  public.ucat_is_valid_audit_catalog_filter('73100000-0000-0000-0000-000000000001'),
  'a bare audit-run id is a valid catalog filter'
);

SELECT is(
  (
    SELECT jsonb_agg(item->>'id' ORDER BY item->>'id')
    FROM jsonb_array_elements(
      public.tutor_ucat_list_question_catalog(
        'draft', FALSE, NULL, ARRAY['stem_text']::TEXT[],
        NULL, NULL, FALSE, NULL, NULL, NULL, FALSE, NULL, NULL, NULL, NULL,
        NULL, 'desc', 1, 20, TRUE, NULL, NULL, NULL, NULL,
        ARRAY[
          '73000000-0000-4000-8000-000000000001',
          '73000000-0000-4000-8000-000000000002',
          '73000000-0000-4000-8000-000000000003',
          '73000000-0000-4000-8000-000000000004'
        ]::UUID[],
        ARRAY['73100000-0000-0000-0000-000000000001']::TEXT[]
      )->'items'
    ) item
  ),
  '["73000000-0000-4000-8000-000000000001", "73000000-0000-4000-8000-000000000003"]'::jsonb,
  'catalog can filter every stem in a named audit run'
);

SELECT is(
  (
    SELECT jsonb_agg(item->>'id' ORDER BY item->>'id')
    FROM jsonb_array_elements(
      public.tutor_ucat_list_question_catalog(
        'draft', FALSE, NULL, ARRAY['stem_text']::TEXT[],
        NULL, NULL, FALSE, NULL, NULL, NULL, FALSE, NULL, NULL, NULL, NULL,
        NULL, 'desc', 1, 20, TRUE, NULL, NULL, NULL, NULL,
        ARRAY[
          '73000000-0000-4000-8000-000000000001',
          '73000000-0000-4000-8000-000000000002',
          '73000000-0000-4000-8000-000000000003',
          '73000000-0000-4000-8000-000000000004'
        ]::UUID[],
        ARRAY['73100000-0000-0000-0000-000000000001:completed:updated']::TEXT[]
      )->'items'
    ) item
  ),
  '["73000000-0000-4000-8000-000000000003"]'::jsonb,
  'completed fan-out can select updated targets only'
);

SELECT is(
  (
    SELECT jsonb_agg(item->>'id' ORDER BY item->>'id')
    FROM jsonb_array_elements(
      public.tutor_ucat_list_question_catalog(
        'draft', FALSE, NULL, ARRAY['stem_text']::TEXT[],
        NULL, NULL, FALSE, NULL, NULL, NULL, FALSE, NULL, NULL, NULL, NULL,
        NULL, 'desc', 1, 20, TRUE, NULL, NULL, NULL, NULL,
        ARRAY[
          '73000000-0000-4000-8000-000000000001',
          '73000000-0000-4000-8000-000000000002',
          '73000000-0000-4000-8000-000000000003',
          '73000000-0000-4000-8000-000000000004'
        ]::UUID[],
        ARRAY['not_audited']::TEXT[]
      )->'items'
    ) item
  ),
  '["73000000-0000-4000-8000-000000000002", "73000000-0000-4000-8000-000000000004"]'::jsonb,
  'not audited includes stems with no live run membership'
);

SELECT is(
  public.tutor_ucat_list_question_catalog(
    'draft', FALSE, NULL, ARRAY['stem_text']::TEXT[],
    NULL, NULL, FALSE, NULL, NULL, NULL, FALSE, NULL, NULL, NULL, NULL,
    NULL, 'desc', 1, 20, FALSE, NULL, NULL, NULL, NULL,
    ARRAY['73000000-0000-4000-8000-000000000001']::UUID[],
    NULL
  )#>>'{items,0,audit_memberships,0,title}',
  'All draft stems',
  'catalog rows include live audit-run memberships'
);

SELECT is(
  public.tutor_ucat_list_question_catalog(
    'draft', FALSE, NULL, ARRAY['stem_text']::TEXT[],
    NULL, NULL, FALSE, NULL, NULL, NULL, FALSE, NULL, NULL, NULL, NULL,
    NULL, 'desc', 1, 20, FALSE, NULL, NULL, NULL, NULL,
    ARRAY['73000000-0000-4000-8000-000000000004']::UUID[],
    NULL
  )#>>'{items,0,audit_memberships}',
  '[]',
  'cancelled-run membership is omitted from the catalog column'
);

SELECT throws_ok(
  $$SELECT public.tutor_ucat_list_question_catalog(
    'draft', FALSE, NULL, ARRAY['stem_text']::TEXT[],
    NULL, NULL, FALSE, NULL, NULL, NULL, FALSE, NULL, NULL, NULL, NULL,
    NULL, 'desc', 1, 20, TRUE, NULL, NULL, NULL, NULL, NULL,
    ARRAY['73100000-0000-0000-0000-000000000001:completed:suggest_delete']::TEXT[]
  )$$,
  'invalid_audit_catalog_filter',
  'completed cannot fan out to a skipped result'
);

SELECT ok(
  public.ucat_is_valid_audit_catalog_filter('73100000-0000-0000-0000-000000000001:skipped:suggest_split'),
  'skipped fan-out accepts suggest_split'
);

SELECT ok(
  NOT public.ucat_is_valid_audit_catalog_filter('73100000-0000-0000-0000-000000000001:failed:updated'),
  'failed has no result fan-out'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}',
  true
);

SELECT is(
  (
    WITH created AS (
      SELECT public.tutor_ucat_mcp_create_audit_run(
        'audit-catalog-not-audited-run',
        'Never audited draft stems',
        NULL,
        'proposal_only',
        jsonb_build_object(
          'kind', 'filter',
          'contentType', 'stem',
          'status', 'draft',
          'query', 'Audit stem',
          'searchScopes', jsonb_build_array('stem_text'),
          'auditFilters', jsonb_build_array('not_audited')
        ),
        'audit-ucat-questions',
        '1'
      ) AS payload
    )
    SELECT jsonb_agg(target->>'content_id' ORDER BY target->>'content_id')
    FROM created,
      jsonb_array_elements(
        public.tutor_ucat_mcp_get_audit_run(
          (created.payload->'run'->>'id')::uuid,
          0,
          10
        )->'targets'
      ) target
  ),
  '["73000000-0000-4000-8000-000000000002", "73000000-0000-4000-8000-000000000004"]'::jsonb,
  'audit-run filter selector can materialise never-audited stems'
);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.ucat_question_catalog_filtered_stem_ids(
      jsonb_build_object('auditFilters', jsonb_build_array('not_audited')),
      FALSE,
      'Audit stem',
      ARRAY['stem_text']::TEXT[]
    ) stem_id
  ),
  0,
  'creating a filter run removes its targets from the never-audited pool'
);

SELECT is(
  (
    SELECT jsonb_agg(item->>'id' ORDER BY item->>'id')
    FROM jsonb_array_elements(
      public.tutor_ucat_mcp_search_question_stems(
        jsonb_build_object('statuses', jsonb_build_array('draft', 'published')),
        FALSE,
        'Audit stem',
        ARRAY['stem_text']::TEXT[],
        NULL,
        'desc',
        1,
        20,
        TRUE
      )->'items'
    ) item
  ),
  jsonb_build_array(
    '73000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000002',
    '73000000-0000-4000-8000-000000000003',
    '73000000-0000-4000-8000-000000000004'
  ),
  'mcp stem search accepts multiple lifecycle statuses'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
