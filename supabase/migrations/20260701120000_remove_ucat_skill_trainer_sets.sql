-- Remove UCAT skill trainer sets. Learning module blocks now reference a
-- skill trainer type directly and embedded learn sessions draw random bank items.

DROP VIEW IF EXISTS public.vstudent_ucat_learning_module_blocks;
DROP VIEW IF EXISTS public.vtutor_ucat_learning_module_blocks;
DROP VIEW IF EXISTS public.vtutor_ucat_skill_trainer_set_items;
DROP VIEW IF EXISTS public.vtutor_ucat_skill_trainer_sets;

DROP FUNCTION IF EXISTS public.tutor_ucat_replace_learning_module_blocks(UUID, JSONB);
DROP FUNCTION IF EXISTS public.tutor_ucat_upsert_skill_trainer_set(UUID, UUID, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.tutor_ucat_replace_skill_trainer_set_items(UUID, JSONB);
DROP FUNCTION IF EXISTS public.tutor_ucat_soft_delete_skill_trainer_set(UUID);
DROP FUNCTION IF EXISTS public.can_student_access_ucat_skill_trainer_set(UUID);

ALTER TABLE public.ucat_learning_module_blocks
  DROP CONSTRAINT IF EXISTS ucat_learning_module_blocks_type_payload,
  ADD COLUMN IF NOT EXISTS skill_trainer_id UUID REFERENCES public.ucat_skill_trainers(id) ON DELETE RESTRICT;

UPDATE public.ucat_learning_module_blocks b
SET
  skill_trainer_id = s.skill_trainer_id,
  content = jsonb_set(
    COALESCE(b.content, '{}'::jsonb),
    '{trainerKey}',
    to_jsonb(t.key),
    true
  )
FROM public.ucat_skill_trainer_sets s
JOIN public.ucat_skill_trainers t ON t.id = s.skill_trainer_id
WHERE b.skill_trainer_set_id = s.id
  AND b.block_type = 'skill_trainer_set';

ALTER TABLE public.ucat_learning_module_blocks
  ALTER COLUMN block_type TYPE TEXT USING block_type::TEXT;

DROP TYPE public.ucat_learning_module_block_type;

CREATE TYPE public.ucat_learning_module_block_type AS ENUM (
  'text',
  'video',
  'file',
  'question_stem',
  'question',
  'skill_trainer'
);

UPDATE public.ucat_learning_module_blocks
SET block_type = 'skill_trainer'
WHERE block_type = 'skill_trainer_set';

ALTER TABLE public.ucat_learning_module_blocks
  ALTER COLUMN block_type TYPE public.ucat_learning_module_block_type
  USING block_type::public.ucat_learning_module_block_type,
  DROP COLUMN IF EXISTS skill_trainer_set_id,
  ADD CONSTRAINT ucat_learning_module_blocks_type_payload CHECK (
    (block_type = 'text')
    OR (block_type = 'video' AND (content ? 'url'))
    OR (block_type = 'file' AND file_id IS NOT NULL)
    OR (block_type = 'question_stem' AND question_stem_id IS NOT NULL)
    OR (block_type = 'question' AND question_id IS NOT NULL)
    OR (block_type = 'skill_trainer' AND skill_trainer_id IS NOT NULL)
  );

ALTER TABLE public.student_skill_trainer_attempts
  DROP COLUMN IF EXISTS skill_trainer_set_id;

DROP TABLE IF EXISTS public.ucat_skill_trainer_set_items;
DROP TABLE IF EXISTS public.ucat_skill_trainer_sets;
DROP FUNCTION IF EXISTS public.validate_skill_trainer_set_item_trainer();

CREATE OR REPLACE VIEW public.vtutor_ucat_learning_module_blocks
WITH (security_invoker = false)
AS
SELECT b.*
FROM public.ucat_learning_module_blocks b
JOIN public.ucat_learning_modules lm ON lm.id = b.learning_module_id
WHERE public.is_ucat_tutor()
  AND b.deleted_at IS NULL
  AND lm.deleted_at IS NULL;

GRANT SELECT ON public.vtutor_ucat_learning_module_blocks TO authenticated;

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
LEFT JOIN public.ucat_questions q
  ON q.id = b.question_id
LEFT JOIN public.ucat_student_learning_module_block_progress bp
  ON bp.learning_module_block_id = b.id
  AND bp.student_id = (SELECT student_id FROM public.vstudent_ucat_access_context)
WHERE b.deleted_at IS NULL
  AND lm.deleted_at IS NULL
  AND lm.kind = 'lesson'
  AND (
    b.block_type <> 'question'
    OR (q.id IS NOT NULL AND q.deleted_at IS NULL)
  );

GRANT SELECT ON public.vstudent_ucat_learning_module_blocks TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_replace_learning_module_blocks(
  p_module_id UUID,
  p_blocks JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind public.ucat_learning_module_kind;
  v_block JSONB;
  v_idx INTEGER;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT kind INTO v_kind
  FROM public.ucat_learning_modules
  WHERE id = p_module_id AND deleted_at IS NULL;

  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'learning_module_not_found';
  END IF;

  IF v_kind <> 'lesson' THEN
    RAISE EXCEPTION 'learning_module_not_lesson';
  END IF;

  UPDATE public.ucat_learning_module_blocks
  SET deleted_at = NOW()
  WHERE learning_module_id = p_module_id AND deleted_at IS NULL;

  IF jsonb_typeof(p_blocks) = 'array' THEN
    v_idx := 0;
    FOR v_block IN SELECT * FROM jsonb_array_elements(p_blocks)
    LOOP
      INSERT INTO public.ucat_learning_module_blocks (
        learning_module_id,
        block_type,
        index,
        require_completion_before_next,
        content,
        question_stem_id,
        question_id,
        file_id,
        skill_trainer_id
      )
      VALUES (
        p_module_id,
        (v_block->>'block_type')::public.ucat_learning_module_block_type,
        COALESCE((v_block->>'index')::INTEGER, v_idx),
        COALESCE((v_block->>'require_completion_before_next')::BOOLEAN, true),
        COALESCE(v_block->'content', '{}'::jsonb),
        NULLIF(v_block->>'question_stem_id', '')::UUID,
        NULLIF(v_block->>'question_id', '')::UUID,
        NULLIF(v_block->>'file_id', '')::UUID,
        NULLIF(v_block->>'skill_trainer_id', '')::UUID
      );
      v_idx := v_idx + 1;
    END LOOP;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_replace_learning_module_blocks(UUID, JSONB) TO authenticated;
