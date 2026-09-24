-- Align tutor resource subjects with UCAT tutor access:
-- staff_subjects (profile) OR a current class assignment.
-- Also ignore unassigned classes_staff rows, matching is_ucat_tutor().

CREATE OR REPLACE VIEW public.vtutor_subjects
WITH (security_invoker = false)
AS
SELECT DISTINCT
  sub.id,
  sub.name,
  sub.curriculum,
  sub.discipline,
  sub.level,
  sub.color,
  sub.year_level,
  sub.short_name,
  sub.long_name,
  sub.created_at,
  sub.updated_at
FROM public.subjects sub
WHERE sub.id IN (
  SELECT ss.subject_id
  FROM public.staff_subjects ss
  WHERE ss.staff_id = public.current_tutor_id()

  UNION

  SELECT c.subject_id
  FROM public.classes c
  JOIN public.classes_staff cs ON cs.class_id = c.id
  WHERE cs.staff_id = public.current_tutor_id()
    AND cs.unassigned_at IS NULL
    AND c.subject_id IS NOT NULL
);

GRANT SELECT ON public.vtutor_subjects TO authenticated;

COMMENT ON VIEW public.vtutor_subjects IS
  'Tutor view: subjects the current tutor may access via staff_subjects or a current class assignment. Same grant rule as is_ucat_tutor() for the UCAT subject.';
