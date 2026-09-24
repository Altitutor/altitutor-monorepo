-- Migration: allow private lesson pending/unpublished assessment placeholders
-- Why: lesson AI generation links in_review stems into private drafts; the old
-- published-only trigger blocked Save. Student views already filter to published.

ALTER TABLE public.ucat_learning_module_blocks
  DROP CONSTRAINT IF EXISTS ucat_learning_module_blocks_type_payload;

ALTER TABLE public.ucat_learning_module_blocks
  ADD CONSTRAINT ucat_learning_module_blocks_type_payload CHECK (
    (block_type = 'text')
    OR (block_type = 'video' AND (content ? 'url'))
    OR (block_type = 'file' AND file_id IS NOT NULL)
    OR (
      block_type = 'question_stem'
      AND (
        question_stem_id IS NOT NULL
        OR content->'pendingGeneratedStem' = 'true'::jsonb
      )
    )
    OR (
      block_type = 'question'
      AND (
        question_id IS NOT NULL
        OR content->'pendingGeneratedStem' = 'true'::jsonb
      )
    )
    OR (block_type = 'skill_trainer' AND skill_trainer_id IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.validate_published_ucat_learning_block()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_is_private BOOLEAN;
  v_is_pending BOOLEAN;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT module.is_private
  INTO v_is_private
  FROM public.ucat_learning_modules module
  WHERE module.id = NEW.learning_module_id
    AND module.deleted_at IS NULL;

  IF v_is_private IS NULL THEN
    RAISE EXCEPTION 'learning_module_not_found';
  END IF;

  v_is_pending := NEW.content->'pendingGeneratedStem' = 'true'::jsonb;

  IF NEW.block_type = 'question_stem' THEN
    IF NEW.question_stem_id IS NULL THEN
      IF NOT v_is_private OR NOT v_is_pending THEN
        RAISE EXCEPTION 'only_published_stems_can_be_attached';
      END IF;
      RETURN NEW;
    END IF;

    IF v_is_private THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.question_stems stem
        WHERE stem.id = NEW.question_stem_id
          AND stem.deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'only_published_stems_can_be_attached';
      END IF;
    ELSIF NOT EXISTS (
      SELECT 1
      FROM public.question_stems stem
      WHERE stem.id = NEW.question_stem_id
        AND stem.deleted_at IS NULL
        AND stem.status = 'published'
    ) THEN
      RAISE EXCEPTION 'only_published_stems_can_be_attached';
    END IF;
  END IF;

  IF NEW.block_type = 'question' THEN
    IF NEW.question_id IS NULL THEN
      IF NOT v_is_private OR NOT v_is_pending THEN
        RAISE EXCEPTION 'only_questions_on_published_stems_can_be_attached';
      END IF;
      RETURN NEW;
    END IF;

    IF v_is_private THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.ucat_questions question
        JOIN public.question_stems stem ON stem.id = question.question_stem_id
        WHERE question.id = NEW.question_id
          AND question.deleted_at IS NULL
          AND stem.deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'only_questions_on_published_stems_can_be_attached';
      END IF;
    ELSIF NOT EXISTS (
      SELECT 1
      FROM public.ucat_questions question
      JOIN public.question_stems stem ON stem.id = question.question_stem_id
      WHERE question.id = NEW.question_id
        AND question.deleted_at IS NULL
        AND stem.deleted_at IS NULL
        AND stem.status = 'published'
    ) THEN
      RAISE EXCEPTION 'only_questions_on_published_stems_can_be_attached';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_public_learning_module_assessment_refs()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.is_private = true THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ucat_learning_module_blocks block
    LEFT JOIN public.question_stems stem ON stem.id = block.question_stem_id
    LEFT JOIN public.ucat_questions question ON question.id = block.question_id
    LEFT JOIN public.question_stems question_stem ON question_stem.id = question.question_stem_id
    WHERE block.learning_module_id = NEW.id
      AND block.deleted_at IS NULL
      AND (
        (
          block.block_type = 'question_stem'
          AND (
            block.content->'pendingGeneratedStem' = 'true'::jsonb
            OR block.question_stem_id IS NULL
            OR stem.id IS NULL
            OR stem.deleted_at IS NOT NULL
            OR stem.status IS DISTINCT FROM 'published'
          )
        )
        OR (
          block.block_type = 'question'
          AND (
            block.content->'pendingGeneratedStem' = 'true'::jsonb
            OR block.question_id IS NULL
            OR question.id IS NULL
            OR question.deleted_at IS NOT NULL
            OR question_stem.id IS NULL
            OR question_stem.deleted_at IS NOT NULL
            OR question_stem.status IS DISTINCT FROM 'published'
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'public_lessons_require_published_assessment_blocks';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_public_learning_module_assessment_refs ON public.ucat_learning_modules;
CREATE TRIGGER validate_public_learning_module_assessment_refs
  BEFORE INSERT OR UPDATE OF is_private, deleted_at
  ON public.ucat_learning_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_public_learning_module_assessment_refs();
