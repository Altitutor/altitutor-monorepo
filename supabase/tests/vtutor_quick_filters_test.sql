BEGIN;
SELECT plan(5);

INSERT INTO auth.users (
  instance_id, id, aud, email, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, role
)
VALUES
  (
    (SELECT id FROM auth.instances LIMIT 1),
    'fc225000-0000-4000-8000-000000000011',
    'authenticated',
    'tutor.views.owner@invalid.test',
    NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}'::jsonb,
    FALSE,
    'authenticated'
  ),
  (
    (SELECT id FROM auth.instances LIMIT 1),
    'fc225000-0000-4000-8000-000000000012',
    'authenticated',
    'tutor.views.other@invalid.test',
    NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}'::jsonb,
    FALSE,
    'authenticated'
  ),
  (
    (SELECT id FROM auth.instances LIMIT 1),
    'fc225000-0000-4000-8000-000000000013',
    'authenticated',
    'tutor.views.inactive@invalid.test',
    NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}'::jsonb,
    FALSE,
    'authenticated'
  );

INSERT INTO public.staff (id, first_name, last_name, email, role, status, user_id)
VALUES
  ('fc225000-0000-4000-8000-000000000001', 'View', 'Owner', 'tutor.views.owner@invalid.test', 'TUTOR', 'ACTIVE', 'fc225000-0000-4000-8000-000000000011'),
  ('fc225000-0000-4000-8000-000000000002', 'View', 'Other', 'tutor.views.other@invalid.test', 'TUTOR', 'ACTIVE', 'fc225000-0000-4000-8000-000000000012'),
  ('fc225000-0000-4000-8000-000000000003', 'View', 'Inactive', 'tutor.views.inactive@invalid.test', 'TUTOR', 'INACTIVE', 'fc225000-0000-4000-8000-000000000013');

INSERT INTO public.quick_filters (id, user_id, target_entity, name, config)
VALUES
  (
    'fc225000-0000-4000-8000-000000000101',
    NULL,
    'tutor:ucat_students',
    'Shared',
    '{"$display":[{"version":1,"filters":{},"sortBy":null,"sortDirection":"desc","groupBy":null,"visibleColumns":["name"]}]}'::jsonb
  ),
  (
    'fc225000-0000-4000-8000-000000000102',
    'fc225000-0000-4000-8000-000000000011',
    'tutor:ucat_students',
    'Mine',
    '{"$display":[{"version":1,"filters":{},"sortBy":null,"sortDirection":"desc","groupBy":null,"visibleColumns":["name"]}]}'::jsonb
  ),
  (
    'fc225000-0000-4000-8000-000000000103',
    'fc225000-0000-4000-8000-000000000012',
    'tutor:ucat_students',
    'Theirs',
    '{"$display":[{"version":1,"filters":{},"sortBy":null,"sortDirection":"desc","groupBy":null,"visibleColumns":["name"]}]}'::jsonb
  ),
  (
    'fc225000-0000-4000-8000-000000000104',
    NULL,
    'students',
    'Admin',
    '{"$display":[{"version":1,"filters":{"status":["ACTIVE"]},"sortBy":"status","sortDirection":"desc","groupBy":null,"visibleColumns":["status"]}]}'::jsonb
  );

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"fc225000-0000-4000-8000-000000000011","role":"authenticated"}',
  true
);

SELECT is(
  (SELECT count(*)::int FROM public.quick_filters),
  0,
  'a tutor cannot read quick_filters through the base table'
);

SELECT bag_eq(
  $$SELECT name FROM public.vtutor_quick_filters$$,
  $$VALUES ('Mine'), ('Shared')$$,
  'a tutor sees shared tutor views and their own personal views'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"fc225000-0000-4000-8000-000000000013","role":"authenticated"}',
  true
);

SELECT is(
  (SELECT count(*)::int FROM public.vtutor_quick_filters),
  0,
  'an inactive tutor sees no saved views'
);

RESET ROLE;

SELECT is(
  (SELECT count(*)::int FROM public.quick_filters WHERE target_entity = 'students' AND name = 'Admin'),
  1,
  'admin entity views remain on the base table'
);

SELECT is(
  (SELECT target_entity FROM public.quick_filters WHERE id = 'fc225000-0000-4000-8000-000000000101'),
  'tutor:ucat_students',
  'shared tutor views stay on the existing quick_filters table'
);

SELECT * FROM finish();
ROLLBACK;
