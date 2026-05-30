-- Pay tier base tables: ADMINSTAFF only (direct). Tutors read via vtutor_* views only.
-- Aligns with tutor_logs pattern (see 20251228093002_remove_tutor_direct_write_rls.sql).

DROP POLICY IF EXISTS "Tutors read staff_pay_tiers" ON public.staff_pay_tiers;
DROP POLICY IF EXISTS "Tutors read staff_pay_tier_requirements" ON public.staff_pay_tier_requirements;
DROP POLICY IF EXISTS "Tutors read own staff_tier_promotions" ON public.staff_tier_promotions;

COMMENT ON TABLE public.staff_pay_tiers IS
  'Org pay tier ladder. ADMINSTAFF: direct access. Tutors: read via vtutor_pay_tiers only.';

COMMENT ON TABLE public.staff_pay_tier_requirements IS
  'Tier advancement requirements. ADMINSTAFF: direct access. Tutors: read via vtutor_pay_tier_requirements only.';

COMMENT ON TABLE public.staff_tier_promotions IS
  'Tier promotion reviews. ADMINSTAFF: direct access. Tutors: read own rows via vtutor_staff_tier_promotions only.';
