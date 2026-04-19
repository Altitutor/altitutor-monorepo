-- Generalised subscriptions + normalised subject access (class / subscription / manual)
-- Replaces student_ucat_subscriptions with student_subscriptions (per subject).
-- Adds vstudent_my_subject_access; refactors UCAT helpers and vstudent_ucat_my_access to use it.

-- ========================
-- 1) student_subscriptions
-- ========================
CREATE TABLE IF NOT EXISTS public.student_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_price_id TEXT,
  stripe_product_id TEXT,
  status TEXT NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_subscriptions_student_subject_unique UNIQUE (student_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_student_subscriptions_student_id ON public.student_subscriptions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_subscriptions_subject_id ON public.student_subscriptions(subject_id);
CREATE INDEX IF NOT EXISTS idx_student_subscriptions_stripe_subscription_id ON public.student_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_student_subscriptions_status ON public.student_subscriptions(status);

ALTER TABLE public.student_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to student_subscriptions" ON public.student_subscriptions;
CREATE POLICY "ADMINSTAFF full access to student_subscriptions" ON public.student_subscriptions
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "Students read own student_subscriptions" ON public.student_subscriptions;
CREATE POLICY "Students read own student_subscriptions" ON public.student_subscriptions
  FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());

COMMENT ON TABLE public.student_subscriptions IS 'Stripe subscription rows per student and subject. Source of truth for subscription billing; sync via webhooks.';

-- ========================
-- 2) Migrate from student_ucat_subscriptions (UCAT subject only)
-- ========================
INSERT INTO public.student_subscriptions (
  student_id,
  subject_id,
  stripe_subscription_id,
  stripe_price_id,
  stripe_product_id,
  status,
  current_period_start,
  current_period_end,
  created_at,
  updated_at
)
SELECT
  u.student_id,
  s.id,
  u.stripe_subscription_id,
  u.stripe_price_id,
  NULL::TEXT,
  u.status,
  u.current_period_start,
  u.current_period_end,
  u.created_at,
  u.updated_at
FROM public.student_ucat_subscriptions u
CROSS JOIN LATERAL (
  SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1
) s
ON CONFLICT (student_id, subject_id) DO NOTHING;

-- ========================
-- 3) Drop legacy UCAT-only subscription table
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to student_ucat_subscriptions" ON public.student_ucat_subscriptions;
DROP POLICY IF EXISTS "Students read own student_ucat_subscriptions" ON public.student_ucat_subscriptions;
DROP TABLE IF EXISTS public.student_ucat_subscriptions;

-- ========================
-- 4) Normalised access view (current student only; union of three sources)
-- ========================
CREATE OR REPLACE VIEW public.vstudent_my_subject_access
WITH (security_invoker = false)
AS
SELECT DISTINCT
  cs.student_id,
  c.subject_id,
  'class_enrollment'::TEXT AS access_source
FROM public.classes_students cs
JOIN public.classes c ON c.id = cs.class_id
WHERE cs.student_id = (SELECT public.current_student_id())
  AND cs.unenrolled_at IS NULL

UNION

SELECT DISTINCT
  ss.student_id,
  ss.subject_id,
  'subscription'::TEXT AS access_source
FROM public.student_subscriptions ss
WHERE ss.student_id = (SELECT public.current_student_id())
  AND ss.status IN ('trialing', 'active')

UNION

SELECT DISTINCT
  ssub.student_id,
  ssub.subject_id,
  'manual'::TEXT AS access_source
FROM public.students_subjects ssub
WHERE ssub.student_id = (SELECT public.current_student_id());

GRANT SELECT ON public.vstudent_my_subject_access TO authenticated;

COMMENT ON VIEW public.vstudent_my_subject_access IS 'Per-subject access for the current student: class_enrollment, subscription (trialing/active), or manual (students_subjects).';

-- ========================
-- 5) UCAT helpers — single source via vstudent_my_subject_access
-- ========================
CREATE OR REPLACE FUNCTION public.is_ucat_in_person_student()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vstudent_my_subject_access v
    WHERE v.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)
      AND v.access_source = 'class_enrollment'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_ucat_online_student()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vstudent_my_subject_access v
    WHERE v.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)
      AND v.access_source IN ('subscription', 'manual')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_ucat_student()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vstudent_my_subject_access v
    WHERE v.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)
  );
$$;

COMMENT ON FUNCTION public.is_ucat_in_person_student() IS 'UCAT via class enrollment (classes_students). Session-assigned content.';
COMMENT ON FUNCTION public.is_ucat_online_student() IS 'UCAT via active subscription (trialing/active) or manual students_subjects row.';
COMMENT ON FUNCTION public.is_ucat_student() IS 'Any UCAT access: class, subscription, or manual assignment.';

-- ========================
-- 6) vstudent_ucat_my_access — derived from normalised view
-- ========================
CREATE OR REPLACE VIEW public.vstudent_ucat_my_access
WITH (security_invoker = false)
AS
SELECT
  EXISTS (
    SELECT 1
    FROM public.vstudent_my_subject_access v
    WHERE v.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)
      AND v.access_source IN ('subscription', 'manual')
  ) AS has_online_access,
  EXISTS (
    SELECT 1
    FROM public.vstudent_my_subject_access v
    WHERE v.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)
      AND v.access_source = 'class_enrollment'
  ) AS has_in_person_access,
  EXISTS (
    SELECT 1
    FROM public.vstudent_my_subject_access v
    WHERE v.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)
  ) AS has_ucat_access
WHERE (SELECT public.current_student_id()) IS NOT NULL;
