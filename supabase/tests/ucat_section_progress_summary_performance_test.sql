BEGIN;

SELECT plan(6);

CREATE FUNCTION pg_temp.explain_json(p_sql TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan JSONB;
BEGIN
  EXECUTE format(
    'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) %s',
    p_sql
  ) INTO v_plan;

  RETURN v_plan;
END;
$$;

SELECT ok(
  (
    SELECT procedure.prosecdef
      AND procedure.proconfig @> ARRAY['search_path=""']::TEXT[]
      AND language.lanname = 'plpgsql'
    FROM pg_proc procedure
    JOIN pg_language language ON language.oid = procedure.prolang
    WHERE procedure.oid =
      'public.get_student_ucat_section_progress_summary(integer)'::regprocedure
  ),
  'section progress summary is a fixed-search-path SECURITY DEFINER function'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.get_student_ucat_section_progress_summary(integer)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon',
    'public.get_student_ucat_section_progress_summary(integer)',
    'EXECUTE'
  ),
  'only authenticated callers can execute the section progress summary'
);

SET LOCAL ROLE anon;
SELECT throws_ok(
  $$SELECT public.get_student_ucat_section_progress_summary(2)$$,
  '42501',
  NULL,
  'anonymous callers cannot execute the section progress summary'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT is(
  public.get_student_ucat_section_progress_summary(2),
  NULL::JSONB,
  'an authenticated caller without a Student identity receives no data'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (
      SELECT student.user_id
      FROM public.students student
      WHERE student.id = '10000000-0000-0000-0000-000000000001'
    ),
    'role', 'authenticated'
  )::TEXT,
  true
);

INSERT INTO public.students_online_access_manual (student_id, subject_id, notes)
SELECT
  '10000000-0000-0000-0000-000000000001',
  subject.id,
  'pgTAP section progress performance fixture'
FROM public.subjects subject
WHERE subject.name = 'UCAT'
ON CONFLICT (student_id, subject_id) DO NOTHING;

SET LOCAL ROLE authenticated;

SELECT is(
  public.get_student_ucat_section_progress_summary(2) -> 'section' ->> 'sectionNumber',
  '2',
  'an authorized online Student receives the requested section summary'
);

CREATE TEMP TABLE section_progress_plan AS
SELECT pg_temp.explain_json(
  'SELECT public.get_student_ucat_section_progress_summary(2)'
) AS plan;

SELECT cmp_ok(
  (
    (plan #>> '{0,Plan,Shared Hit Blocks}')::BIGINT
    + (plan #>> '{0,Plan,Shared Read Blocks}')::BIGINT
  ),
  '<',
  3500::BIGINT,
  'section progress summary stays within its database buffer budget'
)
FROM section_progress_plan;

SELECT * FROM finish();
ROLLBACK;
