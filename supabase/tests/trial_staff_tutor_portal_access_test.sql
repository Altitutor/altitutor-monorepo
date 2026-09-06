BEGIN;
SELECT plan(6);

INSERT INTO auth.users (
  instance_id, id, aud, email, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, role
)
VALUES
  (
    (SELECT id FROM auth.instances LIMIT 1),
    'fc510000-0000-4000-8000-000000000011',
    'authenticated',
    'trial.tutor.portal@invalid.test',
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}'::JSONB,
    FALSE,
    'authenticated'
  ),
  (
    (SELECT id FROM auth.instances LIMIT 1),
    'fc510000-0000-4000-8000-000000000012',
    'authenticated',
    'inactive.tutor.portal@invalid.test',
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}'::JSONB,
    FALSE,
    'authenticated'
  );

INSERT INTO public.staff (
  id,
  first_name,
  last_name,
  email,
  role,
  status,
  user_id
)
VALUES
  (
    'fc510000-0000-4000-8000-000000000001',
    'Trial',
    'Tutor',
    'trial.tutor.portal@invalid.test',
    'TUTOR',
    'TRIAL',
    'fc510000-0000-4000-8000-000000000011'
  ),
  (
    'fc510000-0000-4000-8000-000000000002',
    'Inactive',
    'Tutor',
    'inactive.tutor.portal@invalid.test',
    'TUTOR',
    'INACTIVE',
    'fc510000-0000-4000-8000-000000000012'
  );

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"fc510000-0000-4000-8000-000000000011","role":"authenticated"}',
  true
);

SELECT is(
  public.is_tutor(),
  true,
  'a trial tutor is recognised as a tutor for portal facades'
);

SELECT is(
  public.current_tutor_id(),
  'fc510000-0000-4000-8000-000000000001'::uuid,
  'current_tutor_id returns the trial tutor staff id'
);

SELECT is(
  (SELECT status FROM public.vtutor_profile),
  'TRIAL',
  'vtutor_profile returns the trial tutor self-profile'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"fc510000-0000-4000-8000-000000000012","role":"authenticated"}',
  true
);

SELECT is(
  public.is_tutor(),
  false,
  'an inactive tutor is not recognised as a tutor for portal facades'
);

SELECT is(
  public.current_tutor_id(),
  NULL,
  'current_tutor_id does not return an inactive tutor'
);

SELECT is(
  (SELECT count(*) FROM public.vtutor_profile),
  0::bigint,
  'vtutor_profile does not return an inactive tutor self-profile'
);

SELECT * FROM finish();
ROLLBACK;
