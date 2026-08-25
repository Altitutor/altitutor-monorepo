BEGIN;
SELECT plan(14);

SELECT public.enqueue_ucat_preparation_refresh(
  '10000000-0000-0000-0000-000000000010',
  'score_evidence'
);
SELECT public.enqueue_ucat_preparation_refresh(
  '10000000-0000-0000-0000-000000000010',
  'activity_completed'
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.ucat_student_preparation_refresh_requests
    WHERE student_id = '10000000-0000-0000-0000-000000000010'
  ),
  1::bigint,
  'refresh requests coalesce to one row per Student'
);

SELECT ok(
  (
    SELECT requested_reasons @> ARRAY['score_evidence', 'activity_completed']
    FROM public.ucat_student_preparation_refresh_requests
    WHERE student_id = '10000000-0000-0000-0000-000000000010'
  ),
  'coalesced request retains every reason'
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.claim_ucat_preparation_refreshes(
      1,
      '10000000-0000-0000-0000-000000000010'
    )
  ),
  1::bigint,
  'the pending Student refresh is claimed once'
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.claim_ucat_preparation_refreshes(
      1,
      '10000000-0000-0000-0000-000000000010'
    )
  ),
  0::bigint,
  'an active claim cannot fan out into a duplicate refresh'
);

SELECT public.enqueue_ucat_preparation_refresh(
  '10000000-0000-0000-0000-000000000010',
  'new_activity_during_refresh'
);

SELECT public.complete_ucat_preparation_refresh(
  '10000000-0000-0000-0000-000000000010',
  NULL
);

SELECT ok(
  (
    SELECT completed_at IS NOT NULL AND processing_started_at IS NULL
    FROM public.ucat_student_preparation_refresh_requests
    WHERE student_id = '10000000-0000-0000-0000-000000000010'
  ),
  'successful completion records the refresh and releases its claim'
);

SELECT ok(
  (
    SELECT requested_reasons @> ARRAY['new_activity_during_refresh']
    FROM public.ucat_student_preparation_refresh_requests
    WHERE student_id = '10000000-0000-0000-0000-000000000010'
  ),
  'an event arriving during a refresh is not cleared by that refresh'
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.claim_ucat_preparation_refreshes(
      1,
      '10000000-0000-0000-0000-000000000010'
    )
  ),
  1::bigint,
  'an event arriving during a refresh remains pending for the next worker'
);

SELECT public.complete_ucat_preparation_refresh(
  '10000000-0000-0000-0000-000000000010',
  'deterministic failure'
);

SELECT ok(
  (
    SELECT next_attempt_at > clock_timestamp()
      AND dead_lettered_at IS NULL
    FROM public.ucat_student_preparation_refresh_requests
    WHERE student_id = '10000000-0000-0000-0000-000000000010'
  ),
  'a failed refresh receives exponential retry backoff'
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.claim_ucat_preparation_refreshes(
      1,
      '10000000-0000-0000-0000-000000000010'
    )
  ),
  0::bigint,
  'a backed-off refresh cannot immediately occupy another worker slot'
);

SELECT public.enqueue_ucat_preparation_refresh(
  '10000000-0000-0000-0000-000000000010',
  'scheduled_rebalance'
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.claim_ucat_preparation_refreshes(
      1,
      '10000000-0000-0000-0000-000000000010'
    )
  ),
  0::bigint,
  'a duplicate scheduled request does not bypass failure backoff'
);

DO $$
BEGIN
  FOR retry IN 2..5 LOOP
    UPDATE public.ucat_student_preparation_refresh_requests
    SET next_attempt_at = clock_timestamp()
    WHERE student_id = '10000000-0000-0000-0000-000000000010';
    PERFORM * FROM public.claim_ucat_preparation_refreshes(
      1,
      '10000000-0000-0000-0000-000000000010'
    );
    PERFORM public.complete_ucat_preparation_refresh(
      '10000000-0000-0000-0000-000000000010',
      'deterministic failure'
    );
  END LOOP;
END;
$$;

SELECT ok(
  (
    SELECT dead_lettered_at IS NOT NULL AND attempt_count = 5
    FROM public.ucat_student_preparation_refresh_requests
    WHERE student_id = '10000000-0000-0000-0000-000000000010'
  ),
  'five deterministic failures move the request to terminal dead-letter state'
);

SELECT public.enqueue_ucat_preparation_refresh(
  '10000000-0000-0000-0000-000000000010',
  'activity_completed'
);

SELECT ok(
  (
    SELECT dead_lettered_at IS NULL
      AND attempt_count = 0
      AND next_attempt_at <= clock_timestamp()
    FROM public.ucat_student_preparation_refresh_requests
    WHERE student_id = '10000000-0000-0000-0000-000000000010'
  ),
  'genuinely new activity revives a previously dead-lettered Student'
);

INSERT INTO public.ucat_student_learning_module_progress (
  student_id,
  learning_module_id
)
SELECT
  '10000000-0000-0000-0000-000000000007',
  module.id
FROM public.ucat_learning_modules module
WHERE module.deleted_at IS NULL
LIMIT 1
ON CONFLICT (student_id, learning_module_id) DO UPDATE
SET completed_at = NULL;

UPDATE public.ucat_student_learning_module_progress
SET completed_at = clock_timestamp()
WHERE student_id = '10000000-0000-0000-0000-000000000007';

SELECT ok(
  (
    SELECT requested_reasons @> ARRAY['activity_completed']
    FROM public.ucat_student_preparation_refresh_requests
    WHERE student_id = '10000000-0000-0000-0000-000000000007'
  ),
  'Learn completion enqueues immediate Study-plan reconciliation'
);

INSERT INTO public.student_skill_trainer_attempts (
  student_id,
  skill_trainer_id,
  ends_at
)
SELECT
  '10000000-0000-0000-0000-000000000008',
  trainer.id,
  clock_timestamp() + interval '1 minute'
FROM public.ucat_skill_trainers trainer
WHERE trainer.is_enabled
LIMIT 1;

UPDATE public.student_skill_trainer_attempts
SET completed_at = clock_timestamp()
WHERE student_id = '10000000-0000-0000-0000-000000000008'
  AND completed_at IS NULL;

SELECT ok(
  (
    SELECT requested_reasons @> ARRAY['activity_completed']
    FROM public.ucat_student_preparation_refresh_requests
    WHERE student_id = '10000000-0000-0000-0000-000000000008'
  ),
  'Skill-trainer completion enqueues immediate Study-plan reconciliation'
);

SELECT * FROM finish();
ROLLBACK;
