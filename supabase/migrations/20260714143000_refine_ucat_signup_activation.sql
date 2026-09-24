-- Signup step 3 is now the unscored guided UCAT sampler. Study plan setup
-- follows the plan decision as optional activation and is not a signup gate.
COMMENT ON COLUMN public.students.ucat_signup_step IS
  'Current signup onboarding step (1=details, 2=password, 3=guided UCAT sampler, 4=plan or referral-gift choice).';
