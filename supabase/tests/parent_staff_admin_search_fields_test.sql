BEGIN;
SELECT plan(10);

SELECT is(
  to_regprocedure('public.search_parents_admin(text,boolean,integer,integer,text,boolean)')::text,
  NULL,
  'legacy parents search RPC overload is absent'
);

SELECT is(
  to_regprocedure('public.search_staff_admin(text,text[],uuid[],boolean,boolean,integer,integer,text,boolean)')::text,
  NULL,
  'legacy staff search RPC overload is absent'
);

INSERT INTO public.staff (
  id,
  first_name,
  last_name,
  email,
  phone_number,
  role,
  status
)
VALUES (
  'a1000000-0000-4000-8000-000000000021',
  'Searchable',
  'Staffone',
  'searchable-staff@fields.test',
  '+61999000021',
  'TUTOR',
  'ACTIVE'
);

INSERT INTO public.parents (
  id,
  first_name,
  last_name,
  email,
  phone
)
VALUES (
  'a1000000-0000-4000-8000-000000000011',
  'Searchable',
  'Parentone',
  'searchable-parent@fields.test',
  '+61999000011'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

SELECT is(
  (public.search_parents_admin(
    p_search => 'searchable-parent@fields.test',
    p_search_fields => ARRAY['email']::text[]
  ) ->> 'total')::bigint,
  1::bigint,
  'parent search can be restricted to email'
);

SELECT is(
  (public.search_parents_admin(
    p_search => 'searchable-parent@fields.test',
    p_search_fields => ARRAY['name']::text[]
  ) ->> 'total')::bigint,
  0::bigint,
  'parent search does not match email when restricted to name'
);

SELECT is(
  (public.search_parents_admin(
    p_search => '+61999000011',
    p_search_fields => ARRAY['phone']::text[]
  ) ->> 'total')::bigint,
  1::bigint,
  'parent search can be restricted to phone'
);

SELECT is(
  (public.search_parents_admin(
    p_search => 'Searchable Parentone',
    p_search_fields => ARRAY['name']::text[]
  ) ->> 'total')::bigint,
  1::bigint,
  'parent search can be restricted to name'
);

SELECT is(
  (public.search_staff_admin(
    p_search => 'searchable-staff@fields.test',
    p_statuses => ARRAY['ACTIVE']::text[],
    p_search_fields => ARRAY['email']::text[]
  ) ->> 'total')::bigint,
  1::bigint,
  'staff search can be restricted to email'
);

SELECT is(
  (public.search_staff_admin(
    p_search => 'searchable-staff@fields.test',
    p_statuses => ARRAY['ACTIVE']::text[],
    p_search_fields => ARRAY['name']::text[]
  ) ->> 'total')::bigint,
  0::bigint,
  'staff search does not match email when restricted to name'
);

SELECT is(
  (public.search_staff_admin(
    p_search => '+61999000021',
    p_statuses => ARRAY['ACTIVE']::text[],
    p_search_fields => ARRAY['phone']::text[]
  ) ->> 'total')::bigint,
  1::bigint,
  'staff search can be restricted to phone'
);

SELECT is(
  (public.search_staff_admin(
    p_search => 'Searchable Staffone',
    p_statuses => ARRAY['ACTIVE']::text[],
    p_search_fields => ARRAY['name']::text[]
  ) ->> 'total')::bigint,
  1::bigint,
  'staff search can be restricted to name'
);

SELECT finish();
ROLLBACK;
