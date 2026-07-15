ALTER TABLE public.form_responses
  ADD COLUMN recorded_by_staff_id uuid NULL REFERENCES public.staff(id) ON DELETE SET NULL;

CREATE INDEX form_responses_recorded_by_staff_id_idx
  ON public.form_responses(recorded_by_staff_id)
  WHERE recorded_by_staff_id IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.form_responses.recorded_by_staff_id IS
  'Staff member who entered a response on behalf of the respondent. Null for self-service submissions.';

CREATE OR REPLACE FUNCTION public.get_form_model_options(p_source text)
RETURNS TABLE(value text, label text)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  CASE p_source
    WHEN 'staff' THEN
      RETURN QUERY
      SELECT staff.id::text, COALESCE(
        NULLIF(trim(concat_ws(' ', NULLIF(trim(staff.first_name), ''), NULLIF(trim(staff.last_name), ''))), ''),
        staff.id::text
      )
      FROM public.staff
      WHERE staff.role = 'TUTOR'
        AND staff.status = 'ACTIVE'
      ORDER BY staff.first_name, staff.last_name, staff.id;
    WHEN 'classes' THEN
      RETURN QUERY
      SELECT classes.id::text, COALESCE(NULLIF(trim(classes.long_name), ''), NULLIF(trim(classes.short_name), ''), classes.id::text)
      FROM public.classes
      WHERE classes.status = 'ACTIVE'
      ORDER BY COALESCE(NULLIF(trim(classes.long_name), ''), NULLIF(trim(classes.short_name), ''), classes.id::text), classes.id;
    WHEN 'subjects' THEN
      RETURN QUERY
      SELECT subjects.id::text, COALESCE(NULLIF(trim(subjects.long_name), ''), NULLIF(trim(subjects.name), ''), subjects.id::text)
      FROM public.subjects
      ORDER BY COALESCE(NULLIF(trim(subjects.long_name), ''), NULLIF(trim(subjects.name), ''), subjects.id::text), subjects.id;
    WHEN 'topics' THEN
      RETURN QUERY
      SELECT topics.id::text, COALESCE(
        NULLIF(concat_ws(' - ', NULLIF(trim(topics.code), ''), NULLIF(trim(topics.name), '')), ''),
        topics.id::text
      )
      FROM public.topics
      ORDER BY topics.code, topics.name, topics.id;
    ELSE
      RAISE EXCEPTION 'Unsupported form model option source: %', p_source USING ERRCODE = '22023';
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.get_form_model_options(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_form_model_options(text) TO service_role;

COMMENT ON FUNCTION public.get_form_model_options(text) IS
  'Returns the allowlisted value and label pairs available to model-backed form choice questions.';
