-- Extend vtutor_ucat_mock_detail sets JSON to include sections and question_count
-- so the mocks page can compute exam alignment status (green/orange/red)

DROP VIEW IF EXISTS public.vtutor_ucat_mock_detail;
CREATE VIEW public.vtutor_ucat_mock_detail
WITH (security_invoker = false)
AS
SELECT
  m.id,
  m.name,
  m.is_private,
  m.instructions_text,
  m.created_at,
  m.updated_at,
  m.created_by,
  m.updated_by,
  m.deleted_at,
  m.deleted_by,
  (
    SELECT json_agg(
      json_build_object(
        'id', vqs.id,
        'name', vqs.name,
        'description', vqs.description,
        'time_limit_seconds', vqs.time_limit_seconds,
        'sections', vqs.sections,
        'question_count', vqs.question_count
      )
      ORDER BY qsum.index
    )
    FROM public.question_sets_ucat_mocks qsum
    JOIN public.vtutor_ucat_question_sets vqs ON vqs.id = qsum.question_set_id
    WHERE qsum.ucat_mock_id = m.id
  ) AS sets
FROM public.ucat_mocks m
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_mock_detail TO authenticated;
