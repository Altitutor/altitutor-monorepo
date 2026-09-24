-- Trial tutors need the same TutorWeb facades as ACTIVE tutors.
-- current_tutor_id() / is_tutor() previously required ACTIVE only, so a signed-in
-- trial tutor received no vtutor_profile row and TutorWeb treated them as denied.

CREATE OR REPLACE FUNCTION public.is_tutor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff AS staff_record
    WHERE staff_record.user_id = (SELECT auth.uid())
      AND staff_record.role IN ('TUTOR', 'ADMINSTAFF')
      AND staff_record.status IN ('ACTIVE', 'TRIAL')
  );
$$;

COMMENT ON FUNCTION public.is_tutor() IS
  'Returns true if the current authenticated user is an ACTIVE or TRIAL tutor or admin staff.';

CREATE OR REPLACE FUNCTION public.current_tutor_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT staff_record.id
  FROM public.staff AS staff_record
  WHERE staff_record.user_id = (SELECT auth.uid())
    AND staff_record.role IN ('TUTOR', 'ADMINSTAFF')
    AND staff_record.status IN ('ACTIVE', 'TRIAL')
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.current_tutor_id() IS
  'Returns the staff ID for the current authenticated ACTIVE or TRIAL tutor or admin staff.';

REVOKE ALL ON FUNCTION public.is_tutor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tutor() TO authenticated;

REVOKE ALL ON FUNCTION public.current_tutor_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tutor_id() TO authenticated;
