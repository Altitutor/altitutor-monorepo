BEGIN;
SELECT plan(12);

SELECT is(
  to_regprocedure('public.search_students_admin(text,text[],uuid[],boolean,boolean,integer,integer,text,boolean,text,text)')::text,
  NULL,
  'legacy in-person search RPC overload is absent'
);

INSERT INTO public.students (
  id,
  first_name,
  last_name,
  email,
  status,
  invite_token
)
VALUES
  (
    'fc000000-0000-4000-8000-000000000001',
    'Relationship',
    'Online',
    'relationship-online@student.test',
    NULL,
    NULL
  ),
  (
    'fc000000-0000-4000-8000-000000000002',
    'Relationship',
    'InPerson',
    'relationship-in-person@student.test',
    'ACTIVE',
    NULL
  ),
  (
    'fc000000-0000-4000-8000-000000000003',
    'Relationship',
    'Dual',
    'relationship-dual@student.test',
    'TRIAL',
    'fc000000-0000-4000-8000-000000000030'
  );

INSERT INTO public.student_online_product_relationships (
  student_id,
  product,
  started_at
)
VALUES
  (
    'fc000000-0000-4000-8000-000000000001',
    'UCAT_WEB',
    '2026-01-02T00:00:00Z'
  ),
  (
    'fc000000-0000-4000-8000-000000000003',
    'UCAT_WEB',
    '2026-01-03T00:00:00Z'
  ),
  (
    'fc000000-0000-4000-8000-000000000003',
    'STUDENT_WEB',
    '2026-01-04T00:00:00Z'
  );

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

CREATE TEMP TABLE online_result AS
SELECT public.search_online_students_admin(
  p_search => 'Relationship',
  p_limit => 20,
  p_offset => 0
) AS payload;

SELECT is(
  (SELECT (payload ->> 'total')::bigint FROM online_result),
  2::bigint,
  'online search returns one result per Student rather than per product relationship'
);

SELECT is(
  (
    SELECT jsonb_array_length(student -> 'products')
    FROM online_result,
      jsonb_array_elements(payload -> 'students') student
    WHERE student ->> 'id' = 'fc000000-0000-4000-8000-000000000003'
  ),
  2,
  'online search includes every product relationship on the single Student row'
);

SELECT is(
  (
    SELECT product ->> 'tier'
    FROM online_result,
      jsonb_array_elements(payload -> 'students') student,
      jsonb_array_elements(student -> 'products') product
    WHERE student ->> 'id' = 'fc000000-0000-4000-8000-000000000001'
      AND product ->> 'product' = 'UCAT_WEB'
  ),
  'FREE',
  'online product summaries expose the effective product tier'
);

SELECT is(
  (
    SELECT student ->> 'entitlement'
    FROM online_result,
      jsonb_array_elements(payload -> 'students') student
    WHERE student ->> 'id' = 'fc000000-0000-4000-8000-000000000001'
  ),
  'FREE',
  'a completed UCAT product relationship is online even without a subscription'
);

SELECT is(
  (public.search_online_students_admin(
    p_search => 'relationship-online@student.test',
    p_search_fields => ARRAY['email']::text[]
  ) ->> 'total')::bigint,
  1::bigint,
  'online search can be restricted to email'
);

SELECT is(
  (public.search_online_students_admin(
    p_search => 'relationship-online@student.test',
    p_search_fields => ARRAY['name']::text[]
  ) ->> 'total')::bigint,
  0::bigint,
  'online search does not match email when restricted to name'
);

CREATE TEMP TABLE in_person_result AS
SELECT public.search_students_admin(
  p_search => 'Relationship',
  p_statuses => ARRAY['ACTIVE', 'TRIAL']::text[],
  p_limit => 20,
  p_offset => 0
) AS payload;

SELECT is(
  (SELECT (payload ->> 'total')::bigint FROM in_person_result),
  2::bigint,
  'in-person search excludes the online-only Student'
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM in_person_result,
      jsonb_array_elements(payload -> 'students') student
    WHERE student ->> 'id' = 'fc000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'online-only Student is absent from the in-person operational view'
);

RESET ROLE;
INSERT INTO public.student_online_product_relationships (
  student_id,
  product,
  started_at
)
VALUES (
  '10000000-0000-0000-0000-000000000010',
  'UCAT_WEB',
  '2026-01-05T00:00:00Z'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

SELECT ok(
  public.is_ucat_online_student(),
  'explicit UCATWeb relationship grants the current Student online product membership'
);

RESET ROLE;

SELECT throws_ok(
  $$
    INSERT INTO public.students (
      id,
      first_name,
      last_name,
      email,
      user_id,
      status
    ) VALUES (
      'fc000000-0000-4000-8000-000000000040',
      'Conflicting',
      'Role',
      'admin@altitutor.test',
      '00000000-0000-0000-0000-000000000001',
      NULL
    )
  $$,
  'P0001',
  'User has an active staff record',
  'online-only Student profiles cannot reuse an active staff account'
);

SELECT public.complete_student_registration(
  p_token => 'fc000000-0000-4000-8000-000000000030',
  p_student_first_name => 'Relationship',
  p_student_last_name => 'Dual',
  p_student_email => 'relationship-dual@student.test',
  p_student_phone => '+61400000030',
  p_availability_monday => true,
  p_parents => '[{"first_name":"Test","last_name":"Parent","email":"relationship-parent@test.example","phone":"+61400000031"}]'::jsonb,
  p_subject_ids => ARRAY[]::uuid[]
);

SELECT is(
  (
    SELECT status
    FROM public.students
    WHERE id = 'fc000000-0000-4000-8000-000000000003'
  ),
  'ACTIVE',
  'completed in-person registration changes the in-person relationship from TRIAL to ACTIVE'
);

SELECT * FROM finish();
ROLLBACK;
