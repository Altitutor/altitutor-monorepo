-- Rename campaign labels to match the rewritten lifecycle jobs.
-- Keys stay stable so eligibility, dedupe, and holdouts are unchanged.

UPDATE public.ucat_email_campaign_controls
SET display_name = CASE campaign_key
  WHEN 'onboarding_plan' THEN 'Onboarding 4 · Attempt review'
  WHEN 'first_score_estimate' THEN 'Progress · category breakdown'
  ELSE display_name
END
WHERE campaign_key IN ('onboarding_plan', 'first_score_estimate');
