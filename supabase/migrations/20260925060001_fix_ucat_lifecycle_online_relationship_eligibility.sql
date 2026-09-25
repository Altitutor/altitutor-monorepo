-- UCAT lifecycle delivery follows the explicit online Product relationship.
-- students.status describes only the independent in-person relationship and
-- is therefore not an eligibility signal for an online-only Student.
CREATE OR REPLACE VIEW public.vinternal_ucat_lifecycle_email_candidates
WITH (security_invoker = TRUE)
AS
SELECT
  preferences.student_id,
  student.user_id AS auth_user_id,
  LOWER(TRIM(student.email)) AS email,
  student.first_name,
  student.last_name,
  student.timezone,
  student.status,
  student.ucat_signup_completed_at,
  student.ucat_initial_familiarity,
  assignment.cohort AS email_program_cohort,
  assignment.bucket AS email_program_bucket,
  assignment.posthog_synced_at AS email_program_posthog_synced_at,
  preferences.weekly_progress_and_guidance,
  preferences.lessons_and_tips,
  preferences.product_news,
  preferences.offers_and_referrals,
  preferences.unsubscribe_token,
  subscriber.consent_verified_at,
  subscriber.unsubscribed_at,
  public.get_student_ucat_online_tier(student.id) AS online_tier,
  subscription.started_at AS unlimited_started_at,
  subscription.billing_interval,
  activity.last_activity_at,
  activity.questions_last_7_days,
  activity.sets_last_7_days,
  activity.mocks_last_7_days,
  activity.active_days_last_7_days,
  activity.active_days_last_14_days,
  consistency.qualifying_days_last_7_days,
  (plan.student_id IS NOT NULL) AS has_study_plan,
  next_step.title AS next_step_title,
  next_step.launch_path AS next_step_path,
  projection.current_estimate,
  projection.first_estimate_generated_at,
  projection.previous_week_estimate,
  quota.last_quota_reached_at,
  quota.last_quota_area,
  referral.has_open_referral_or_reward,
  config.min_questions_per_day,
  config.currency,
  pricing.monthly_base_price_cents,
  pricing.monthly_discount_per_day_cents,
  pricing.monthly_max_discount_days,
  delivery.last_optional_sent_at,
  delivery.last_restart_sent_at,
  delivery.last_upgrade_sent_at,
  delivery.last_referral_sent_at,
  delivery.sent_onboarding_starting_point,
  delivery.sent_onboarding_technique,
  delivery.sent_onboarding_timing,
  delivery.sent_onboarding_plan,
  delivery.sent_first_score_estimate,
  EXISTS (
    SELECT 1
    FROM public.student_online_product_relationships relationship
    WHERE relationship.student_id = student.id
      AND relationship.product = 'UCAT_WEB'
      AND relationship.closed_at IS NULL
  ) AS has_open_ucat_relationship
FROM public.ucat_communication_preferences preferences
JOIN public.students student ON student.id = preferences.student_id
JOIN public.newsletter_subscribers subscriber
  ON subscriber.student_id = student.id
 AND subscriber.auth_user_id = student.user_id
LEFT JOIN public.ucat_email_program_assignments assignment
  ON assignment.student_id = student.id
LEFT JOIN LATERAL (
  SELECT
    subscription.created_at AS started_at,
    subscription.billing_interval
  FROM public.student_subscriptions subscription
  WHERE subscription.student_id = student.id
    AND subscription.subject_id = public.get_ucat_subject_id()
    AND subscription.plan_tier = 'unlimited'
    AND subscription.status IN ('active', 'past_due')
  ORDER BY subscription.created_at DESC
  LIMIT 1
) subscription ON TRUE
LEFT JOIN public.ucat_student_study_plan_profiles plan
  ON plan.student_id = student.id
 AND plan.setup_completed_at IS NOT NULL
LEFT JOIN LATERAL (
  SELECT step.title, step.launch_path
  FROM public.ucat_student_next_steps step
  WHERE step.student_id = student.id AND step.position = 1
  LIMIT 1
) next_step ON TRUE
LEFT JOIN LATERAL (
  SELECT
    current_snapshot.current_estimate,
    first_snapshot.first_estimate_generated_at,
    previous_snapshot.current_estimate AS previous_week_estimate
  FROM (
    SELECT snapshot.current_estimate
    FROM public.ucat_score_projection_snapshots snapshot
    WHERE snapshot.student_id = student.id
    ORDER BY snapshot.generated_at DESC
    LIMIT 1
  ) current_snapshot
  CROSS JOIN LATERAL (
    SELECT MIN(snapshot.generated_at) AS first_estimate_generated_at
    FROM public.ucat_score_projection_snapshots snapshot
    WHERE snapshot.student_id = student.id
  ) first_snapshot
  LEFT JOIN LATERAL (
    SELECT snapshot.current_estimate
    FROM public.ucat_score_projection_snapshots snapshot
    WHERE snapshot.student_id = student.id
      AND snapshot.snapshot_date <= CURRENT_DATE - 7
    ORDER BY snapshot.snapshot_date DESC
    LIMIT 1
  ) previous_snapshot ON TRUE
) projection ON TRUE
LEFT JOIN LATERAL (
  SELECT
    MAX(point.occurred_at) AS last_activity_at,
    COUNT(*) FILTER (
      WHERE point.kind = 'question'
        AND point.occurred_at >= NOW() - INTERVAL '7 days'
    )::INTEGER AS questions_last_7_days,
    COUNT(*) FILTER (
      WHERE point.kind = 'set'
        AND point.occurred_at >= NOW() - INTERVAL '7 days'
    )::INTEGER AS sets_last_7_days,
    COUNT(*) FILTER (
      WHERE point.kind = 'mock'
        AND point.occurred_at >= NOW() - INTERVAL '7 days'
    )::INTEGER AS mocks_last_7_days,
    COUNT(DISTINCT (point.occurred_at AT TIME ZONE COALESCE(student.timezone, 'Australia/Adelaide'))::DATE)
      FILTER (WHERE point.occurred_at >= NOW() - INTERVAL '7 days')::INTEGER
      AS active_days_last_7_days,
    COUNT(DISTINCT (point.occurred_at AT TIME ZONE COALESCE(student.timezone, 'Australia/Adelaide'))::DATE)
      FILTER (WHERE point.occurred_at >= NOW() - INTERVAL '14 days')::INTEGER
      AS active_days_last_14_days
  FROM (
    SELECT question_attempt.attempted_at AS occurred_at, 'question'::TEXT AS kind
    FROM public.student_question_attempts question_attempt
    LEFT JOIN public.student_question_set_attempts parent_set
      ON parent_set.id = question_attempt.student_question_set_attempt_id
    LEFT JOIN public.student_practice_sessions parent_practice
      ON parent_practice.id = question_attempt.student_practice_session_id
    WHERE question_attempt.student_id = student.id
      AND question_attempt.is_submitted = TRUE
      AND (
        question_attempt.student_question_set_attempt_id IS NULL
        OR parent_set.discarded_at IS NULL
      )
      AND (
        question_attempt.student_practice_session_id IS NULL
        OR parent_practice.discarded_at IS NULL
      )
    UNION ALL
    SELECT completed_at, 'set'::TEXT
    FROM public.student_question_set_attempts
    WHERE student_id = student.id
      AND completed_at IS NOT NULL
      AND discarded_at IS NULL
    UNION ALL
    SELECT completed_at, 'mock'::TEXT
    FROM public.student_ucat_mock_attempts
    WHERE student_id = student.id
      AND completed_at IS NOT NULL
      AND discarded_at IS NULL
    UNION ALL
    SELECT completed_at, 'trainer'::TEXT
    FROM public.student_skill_trainer_attempts
    WHERE student_id = student.id
      AND completed_at IS NOT NULL
      AND discarded_at IS NULL
  ) point
) activity ON TRUE
CROSS JOIN LATERAL (
  SELECT subscription_config.min_questions_per_day,
         subscription_config.currency
  FROM public.ucat_subscription_config subscription_config
  LIMIT 1
) config
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INTEGER AS qualifying_days_last_7_days
  FROM (
    SELECT
      (attempt.attempted_at AT TIME ZONE COALESCE(student.timezone, 'Australia/Adelaide'))::DATE
        AS practice_date
    FROM public.student_question_attempts attempt
    LEFT JOIN public.student_question_set_attempts parent_set
      ON parent_set.id = attempt.student_question_set_attempt_id
    LEFT JOIN public.student_practice_sessions parent_practice
      ON parent_practice.id = attempt.student_practice_session_id
    WHERE attempt.student_id = student.id
      AND attempt.is_submitted = TRUE
      AND (
        attempt.student_question_set_attempt_id IS NULL
        OR parent_set.discarded_at IS NULL
      )
      AND (
        attempt.student_practice_session_id IS NULL
        OR parent_practice.discarded_at IS NULL
      )
      AND attempt.attempted_at >= NOW() - INTERVAL '7 days'
    GROUP BY practice_date
    HAVING COUNT(*) >= config.min_questions_per_day
  ) qualifying_day
) consistency ON TRUE
LEFT JOIN LATERAL (
  SELECT
    price.base_price_cents AS monthly_base_price_cents,
    discount.discount_per_day_cents AS monthly_discount_per_day_cents,
    discount.max_discounts_per_period AS monthly_max_discount_days
  FROM public.ucat_plan_prices price
  JOIN public.ucat_practice_day_discount_config discount
    ON discount.billing_interval = price.billing_interval
  WHERE price.plan_tier = 'unlimited'
    AND price.billing_interval = 'month'
  LIMIT 1
) pricing ON TRUE
LEFT JOIN LATERAL (
  SELECT
    notification.created_at AS last_quota_reached_at,
    notification.metadata ->> 'quota_area' AS last_quota_area
  FROM public.notifications notification
  WHERE notification.student_id = student.id
    AND notification.notification_type = 'ucat.quota.limit_reached'
  ORDER BY notification.created_at DESC NULLS LAST
  LIMIT 1
) quota ON TRUE
LEFT JOIN LATERAL (
  SELECT (
    EXISTS (
      SELECT 1 FROM public.ucat_referrals referral
      WHERE referral.referrer_student_id = student.id
        AND referral.gift_status IN ('pending', 'checkout_pending')
    )
    OR EXISTS (
      SELECT 1 FROM public.ucat_referral_bill_rewards reward
      WHERE reward.student_id = student.id
        AND reward.status IN ('queued', 'applied')
    )
  ) AS has_open_referral_or_reward
) referral ON TRUE
LEFT JOIN LATERAL (
  SELECT
    MAX(ledger.sent_at) FILTER (WHERE ledger.status = 'sent')
      AS last_optional_sent_at,
    MAX(ledger.sent_at) FILTER (
      WHERE ledger.status = 'sent'
        AND ledger.campaign_key = 'gentle_restart'
    ) AS last_restart_sent_at,
    MAX(ledger.sent_at) FILTER (
      WHERE ledger.status = 'sent'
        AND ledger.campaign_key IN ('upgrade_quota', 'upgrade_consistency')
    ) AS last_upgrade_sent_at,
    MAX(ledger.sent_at) FILTER (
      WHERE ledger.status = 'sent'
        AND ledger.campaign_key = 'referral_invitation'
    ) AS last_referral_sent_at,
    BOOL_OR(ledger.status = 'sent' AND ledger.campaign_key = 'onboarding_starting_point')
      AS sent_onboarding_starting_point,
    BOOL_OR(ledger.status = 'sent' AND ledger.campaign_key = 'onboarding_technique')
      AS sent_onboarding_technique,
    BOOL_OR(ledger.status = 'sent' AND ledger.campaign_key = 'onboarding_timing')
      AS sent_onboarding_timing,
    BOOL_OR(ledger.status = 'sent' AND ledger.campaign_key = 'onboarding_plan')
      AS sent_onboarding_plan,
    BOOL_OR(ledger.status = 'sent' AND ledger.campaign_key = 'first_score_estimate')
      AS sent_first_score_estimate
  FROM public.ucat_email_delivery_ledger ledger
  WHERE ledger.student_id = student.id
) delivery ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.ucat_email_suppressions suppression
  WHERE suppression.email = LOWER(TRIM(student.email))
    AND suppression.active = TRUE
);

REVOKE ALL ON public.vinternal_ucat_lifecycle_email_candidates
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vinternal_ucat_lifecycle_email_candidates TO service_role;

COMMENT ON VIEW public.vinternal_ucat_lifecycle_email_candidates IS
  'Service-only, paginated evidence for UCAT optional-email eligibility using the canonical open Product relationship. Never expose through a student client.';
