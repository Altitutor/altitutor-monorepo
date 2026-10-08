BEGIN;
SELECT no_plan();

CREATE TEMP TABLE visibility_fixture (id uuid PRIMARY KEY, expected boolean);
INSERT INTO visibility_fixture
SELECT md5('operational-visibility-' || scenario)::uuid, expected
FROM (VALUES ('active', true), ('inactive', false), ('tombstone', false),
  ('expired-tombstone', false), ('trial', true), ('check-in', true)) cases(scenario, expected);
GRANT SELECT ON visibility_fixture TO authenticated;
INSERT INTO public.sessions(id, type, start_at, end_at, status, calendar_tombstone_until)
SELECT id,
  CASE WHEN id = md5('operational-visibility-trial')::uuid THEN 'TRIAL_SESSION'::public.session_type
       WHEN id = md5('operational-visibility-check-in')::uuid THEN 'CHECK_IN'::public.session_type
       ELSE 'CLASS'::public.session_type END,
  now() + interval '1 day', now() + interval '1 day 90 minutes',
  CASE WHEN id = md5('operational-visibility-inactive')::uuid THEN 'INACTIVE' ELSE 'ACTIVE' END,
  CASE WHEN id = md5('operational-visibility-tombstone')::uuid THEN now() + interval '90 days'
       WHEN id = md5('operational-visibility-expired-tombstone')::uuid THEN now() - interval '1 day' END
FROM visibility_fixture;
INSERT INTO public.sessions_staff(session_id, staff_id, type)
SELECT id, '00000000-0000-0000-0000-000000000010', 'MAIN_TUTOR' FROM visibility_fixture;
INSERT INTO public.sessions_students(session_id, student_id)
SELECT id, '10000000-0000-0000-0000-000000000001' FROM visibility_fixture;

-- Before the migration, exercise the real historical facade to reproduce the
-- leak. Missing operational facades still fail the explicit has_view assertions.
CREATE FUNCTION pg_temp.visible_count(facade text) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE n integer;
BEGIN
  IF to_regclass('public.' || facade) IS NULL THEN
    facade := replace(facade, '_operational_', '_');
  END IF;
  EXECUTE format('SELECT count(*)::integer FROM public.%I WHERE session_id IN (SELECT id FROM visibility_fixture)', facade) INTO n;
  RETURN n;
END $$;

SELECT has_view('public', facade, 'operational facade exists: ' || facade)
FROM (VALUES ('vtutor_operational_sessions'), ('vtutor_operational_session_detail'),
  ('vtutor_operational_sessions_students'), ('vstudent_operational_sessions'),
  ('vstudent_operational_session_detail'), ('vstudent_operational_session_base')) views(facade);

SELECT is(has_table_privilege('anon', to_regclass('public.' || facade), 'SELECT'), false,
  'anonymous cannot read operational facade: ' || facade)
FROM (VALUES ('vtutor_operational_sessions'), ('vtutor_operational_session_detail'),
  ('vtutor_operational_sessions_students'), ('vstudent_operational_sessions'),
  ('vstudent_operational_session_detail'), ('vstudent_operational_session_base')) views(facade);
SELECT is(has_table_privilege('authenticated', to_regclass('public.' || facade), 'INSERT, UPDATE, DELETE'), false,
  'operational facade is read-only: ' || facade)
FROM (VALUES ('vtutor_operational_sessions'), ('vtutor_operational_session_detail'),
  ('vtutor_operational_sessions_students'), ('vstudent_operational_sessions'),
  ('vstudent_operational_session_detail'), ('vstudent_operational_session_base')) views(facade);

SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM public.staff
  WHERE id = '00000000-0000-0000-0000-000000000001'), true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::integer FROM jsonb_array_elements(public.search_sessions_admin(
  p_include_relationships => false, p_limit => 10000)->'sessions') item
  WHERE (item->>'id')::uuid IN (SELECT id FROM visibility_fixture)), 3,
  'default admin session search excludes cancellation tombstones');
SELECT is((SELECT count(*)::integer FROM jsonb_array_elements(public.search_sessions_admin(
  p_statuses => ARRAY['ACTIVE', 'INACTIVE'], p_include_relationships => false, p_limit => 10000)->'sessions') item
  WHERE (item->>'id')::uuid IN (SELECT id FROM visibility_fixture)), 6,
  'explicit admin history search retains cancelled records');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM public.staff
  WHERE id = '00000000-0000-0000-0000-000000000010'), true);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.visible_count(facade), 3, 'tutor lifecycle filtering: ' || facade)
FROM (VALUES ('vtutor_operational_sessions'), ('vtutor_operational_session_detail'),
  ('vtutor_operational_sessions_students')) views(facade);
SELECT is((SELECT count(*)::integer FROM public.vtutor_session_detail
  WHERE session_id IN (SELECT id FROM visibility_fixture)), 6, 'explicit assigned tutor history remains available');
SELECT is((SELECT count(*)::integer FROM public.sessions
  WHERE id IN (SELECT id FROM visibility_fixture)), 0, 'tutor still has no base session row access');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM public.students
  WHERE id = '10000000-0000-0000-0000-000000000001'), true);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.visible_count(facade), 3, 'student lifecycle filtering: ' || facade)
FROM (VALUES ('vstudent_operational_sessions'), ('vstudent_operational_session_detail'),
  ('vstudent_operational_session_base')) views(facade);
SELECT is((SELECT count(*)::integer FROM public.vstudent_session_detail
  WHERE session_id IN (SELECT id FROM visibility_fixture)), 6, 'explicit assigned student history remains available');
SELECT is(pg_temp.visible_count('vtutor_operational_sessions'), 0, 'student cannot read tutor operational assignments');
SELECT is((SELECT count(*)::integer FROM public.sessions
  WHERE id IN (SELECT id FROM visibility_fixture)), 0, 'student still has no base session row access');
RESET ROLE;

SELECT set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
SET LOCAL ROLE authenticated;
SELECT is(pg_temp.visible_count(facade), 0, 'unrelated identity has no access: ' || facade)
FROM (VALUES ('vtutor_operational_sessions'), ('vtutor_operational_session_detail'),
  ('vtutor_operational_sessions_students'), ('vstudent_operational_sessions'),
  ('vstudent_operational_session_detail'), ('vstudent_operational_session_base')) views(facade);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
