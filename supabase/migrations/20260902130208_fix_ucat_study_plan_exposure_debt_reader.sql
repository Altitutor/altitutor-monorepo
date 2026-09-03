-- Study-plan generation reads missed exposure debt through the server-only
-- service-role client. The table was added after the deny-by-default privilege
-- migration, so its runtime grant must be explicit and least-privileged.
REVOKE ALL ON public.ucat_student_study_plan_exposure_debts
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.ucat_student_study_plan_exposure_debts
  TO service_role;

-- Recover both pending and dead-lettered refreshes that consumed retries while
-- this read privilege was missing. Restrict the repair to this exact failure.
UPDATE public.ucat_student_preparation_refresh_requests AS request
SET
  requested_at = clock_timestamp(),
  request_version = request.request_version + 1,
  processing_started_at = NULL,
  claimed_version = NULL,
  claim_token = NULL,
  claimed_reasons = NULL,
  attempt_count = 0,
  next_attempt_at = clock_timestamp(),
  dead_lettered_at = NULL,
  last_error = NULL,
  updated_at = clock_timestamp()
WHERE request.completed_at IS NULL
  AND request.last_error ILIKE
    '%permission denied for table ucat_student_study_plan_exposure_debts%';
