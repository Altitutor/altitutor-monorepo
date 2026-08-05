-- Staff who already have an authenticated account predate Tutor onboarding.
-- Grandfather them as complete so a future onboarding gate only applies to
-- newly invited staff.

UPDATE public.staff
SET onboarding_completed_at = now()
WHERE user_id IS NOT NULL
  AND onboarding_completed_at IS NULL;
