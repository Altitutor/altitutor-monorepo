-- Expose question_tags.ucat_section_id through the tutor read view.
-- Applied on remote before question_tags_section (20260609160000); guard so fresh
-- db reset skips until the column exists.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'question_tags'
      AND column_name = 'ucat_section_id'
  ) THEN
    RETURN;
  END IF;

  DROP VIEW IF EXISTS public.vtutor_ucat_question_tags;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'question_tags'
      AND column_name = 'ucat_section_id'
  ) THEN
    RETURN;
  END IF;

  CREATE VIEW public.vtutor_ucat_question_tags
  WITH (security_invoker = false)
  AS
  SELECT
    qt.id,
    qt.name,
    qt.description,
    qt.ucat_section_id,
    qt.parent_question_tag_id,
    qt.created_at,
    qt.created_by,
    qt.updated_at,
    qt.updated_by,
    (
      SELECT COUNT(*)::int
      FROM public.questions_question_tags qqt
      WHERE qqt.tag_id = qt.id
    ) AS question_count
  FROM public.question_tags qt
  WHERE public.is_ucat_tutor();

  GRANT SELECT ON public.vtutor_ucat_question_tags TO authenticated;
END;
$$;
