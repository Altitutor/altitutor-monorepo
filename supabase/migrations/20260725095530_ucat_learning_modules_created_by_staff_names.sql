-- Expose learning module creator staff names on vtutor_ucat_learning_modules
-- (matches vtutor_ucat_mocks / vtutor_ucat_question_sets).

DROP VIEW IF EXISTS public.vtutor_ucat_learning_modules;
CREATE VIEW public.vtutor_ucat_learning_modules
WITH (security_invoker = false)
AS
SELECT
  lm.id,
  lm.kind,
  lm.title,
  lm.description,
  lm.ucat_section_id,
  lm.parent_ucat_learning_module_id,
  lm.index,
  lm.status,
  lm.access_scope,
  lm.status_changed_at,
  lm.status_changed_by,
  lm.published_at,
  lm.published_by,
  lm.created_at,
  lm.updated_at,
  lm.created_by,
  lm.updated_by,
  lm.deleted_at,
  lm.deleted_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  s.name AS section_name,
  s.section_number,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.ucat_learning_modules child
    WHERE child.parent_ucat_learning_module_id = lm.id
      AND child.deleted_at IS NULL
  ) AS child_count,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.ucat_learning_module_blocks block
    WHERE block.learning_module_id = lm.id
      AND block.deleted_at IS NULL
  ) AS block_count,
  lm.study_plan_priority,
  lm.icon_key,
  lm.estimated_minutes
FROM public.ucat_learning_modules lm
LEFT JOIN public.ucat_sections s ON s.id = lm.ucat_section_id
LEFT JOIN public.staff created_staff ON created_staff.id = lm.created_by
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_learning_modules TO authenticated;
