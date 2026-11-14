BEGIN;
SELECT plan(2);

INSERT INTO public.sessions(id, type, start_at, end_at, status)
SELECT session_id::uuid, 'ADMIN_MEETING'::public.session_type,
  '2040-08-12 09:00:00+00', '2040-08-12 10:00:00+00', 'ACTIVE'
FROM (VALUES
  ('ecc33500-0000-4000-8000-000000000003'),
  ('ecc33500-0000-4000-8000-000000000001'),
  ('ecc33500-0000-4000-8000-000000000002')
) AS fixtures(session_id);

SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM public.staff
  WHERE id = '00000000-0000-0000-0000-000000000001'), true);
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT array_agg(
    public.search_sessions_admin(
      p_range_start => '2040-08-12 09:00:00+00',
      p_range_end => '2040-08-12 09:01:00+00',
      p_types => ARRAY['ADMIN_MEETING'],
      p_include_relationships => false,
      p_limit => 1,
      p_offset => offset_value,
      p_ascending => ascending
    ) #>> '{sessions,0,id}' ORDER BY offset_value
  ) FROM generate_series(0, 2) AS offsets(offset_value)),
  ARRAY[
    'ecc33500-0000-4000-8000-000000000001',
    'ecc33500-0000-4000-8000-000000000002',
    'ecc33500-0000-4000-8000-000000000003'
  ],
  format('Equal start times have stable page order with ascending=%s', ascending)
) FROM (VALUES (true), (false)) AS directions(ascending);

SELECT * FROM finish();
ROLLBACK;
