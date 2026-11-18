BEGIN;
SELECT plan(7);

SELECT ok(coalesce((SELECT reloptions @> ARRAY['security_barrier=true']
  FROM pg_class WHERE oid = 'public.vmarketing_staff_profiles'::regclass), false),
  'published profiles keep the security barrier after retention wrapping');
SELECT ok(NOT coalesce((SELECT reloptions @> ARRAY['security_invoker=true']
  FROM pg_class WHERE oid = 'public.vmarketing_staff_profiles'::regclass), false),
  'the public facade does not require anonymous base-table access');
SELECT ok(has_table_privilege('anon', 'public.vmarketing_staff_profiles', 'SELECT'),
  'anonymous visitors retain public profile reads');
SELECT ok(has_table_privilege('authenticated', 'public.vmarketing_staff_profiles', 'SELECT'),
  'authenticated visitors retain public profile reads');
SELECT ok(NOT EXISTS (
  SELECT 1 FROM unnest(ARRAY['anon', 'authenticated']) AS visitor(role_name)
  CROSS JOIN unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS operation(privilege_name)
  WHERE has_table_privilege(visitor.role_name, 'public.vmarketing_staff_profiles', operation.privilege_name)
), 'public profile visitors have no write or structural privileges');

INSERT INTO public.staff_marketing_profiles(staff_id, published)
VALUES ('00000000-0000-0000-0000-000000000010', true)
ON CONFLICT(staff_id) DO UPDATE SET published = true;
SET LOCAL ROLE anon;
SELECT ok(EXISTS(SELECT 1 FROM public.vmarketing_staff_profiles
  WHERE staff_id = '00000000-0000-0000-0000-000000000010'),
  'the least-privilege facade still returns published active staff');
RESET ROLE;
SELECT set_config('app.business_retention', 'retire', true);
UPDATE public.staff SET deleted_at = now()
WHERE id = '00000000-0000-0000-0000-000000000010';
SET LOCAL ROLE anon;
SELECT ok(NOT EXISTS(SELECT 1 FROM public.vmarketing_staff_profiles
  WHERE staff_id = '00000000-0000-0000-0000-000000000010'),
  'retired staff remain hidden by the retention wrapper');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
