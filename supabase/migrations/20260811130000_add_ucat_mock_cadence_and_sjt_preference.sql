DROP VIEW public.vstudent_ucat_study_plan_profiles;

ALTER TABLE public.ucat_student_study_plan_profiles
  ADD COLUMN sjt_preference TEXT NOT NULL DEFAULT 'a_little',
  ADD CONSTRAINT ucat_student_study_plan_profiles_sjt_preference_check
    CHECK (sjt_preference IN ('normally', 'a_little', 'not_at_all'));

COMMENT ON COLUMN public.ucat_student_study_plan_profiles.sjt_preference IS
  'Student choice for standalone SJT allocation: normally (1.0), a_little (0.5), or not_at_all (0). Completed mock SJT remains preparation evidence.';

CREATE VIEW public.vstudent_ucat_study_plan_profiles
WITH (security_invoker = false) AS
SELECT profile.*
FROM public.ucat_student_study_plan_profiles profile
WHERE (SELECT public.is_student())
  AND profile.student_id = (SELECT public.current_student_id());

REVOKE ALL ON public.vstudent_ucat_study_plan_profiles FROM anon;
GRANT SELECT ON public.vstudent_ucat_study_plan_profiles TO authenticated;
