-- Hide stale student lesson question blocks when the linked question is missing
-- or soft-deleted. Non-question blocks are unaffected.

CREATE OR REPLACE VIEW public.vstudent_ucat_learning_module_blocks
WITH (security_invoker = false)
AS
SELECT
  b.id,
  b.learning_module_id,
  b.block_type,
  b.index,
  b.require_completion_before_next,
  b.content,
  b.question_stem_id,
  b.question_id,
  b.file_id,
  b.skill_trainer_set_id,
  bp.completed_at AS block_completed_at,
  bp.manually_completed,
  bp.interaction_state
FROM public.ucat_learning_module_blocks b
JOIN public.ucat_learning_modules lm ON lm.id = b.learning_module_id
LEFT JOIN public.ucat_questions q
  ON q.id = b.question_id
LEFT JOIN public.ucat_student_learning_module_block_progress bp
  ON bp.learning_module_block_id = b.id
  AND bp.student_id = (SELECT public.current_student_id())
WHERE b.deleted_at IS NULL
  AND lm.deleted_at IS NULL
  AND lm.kind = 'lesson'
  AND (
    b.block_type <> 'question'
    OR (q.id IS NOT NULL AND q.deleted_at IS NULL)
  )
  AND public.can_student_access_ucat_learning_module(lm.id);

GRANT SELECT ON public.vstudent_ucat_learning_module_blocks TO authenticated;
