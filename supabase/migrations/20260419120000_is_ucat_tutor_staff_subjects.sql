-- UCAT tutor access: grant to tutors who have UCAT on their profile (staff_subjects),
-- not only those assigned to a UCAT class. Keeps the previous class-assignment path so
-- existing access remains if staff_subjects is missing for legacy rows.

CREATE OR REPLACE FUNCTION public.is_ucat_tutor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff_subjects ss
    WHERE ss.staff_id = public.current_tutor_id()
      AND ss.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)
  )
  OR EXISTS (
    SELECT 1
    FROM public.classes c
    JOIN public.classes_staff cs ON c.id = cs.class_id
    WHERE c.subject_id = (SELECT id FROM public.subjects WHERE name = 'UCAT' LIMIT 1)
      AND cs.staff_id = public.current_tutor_id()
      AND cs.unassigned_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.is_ucat_tutor() IS 'Returns true if the current tutor has UCAT as a subject (staff_subjects) or is assigned to a UCAT class. Used in vtutor_ucat_* views and tutor-web UCAT access.';
