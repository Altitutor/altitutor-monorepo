BEGIN;

SELECT plan(14);

SELECT ok(
  has_column_privilege('service_role', 'public.ucat_question_catalog_projection', 'stem_id', 'SELECT')
    AND has_column_privilege('service_role', 'public.ucat_question_catalog_projection', 'ai_review_status', 'SELECT'),
  'service_role can read the UCAT question catalog AI review status'
);
SELECT ok(
  has_column_privilege('service_role', 'public.ucat_question_catalog_projection', 'ai_review_status', 'UPDATE'),
  'service_role can persist UCAT question catalog AI review status'
);

SELECT has_index(
  'public',
  'ucat_student_study_plan_tasks',
  'idx_ucat_study_plan_completed_benchmarks',
  'completed benchmark lookups have a covering partial index'
);
SELECT has_function(
  'public',
  'get_student_ucat_completed_benchmark_sections',
  ARRAY['uuid'],
  'completed benchmarks are loaded through a bounded aggregate'
);
SELECT has_function(
  'public',
  'get_student_ucat_score_projection_evidence',
  ARRAY['uuid'],
  'score evidence is loaded through a Student-scoped aggregate'
);
SELECT has_function(
  'public',
  'get_student_ucat_section_progress_summary',
  ARRAY['integer'],
  'section progress is consolidated into one aggregate'
);
SELECT has_function(
  'public',
  'upsert_ucat_learning_module_block_progress',
  ARRAY['uuid', 'uuid', 'jsonb', 'boolean', 'boolean'],
  'block progress has an atomic upsert function'
);
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.get_student_ucat_completed_benchmark_sections(uuid)',
    'EXECUTE'
  ),
  'service_role can load completed benchmark sections'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.get_student_ucat_completed_benchmark_sections(uuid)',
    'EXECUTE'
  ),
  'Students cannot request another Student completed benchmarks'
);
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.get_student_ucat_score_projection_evidence(uuid)',
    'EXECUTE'
  ),
  'service_role can load scoped score evidence'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.get_student_ucat_score_projection_evidence(uuid)',
    'EXECUTE'
  ),
  'Students cannot request another Student score evidence'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.get_student_ucat_section_progress_summary(integer)',
    'EXECUTE'
  ),
  'Students can load their own section summary'
);
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.upsert_ucat_learning_module_block_progress(uuid,uuid,jsonb,boolean,boolean)',
    'EXECUTE'
  ),
  'service_role can persist block progress atomically'
);
SELECT matches(
  pg_get_functiondef(
    'public.upsert_ucat_learning_module_block_progress(uuid,uuid,jsonb,boolean,boolean)'::regprocedure
  ),
  'ON CONFLICT',
  'block progress resolves concurrent creates through ON CONFLICT'
);

SELECT * FROM finish();
ROLLBACK;
