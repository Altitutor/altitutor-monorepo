-- Tutor-web reads pay tier data via security definer views only (no tutor RLS on base tables).
-- Base tables remain ADMINSTAFF-only; see 20260530150000_pay_tiers_remove_tutor_base_table_access.sql.

-- Org-wide pay ladder (all tiers) for active tutors
CREATE OR REPLACE VIEW public.vtutor_pay_tiers
WITH (security_invoker = false)
AS
SELECT
  t.tier_number,
  t.name,
  t.base_pay_rate_cents,
  t.currency,
  t.created_at,
  t.updated_at
FROM public.staff_pay_tiers t
WHERE public.is_tutor();

GRANT SELECT ON public.vtutor_pay_tiers TO authenticated;

COMMENT ON VIEW public.vtutor_pay_tiers IS
  'Tutor view: org pay tier ladder (read-only). Use instead of staff_pay_tiers.';

-- Advancement requirements for each tier
CREATE OR REPLACE VIEW public.vtutor_pay_tier_requirements
WITH (security_invoker = false)
AS
SELECT
  r.id,
  r.tier_number,
  r.requirement_kind,
  r.params,
  r.sort_order,
  r.created_at,
  r.updated_at
FROM public.staff_pay_tier_requirements r
WHERE public.is_tutor();

GRANT SELECT ON public.vtutor_pay_tier_requirements TO authenticated;

COMMENT ON VIEW public.vtutor_pay_tier_requirements IS
  'Tutor view: pay tier advancement requirements (read-only).';

-- Own promotion review history
CREATE OR REPLACE VIEW public.vtutor_staff_tier_promotions
WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.staff_id,
  p.from_tier_number,
  p.to_tier_number,
  p.check_in_session_id,
  p.outcome,
  p.notes,
  p.reviewed_by,
  p.reviewed_at,
  p.created_at
FROM public.staff_tier_promotions p
WHERE p.staff_id = public.current_tutor_id()
  AND public.is_tutor();

GRANT SELECT ON public.vtutor_staff_tier_promotions TO authenticated;

COMMENT ON VIEW public.vtutor_staff_tier_promotions IS
  'Tutor view: own tier promotion review records (read-only).';

-- Own tier fields on staff (current tier, tenure, overrides)
CREATE OR REPLACE VIEW public.vtutor_pay_tier_profile
WITH (security_invoker = false)
AS
SELECT
  s.id AS staff_id,
  s.current_tier_number,
  s.employment_started_at,
  s.metric_overrides
FROM public.staff s
WHERE s.id = public.current_tutor_id()
  AND public.is_tutor();

GRANT SELECT ON public.vtutor_pay_tier_profile TO authenticated;

COMMENT ON VIEW public.vtutor_pay_tier_profile IS
  'Tutor view: own pay tier progression fields on staff (read-only).';
