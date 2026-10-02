BEGIN;

SELECT plan(55);

CREATE TEMP TABLE subsidy_activity_ids (name text PRIMARY KEY, id uuid);
GRANT ALL ON subsidy_activity_ids TO authenticated, service_role;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

INSERT INTO subsidy_activity_ids VALUES ('main', public.save_student_subsidy(
  p_student_id := '10000000-0000-0000-0000-000000000001',
  p_subject_id := (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
  p_billing_type := 'CLASS', p_price_cents := 1500,
  p_effective_from := '2098-01-01T00:00:00Z'
));

SELECT is(
  (SELECT count(*) FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name = 'student.subsidy_added'),
  1::bigint, 'saving a new subsidy records one Student activity event'
);
SELECT ok(
  (SELECT payload->'before' = 'null'::jsonb
     AND payload->'after'->>'price_cents' = '1500'
     AND payload->'after'->>'currency' = 'AUD'
     AND payload->'after'->'effective_until' = 'null'::jsonb
     AND payload->'affected_subsidies' = '[]'::jsonb
   FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name = 'student.subsidy_added'),
  'creation captures safe subsidy details and preserves omitted/default RPC arguments'
);
SELECT is(
  (SELECT actor_staff_id FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name = 'student.subsidy_added'),
  '00000000-0000-0000-0000-000000000001'::uuid, 'the event records the acting admin'
);
SELECT ok(
  (SELECT recorded_at = transaction_timestamp() AND effective_at = '2098-01-01T00:00:00Z'::timestamptz
   FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name = 'student.subsidy_added'),
  'recorded time is separate from the subsidy start'
);
SELECT ok(
  (SELECT linked_entities @> '[{"entity_type":"student","entity_id":"10000000-0000-0000-0000-000000000001","display_name":"Alice Williams"}]'::jsonb
     AND actor_name = 'Admin User'
   FROM public.vadmin_domain_event_feed WHERE recorded_at = transaction_timestamp() AND event_name = 'student.subsidy_added' LIMIT 1),
  'the Student feed contains clickable identity and actor display snapshots'
);
SELECT is(
  (SELECT count(*) FROM public.vadmin_domain_event_feed WHERE recorded_at = transaction_timestamp() AND event_name LIKE 'student.subsidy_%'
   AND linked_entity_type = 'parent'),
  0::bigint, 'a linked Parent does not inherit Student subsidy history (ADR-0036)'
);
SELECT is(
  (SELECT count(*) FROM public.vadmin_domain_event_feed WHERE recorded_at = transaction_timestamp() AND event_name LIKE 'student.subsidy_%'
   AND linked_entity_id = '10000000-0000-0000-0000-000000000002'),
  0::bigint, 'unrelated Students do not receive the activity'
);

-- An edit changes every supported business field, without attributing the edit
-- to the original creator or exposing technical row timestamps in the payload.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
SELECT public.save_student_subsidy(
  (SELECT id FROM subsidy_activity_ids WHERE name = 'main'),
  '10000000-0000-0000-0000-000000000001',
  (SELECT id FROM public.subjects ORDER BY id OFFSET 1 LIMIT 1),
  'DRAFTING', 2500, 'USD', '2098-02-01', '2098-06-01'
);
SELECT is(
  (SELECT count(*) FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name = 'student.subsidy_changed'),
  1::bigint, 'a material save creates one change event'
);
SELECT ok(
  (SELECT payload->'before'->>'price_cents' = '1500'
     AND payload->'after'->>'price_cents' = '2500'
     AND payload->'before'->>'billing_type' = 'CLASS'
     AND payload->'after'->>'billing_type' = 'DRAFTING'
     AND payload->'before'->>'currency' = 'AUD'
     AND payload->'after'->>'currency' = 'USD'
     AND payload->'before'->>'subject_id' <> payload->'after'->>'subject_id'
     AND payload->'before'->>'effective_from' <> payload->'after'->>'effective_from'
     AND payload->'before'->'effective_until' = 'null'::jsonb
     AND payload->'after'->'effective_until' <> 'null'::jsonb
     AND NOT (payload->'after' ?| ARRAY['created_by', 'created_at', 'updated_at'])
   FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name = 'student.subsidy_changed'),
  'changes retain allowlisted old/new subject, rate, currency, billing type and dates'
);
SELECT is(
  (SELECT actor_staff_id FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name = 'student.subsidy_changed'),
  '00000000-0000-0000-0000-000000000002'::uuid, 'the editor is the actor, not the original creator'
);
SELECT public.save_student_subsidy(id, student_id, subject_id, billing_type, price_cents, currency, effective_from, effective_until)
FROM public.student_subsidies WHERE id = (SELECT id FROM subsidy_activity_ids WHERE name = 'main');
SELECT is(
  (SELECT count(*) FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name LIKE 'student.subsidy_%'),
  2::bigint, 'unchanged saves do not create duplicate activity'
);
UPDATE public.student_subsidies SET created_at = created_at - interval '1 day'
WHERE id = (SELECT id FROM subsidy_activity_ids WHERE name = 'main');
SELECT is(
  (SELECT count(*) FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name LIKE 'student.subsidy_%'),
  2::bigint, 'technical metadata updates do not create activity'
);

-- Direct writes remain supported by the admin-only table policy.
INSERT INTO public.student_subsidies(id, student_id, subject_id, billing_type, price_cents, effective_from, created_by)
SELECT 'ca100000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000002',
  id, 'CLASS', 1000, '2097-01-01', '00000000-0000-0000-0000-000000000001'
FROM public.subjects ORDER BY id LIMIT 1;
SELECT is(
  (SELECT count(*) FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name = 'student.subsidy_added'
    AND subject_id = '10000000-0000-0000-0000-000000000002'),
  1::bigint, 'direct admin creation is captured'
);
INSERT INTO subsidy_activity_ids VALUES ('temporary', public.save_student_subsidy(
  p_student_id := '10000000-0000-0000-0000-000000000002',
  p_subject_id := (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
  p_billing_type := 'CLASS', p_price_cents := 500,
  p_effective_from := '2098-01-01', p_effective_until := '2098-06-01'
));
SELECT is(
  (SELECT count(*) FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name LIKE 'student.subsidy_%'
    AND subject_id = '10000000-0000-0000-0000-000000000002'),
  2::bigint, 'a split creates one save event, without a false grant for the resumed range'
);
SELECT ok(
  (SELECT jsonb_array_length(payload->'affected_subsidies') = 2
     AND payload->'affected_subsidies' @> '[{"before":{"price_cents":1000},"after":{"price_cents":1000}}]'::jsonb
     AND payload->'affected_subsidies' @> '[{"before":null,"after":{"price_cents":1000}}]'::jsonb
   FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name = 'student.subsidy_added'
     AND payload->>'subsidy_id' = (SELECT id::text FROM subsidy_activity_ids WHERE name = 'temporary')),
  'the event describes the closed and resumed ranges of the earlier subsidy'
);
SELECT public.save_student_subsidy(
  (SELECT id FROM subsidy_activity_ids WHERE name = 'temporary'),
  '10000000-0000-0000-0000-000000000002',
  (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
  'CLASS', 600, 'AUD', '2097-06-01', '2099-01-01'
);
SELECT is(
  (SELECT count(*) FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name LIKE 'student.subsidy_%'
    AND subject_id = '10000000-0000-0000-0000-000000000002'),
  3::bigint, 'an overlapping edit that deletes/reinserts its row remains one change event'
);
SELECT ok(
  (SELECT payload->'before'->>'price_cents' = '500' AND payload->'after'->>'price_cents' = '600'
     AND jsonb_array_length(payload->'affected_subsidies') = 2
   FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name = 'student.subsidy_changed'
     AND payload->>'subsidy_id' = (SELECT id::text FROM subsidy_activity_ids WHERE name = 'temporary')),
  'the overlapping edit retains the real prior grant, rather than a synthetic removal/addition'
);
SELECT ok(
  COALESCE(current_setting('app.student_subsidy_activity_operation', true), '') = ''
    AND COALESCE(current_setting('app.student_subsidy_activity_rows', true), '') = '',
  'the save restores its operation context'
);
UPDATE public.student_subsidies SET price_cents = 700 WHERE id = (SELECT id FROM subsidy_activity_ids WHERE name = 'temporary');
SELECT is(
  (SELECT count(*) FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name = 'student.subsidy_changed'
    AND subject_id = '10000000-0000-0000-0000-000000000002'),
  2::bigint, 'direct admin edits are captured after a composite save'
);
DELETE FROM public.student_subsidies WHERE id = (SELECT id FROM subsidy_activity_ids WHERE name = 'temporary');
SELECT is(
  (SELECT count(*) FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name = 'student.subsidy_removed'),
  1::bigint, 'the existing explicit delete action is recorded'
);

-- Invalid writes must leave both subsidy state and history unchanged.
SELECT throws_ok($$SELECT public.save_student_subsidy(
  (SELECT id FROM subsidy_activity_ids WHERE name = 'main'),
  '10000000-0000-0000-0000-000000000002', (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
  'CLASS', 500, 'AUD', '2098-01-01', NULL)$$,
  '42501', 'Subsidy belongs to a different student', 'the RPC cannot reassign another Student''s subsidy');
SELECT throws_ok($$SELECT public.save_student_subsidy(
  (SELECT id FROM subsidy_activity_ids WHERE name = 'main'),
  '10000000-0000-0000-0000-000000000001', (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
  'CLASS', -1, 'AUD', '2098-01-01', NULL)$$,
  '23514', 'Subsidy price cannot be negative', 'invalid saves fail');
SELECT is(
  (SELECT count(*) FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name LIKE 'student.subsidy_%'),
  7::bigint, 'failed saves add no events');
SELECT is(
  (SELECT price_cents FROM public.student_subsidies WHERE id = (SELECT id FROM subsidy_activity_ids WHERE name = 'main')),
  2500, 'failed saves leave the original grant unchanged');
SELECT ok(COALESCE(current_setting('app.student_subsidy_activity_operation', true), '') = '',
  'a failed save restores context');

-- Active tutors, Students, inactive admins, Parents and anonymous callers
-- cannot see subsidy activity or gain a new subsidy mutation surface.
RESET ROLE;
CREATE FUNCTION pg_temp.assert_subsidy_access_denied(user_id uuid) RETURNS SETOF text LANGUAGE plpgsql AS $$
DECLARE changed_rows bigint;
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', user_id::text, true);
  RETURN NEXT is((SELECT count(*) FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name LIKE 'student.subsidy_%'), 0::bigint, 'non-admin cannot read subsidy activity');
  RETURN NEXT is((SELECT count(*) FROM public.vadmin_domain_event_feed WHERE recorded_at = transaction_timestamp() AND event_name LIKE 'student.subsidy_%'), 0::bigint, 'non-admin cannot read the activity projection');
  RETURN NEXT throws_ok($test$SELECT public.save_student_subsidy(p_student_id := '10000000-0000-0000-0000-000000000001',
    p_subject_id := (SELECT id FROM public.subjects ORDER BY id LIMIT 1), p_billing_type := 'CLASS', p_price_cents := 1, p_effective_from := '2099-01-01')$test$,
    '42501', 'Forbidden', 'non-admin cannot save a subsidy');
  UPDATE public.student_subsidies SET price_cents = 1;
  GET DIAGNOSTICS changed_rows = ROW_COUNT;
  RETURN NEXT is(changed_rows, 0::bigint, 'non-admin cannot edit the base table');
END;
$$;
UPDATE public.staff SET status = 'INACTIVE' WHERE id = '00000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
SELECT * FROM pg_temp.assert_subsidy_access_denied('00000000-0000-0000-0000-000000000010');
SELECT * FROM pg_temp.assert_subsidy_access_denied('10000000-0000-0000-0000-000000000001');
SELECT * FROM pg_temp.assert_subsidy_access_denied('00000000-0000-0000-0000-000000000002');
SELECT * FROM pg_temp.assert_subsidy_access_denied('60000000-0000-0000-0000-000000000001');
RESET ROLE;
SELECT ok(NOT has_function_privilege('anon', 'public.save_student_subsidy(uuid,uuid,uuid,public.billing_type,integer,text,timestamptz,timestamptz)', 'EXECUTE'), 'anonymous callers cannot save subsidies');
SELECT ok(NOT has_function_privilege('authenticated', 'private.save_student_subsidy(uuid,uuid,uuid,public.billing_type,integer,text,timestamptz,timestamptz)', 'EXECUTE'), 'the underlying row-write helper is private');
SELECT ok(NOT has_function_privilege('authenticated', 'private.record_student_subsidy_activity(jsonb,jsonb,jsonb,uuid)', 'EXECUTE'), 'clients cannot forge subsidy events');
SELECT ok(NOT has_function_privilege('authenticated', 'private.capture_student_subsidy_activity()', 'EXECUTE'), 'the trigger is not a callable RPC');
SELECT ok(NOT has_table_privilege('anon', 'public.vadmin_domain_event_feed', 'SELECT'), 'anonymous callers cannot read the feed');

-- Event recording failure rolls back the entire write, including overlap splits.
CREATE FUNCTION pg_temp.reject_subsidy_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_name LIKE 'student.subsidy_%' THEN RAISE EXCEPTION 'test_event_failure'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reject_subsidy_event BEFORE INSERT ON public.domain_events FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_subsidy_event();
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.save_student_subsidy(
  (SELECT id FROM subsidy_activity_ids WHERE name = 'main'),
  '10000000-0000-0000-0000-000000000001', (SELECT id FROM public.subjects ORDER BY id OFFSET 1 LIMIT 1),
  'DRAFTING', 100, 'USD', '2098-02-01', '2098-06-01')$$,
  'P0001', 'test_event_failure', 'event failure aborts the subsidy save');
SELECT is((SELECT price_cents FROM public.student_subsidies WHERE id = (SELECT id FROM subsidy_activity_ids WHERE name = 'main')), 2500, 'failed event persistence rolls back subsidy changes');
SELECT throws_ok($$SELECT public.save_student_subsidy(
  p_student_id := '10000000-0000-0000-0000-000000000002',
  p_subject_id := (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
  p_billing_type := 'CLASS', p_price_cents := 100,
  p_effective_from := '2097-02-01', p_effective_until := '2097-04-01')$$,
  'P0001', 'test_event_failure', 'event failure aborts a save that splits existing rates');
SELECT is((SELECT count(*) FROM public.student_subsidies
  WHERE student_id = '10000000-0000-0000-0000-000000000002'), 2::bigint,
  'event failure rolls back closed/resumed windows as well as the added grant');
RESET ROLE;
DROP TRIGGER reject_subsidy_event ON public.domain_events;

UPDATE public.student_subsidies SET student_id = '10000000-0000-0000-0000-000000000002'
WHERE id = (SELECT id FROM subsidy_activity_ids WHERE name = 'main');
SELECT ok((SELECT subject_id = '10000000-0000-0000-0000-000000000002'::uuid
  AND payload->'before'->>'student_id' = '10000000-0000-0000-0000-000000000001'
  AND payload->'after'->>'student_id' = '10000000-0000-0000-0000-000000000002'
  FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND payload->>'subsidy_id' = (SELECT id::text FROM subsidy_activity_ids WHERE name = 'main')
    AND payload->'before'->>'student_id' <> payload->'after'->>'student_id'),
  'a direct reassignment retains both old and new Student association');
SELECT is((SELECT count(*) FROM public.vadmin_domain_event_feed
  WHERE recorded_at = transaction_timestamp() AND payload->>'subsidy_id' = (SELECT id::text FROM subsidy_activity_ids WHERE name = 'main')
    AND payload->'before'->>'student_id' <> payload->'after'->>'student_id'),
  2::bigint, 'one reassignment event is linked to both directly affected Students');
UPDATE public.student_subsidies SET student_id = '10000000-0000-0000-0000-000000000001'
WHERE id = (SELECT id FROM subsidy_activity_ids WHERE name = 'main');

SELECT set_config('request.jwt.claims', '{}', true);
SELECT set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE service_role;
UPDATE public.student_subsidies SET price_cents = 2600
WHERE id = (SELECT id FROM subsidy_activity_ids WHERE name = 'main');
RESET ROLE;
SELECT ok((SELECT actor_staff_id IS NULL FROM public.domain_events
  WHERE recorded_at = transaction_timestamp() AND payload->'after'->>'price_cents' = '2600'),
  'system edits do not attribute the event to the original creator');

-- Student cascades and merge bookkeeping must not masquerade as manual removals.
SELECT set_config('app.student_merge_in_progress', 'true', true);
DELETE FROM public.student_subsidies WHERE student_id = '10000000-0000-0000-0000-000000000002';
SELECT set_config('app.student_merge_in_progress', 'false', true);
SELECT is((SELECT count(*) FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name = 'student.subsidy_removed'), 1::bigint, 'merge bookkeeping does not emit subsidy removals');
DELETE FROM public.students WHERE id = '10000000-0000-0000-0000-000000000001';
SELECT is((SELECT count(*) FROM public.domain_events WHERE recorded_at = transaction_timestamp() AND event_name = 'student.subsidy_removed'), 1::bigint, 'Student deletion does not emit cascade subsidy removals');

SELECT * FROM finish();
ROLLBACK;
