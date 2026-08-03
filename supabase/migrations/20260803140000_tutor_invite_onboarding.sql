-- Tutor invite onboarding records Altitutor-owned setup evidence only.
-- Payroll identifiers (TFN, banking and superannuation) remain in the payroll
-- provider's employee self-setup flow and are deliberately not stored here.

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS child_safe_agreement_number text,
  ADD COLUMN IF NOT EXISTS child_safe_policy_agreed_at timestamptz;

COMMENT ON COLUMN public.staff.onboarding_completed_at IS
  'When the staff member completed the Tutor invite onboarding journey.';

COMMENT ON COLUMN public.staff.child_safe_agreement_number IS
  'Altitutor child-safe agreement identifier supplied by the staff member.';

COMMENT ON COLUMN public.staff.child_safe_policy_agreed_at IS
  'When the staff member agreed to follow the Altitutor Child Safe Policy.';
