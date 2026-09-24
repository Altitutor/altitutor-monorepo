-- Disabled skill trainers must disappear from student lessons as well as the
-- standalone skill-trainer catalog. Tutor authoring views remain unchanged.

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
  b.skill_trainer_id,
  bp.completed_at AS block_completed_at,
  bp.manually_completed,
  bp.interaction_state
FROM public.ucat_learning_module_blocks b
JOIN public.vstudent_ucat_accessible_learning_modules alm
  ON alm.id = b.learning_module_id
JOIN public.ucat_learning_modules lm
  ON lm.id = b.learning_module_id
LEFT JOIN public.question_stems qs
  ON qs.id = b.question_stem_id
LEFT JOIN public.ucat_questions q
  ON q.id = b.question_id
LEFT JOIN public.question_stems q_stem
  ON q_stem.id = q.question_stem_id
LEFT JOIN public.ucat_skill_trainers skill_trainer
  ON skill_trainer.id = b.skill_trainer_id
LEFT JOIN public.ucat_student_learning_module_block_progress bp
  ON bp.learning_module_block_id = b.id
  AND bp.student_id = (SELECT student_id FROM public.vstudent_ucat_access_context)
WHERE b.deleted_at IS NULL
  AND lm.deleted_at IS NULL
  AND lm.kind = 'lesson'
  AND (
    b.block_type <> 'question_stem'
    OR (
      qs.id IS NOT NULL
      AND qs.deleted_at IS NULL
      AND qs.approval_status = 'approved'
    )
  )
  AND (
    b.block_type <> 'question'
    OR (
      q.id IS NOT NULL
      AND q.deleted_at IS NULL
      AND q_stem.id IS NOT NULL
      AND q_stem.deleted_at IS NULL
      AND q_stem.approval_status = 'approved'
    )
  )
  AND (
    b.block_type <> 'skill_trainer'
    OR skill_trainer.is_enabled = true
  );

GRANT SELECT ON public.vstudent_ucat_learning_module_blocks TO authenticated;
