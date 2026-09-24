-- Repair two historical rich-text formatting defects from UCAT bulk imports:
--   1. standalone "Prompt N" delimiter paragraphs persisted in VR stems; and
--   2. answer explanations whose every meaningful text node was marked bold.
--
-- Attempt content snapshots are intentionally immutable and are not changed.

CREATE OR REPLACE FUNCTION pg_temp.ucat_remove_bold_marks(p_value JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result JSONB;
  v_marks JSONB;
BEGIN
  IF p_value IS NULL THEN
    RETURN NULL;
  END IF;

  CASE jsonb_typeof(p_value)
    WHEN 'array' THEN
      SELECT COALESCE(
        jsonb_agg(pg_temp.ucat_remove_bold_marks(element) ORDER BY ordinal),
        '[]'::JSONB
      )
      INTO v_result
      FROM jsonb_array_elements(p_value) WITH ORDINALITY AS item(element, ordinal);

      RETURN v_result;

    WHEN 'object' THEN
      SELECT COALESCE(
        jsonb_object_agg(key, pg_temp.ucat_remove_bold_marks(value)),
        '{}'::JSONB
      )
      INTO v_result
      FROM jsonb_each(p_value);

      IF v_result ? 'marks' AND jsonb_typeof(v_result -> 'marks') = 'array' THEN
        SELECT COALESCE(
          jsonb_agg(mark ORDER BY ordinal)
            FILTER (WHERE mark ->> 'type' IS DISTINCT FROM 'bold'),
          '[]'::JSONB
        )
        INTO v_marks
        FROM jsonb_array_elements(v_result -> 'marks') WITH ORDINALITY AS marks(mark, ordinal);

        v_result := CASE
          WHEN jsonb_array_length(v_marks) = 0 THEN v_result - 'marks'
          ELSE jsonb_set(v_result, '{marks}', v_marks)
        END;
      END IF;

      RETURN v_result;

    ELSE
      RETURN p_value;
  END CASE;
END;
$$;

WITH cleaned_stems AS (
  SELECT
    stem.id,
    jsonb_set(
      stem.stem_text,
      '{content}',
      COALESCE(
        (
          SELECT jsonb_agg(block ORDER BY ordinal)
            FILTER (
              WHERE NOT (
                block ->> 'type' = 'paragraph'
                AND jsonb_typeof(block -> 'content') = 'array'
                AND jsonb_array_length(block -> 'content') = 1
                AND block #>> '{content,0,type}' = 'text'
                AND btrim(block #>> '{content,0,text}') ~* '^prompt[[:space:]]+[0-9]+$'
              )
            )
          FROM jsonb_array_elements(stem.stem_text -> 'content')
            WITH ORDINALITY AS blocks(block, ordinal)
        ),
        '[]'::JSONB
      ),
      false
    ) AS stem_text
  FROM public.question_stems AS stem
  JOIN public.question_stem_categories AS category
    ON category.id = stem.question_stem_category_id
  JOIN public.ucat_sections AS section
    ON section.id = category.ucat_section_id
  WHERE stem.deleted_at IS NULL
    AND stem.status = 'published'
    AND stem.access_scope = 'public'
    AND stem.source_channel = 'bulk_import'
    AND section.name = 'Verbal Reasoning'
    AND jsonb_typeof(stem.stem_text -> 'content') = 'array'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(stem.stem_text -> 'content') AS blocks(block)
      WHERE block ->> 'type' = 'paragraph'
        AND jsonb_typeof(block -> 'content') = 'array'
        AND jsonb_array_length(block -> 'content') = 1
        AND block #>> '{content,0,type}' = 'text'
        AND btrim(block #>> '{content,0,text}') ~* '^prompt[[:space:]]+[0-9]+$'
    )
)
UPDATE public.question_stems AS stem
SET stem_text = cleaned.stem_text,
    updated_at = NOW()
FROM cleaned_stems AS cleaned
WHERE stem.id = cleaned.id;

WITH all_bold_explanations AS (
  SELECT question.id
  FROM public.ucat_questions AS question
  JOIN public.question_stems AS stem
    ON stem.id = question.question_stem_id
  WHERE question.deleted_at IS NULL
    AND stem.deleted_at IS NULL
    AND stem.status = 'published'
    AND stem.access_scope = 'public'
    AND question.source_channel = 'bulk_import'
    AND question.answer_explanation IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM jsonb_path_query(
        question.answer_explanation,
        '$.** ? (@.type == "text")'
      ) AS nodes(node)
      WHERE btrim(node ->> 'text') <> ''
    )
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_path_query(
        question.answer_explanation,
        '$.** ? (@.type == "text")'
      ) AS nodes(node)
      WHERE btrim(node ->> 'text') <> ''
        AND NOT (
          COALESCE(node -> 'marks', '[]'::JSONB)
            @> '[{"type":"bold"}]'::JSONB
        )
    )
)
UPDATE public.ucat_questions AS question
SET answer_explanation = pg_temp.ucat_remove_bold_marks(question.answer_explanation),
    updated_at = NOW()
FROM all_bold_explanations AS affected
WHERE question.id = affected.id;

WITH all_bold_explanations AS (
  SELECT option.id
  FROM public.question_answer_options AS option
  JOIN public.ucat_questions AS question
    ON question.id = option.question_id
  JOIN public.question_stems AS stem
    ON stem.id = question.question_stem_id
  WHERE option.deleted_at IS NULL
    AND question.deleted_at IS NULL
    AND stem.deleted_at IS NULL
    AND stem.status = 'published'
    AND stem.access_scope = 'public'
    AND question.source_channel = 'bulk_import'
    AND option.answer_explanation IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM jsonb_path_query(
        option.answer_explanation,
        '$.** ? (@.type == "text")'
      ) AS nodes(node)
      WHERE btrim(node ->> 'text') <> ''
    )
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_path_query(
        option.answer_explanation,
        '$.** ? (@.type == "text")'
      ) AS nodes(node)
      WHERE btrim(node ->> 'text') <> ''
        AND NOT (
          COALESCE(node -> 'marks', '[]'::JSONB)
            @> '[{"type":"bold"}]'::JSONB
        )
    )
)
UPDATE public.question_answer_options AS option
SET answer_explanation = pg_temp.ucat_remove_bold_marks(option.answer_explanation),
    updated_at = NOW()
FROM all_bold_explanations AS affected
WHERE option.id = affected.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.question_stems AS stem
    JOIN public.question_stem_categories AS category
      ON category.id = stem.question_stem_category_id
    JOIN public.ucat_sections AS section
      ON section.id = category.ucat_section_id
    CROSS JOIN LATERAL jsonb_array_elements(stem.stem_text -> 'content') AS blocks(block)
    WHERE stem.deleted_at IS NULL
      AND stem.status = 'published'
      AND stem.access_scope = 'public'
      AND stem.source_channel = 'bulk_import'
      AND section.name = 'Verbal Reasoning'
      AND jsonb_typeof(stem.stem_text -> 'content') = 'array'
      AND block ->> 'type' = 'paragraph'
      AND jsonb_typeof(block -> 'content') = 'array'
      AND jsonb_array_length(block -> 'content') = 1
      AND block #>> '{content,0,type}' = 'text'
      AND btrim(block #>> '{content,0,text}') ~* '^prompt[[:space:]]+[0-9]+$'
  ) THEN
    RAISE EXCEPTION 'UCAT formatting cleanup left standalone Prompt N paragraphs';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ucat_questions AS question
    JOIN public.question_stems AS stem
      ON stem.id = question.question_stem_id
    WHERE question.deleted_at IS NULL
      AND stem.deleted_at IS NULL
      AND stem.status = 'published'
      AND stem.access_scope = 'public'
      AND question.source_channel = 'bulk_import'
      AND question.answer_explanation IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM jsonb_path_query(
          question.answer_explanation,
          '$.** ? (@.type == "text")'
        ) AS nodes(node)
        WHERE btrim(node ->> 'text') <> ''
      )
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_path_query(
          question.answer_explanation,
          '$.** ? (@.type == "text")'
        ) AS nodes(node)
        WHERE btrim(node ->> 'text') <> ''
          AND NOT (
            COALESCE(node -> 'marks', '[]'::JSONB)
              @> '[{"type":"bold"}]'::JSONB
          )
      )
  ) THEN
    RAISE EXCEPTION 'UCAT formatting cleanup left fully bold question explanations';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.question_answer_options AS option
    JOIN public.ucat_questions AS question
      ON question.id = option.question_id
    JOIN public.question_stems AS stem
      ON stem.id = question.question_stem_id
    WHERE option.deleted_at IS NULL
      AND question.deleted_at IS NULL
      AND stem.deleted_at IS NULL
      AND stem.status = 'published'
      AND stem.access_scope = 'public'
      AND question.source_channel = 'bulk_import'
      AND option.answer_explanation IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM jsonb_path_query(
          option.answer_explanation,
          '$.** ? (@.type == "text")'
        ) AS nodes(node)
        WHERE btrim(node ->> 'text') <> ''
      )
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_path_query(
          option.answer_explanation,
          '$.** ? (@.type == "text")'
        ) AS nodes(node)
        WHERE btrim(node ->> 'text') <> ''
          AND NOT (
            COALESCE(node -> 'marks', '[]'::JSONB)
              @> '[{"type":"bold"}]'::JSONB
          )
      )
  ) THEN
    RAISE EXCEPTION 'UCAT formatting cleanup left fully bold option explanations';
  END IF;
END;
$$;
