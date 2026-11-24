BEGIN;
SELECT plan(6);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000010', id
FROM public.subjects WHERE name = 'Medicine Interview'
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE submitted_command (
  actor_id uuid NOT NULL,
  payload jsonb NOT NULL,
  response jsonb NOT NULL
);

WITH request AS (
  SELECT '00000000-0000-0000-0000-000000000010'::uuid AS actor_id,
    '{"type":"saveTag","commandId":"e4950000-0000-4000-8000-000000000001",
      "tag":{"id":"e4950000-0000-4000-8000-000000000002","name":"Communication"},
      "extra":[{"score":4.00},null,[]]}'::jsonb AS payload
)
INSERT INTO submitted_command
SELECT actor_id, payload, public.interview_command(actor_id, payload) FROM request;

SELECT is(
  (SELECT response FROM submitted_command),
  '{"id":"e4950000-0000-4000-8000-000000000002","version":1}'::jsonb,
  'a new command applies normally'
);
SELECT matches(
  (SELECT command #>> '{}' FROM public.interview_command_receipts
    WHERE command_id = 'e4950000-0000-4000-8000-000000000001'),
  '^sha256:[0-9a-f]{64}$', 'new receipts contain only a SHA-256 payload hash'
);
SELECT is(
  (SELECT public.interview_command(actor_id, jsonb_set(payload, '{extra,0,score}', '4'))
   FROM submitted_command),
  (SELECT response FROM submitted_command),
  'a retry with equivalent JSONB numbers returns the original result'
);
SELECT throws_ok(
  $$SELECT public.interview_command(actor_id, jsonb_set(payload, '{tag,name}', '"Changed"'))
    FROM submitted_command$$,
  '22023', 'Command ID already used', 'a changed payload cannot reuse a command ID'
);
SELECT throws_ok(
  $$SELECT public.interview_command(actor_id, jsonb_set(payload, '{extra}', '[[],null,{"score":4}]'))
    FROM submitted_command$$,
  '22023', 'Command ID already used', 'array order remains significant when comparing retries'
);
SELECT is(
  (SELECT name FROM public.interview_tags WHERE id = 'e4950000-0000-4000-8000-000000000002'),
  'Communication', 'rejected retries leave the command effect alone'
);

SELECT * FROM finish();
ROLLBACK;
