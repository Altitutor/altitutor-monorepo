-- ALTI-545: contract the verified legacy UCAT response representation.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.ucat_response_contract_activation_report('-infinity'::timestamptz)
    WHERE issue_count <> 0
  ) THEN
    RAISE EXCEPTION 'ucat_response_contract_not_ready_for_contraction';
  END IF;
END;
$$;

-- Historical snapshots already contain the canonical contract. Remove the
-- compatibility-only aliases so future readers cannot accidentally depend on them.
UPDATE public.student_question_attempts attempt
SET content_snapshot = jsonb_set(
  jsonb_set(
    attempt.content_snapshot,
    '{question}',
    COALESCE(attempt.content_snapshot->'question', '{}'::jsonb) - 'questionType'
  ),
  '{answerOptions}',
  COALESCE((
    SELECT jsonb_agg(option.value - 'isAnswer' ORDER BY option.ordinality)
    FROM jsonb_array_elements(COALESCE(attempt.content_snapshot->'answerOptions', '[]'::jsonb))
      WITH ORDINALITY AS option(value, ordinality)
  ), '[]'::jsonb)
)
WHERE attempt.content_snapshot IS NOT NULL
  AND (
    attempt.content_snapshot#>'{question}' ? 'questionType'
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(attempt.content_snapshot->'answerOptions', '[]'::jsonb)) option
      WHERE option ? 'isAnswer'
    )
  );

DROP TRIGGER IF EXISTS sync_ucat_question_response_contract ON public.ucat_questions;
DROP TRIGGER IF EXISTS sync_ucat_answer_option_key ON public.question_answer_options;
DROP TRIGGER IF EXISTS resolve_ratings_after_question_content_change ON public.ucat_questions;
DROP TRIGGER IF EXISTS resolve_ratings_after_answer_option_content_change ON public.question_answer_options;
DROP FUNCTION IF EXISTS public.sync_ucat_question_response_contract();
DROP FUNCTION IF EXISTS public.sync_ucat_answer_option_key();

DROP VIEW IF EXISTS public.vstudent_ucat_study_plan_readiness_evidence;
DROP VIEW IF EXISTS public.vstudent_ucat_my_question_progress;
DROP VIEW IF EXISTS public.vstudent_ucat_my_question_attempts;
DROP VIEW IF EXISTS public.vstudent_ucat_question_stem_delivery;
DROP VIEW IF EXISTS public.vstudent_ucat_question_stem_detail;
DROP VIEW IF EXISTS public.vtutor_ucat_question_stem_detail;
DROP VIEW IF EXISTS public.vtutor_ucat_student_question_attempts;
DROP VIEW IF EXISTS public.vtutor_ucat_student_question_attempts_for_progress;
DROP VIEW IF EXISTS public.vtutor_ucat_student_set_attempt_detail;
DROP VIEW IF EXISTS public.vtutor_ucat_question_catalog;

DROP TRIGGER IF EXISTS validate_ucat_question_attempt_response
ON public.student_question_attempts;
DROP FUNCTION IF EXISTS public.validate_ucat_question_attempt_response();
DROP FUNCTION IF EXISTS public.upsert_ucat_question_attempt_batch(UUID, UUID, UUID, JSONB);

ALTER TABLE public.ucat_questions DROP COLUMN question_type;
ALTER TABLE public.question_answer_options DROP COLUMN is_answer;
ALTER TABLE public.student_question_attempts DROP COLUMN question_answer_option_id;
DROP TYPE public.ucat_question_type;

ALTER TABLE public.ucat_question_catalog_projection DROP COLUMN question_types;

CREATE OR REPLACE FUNCTION public.refresh_ucat_question_catalog_projection(p_stem_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_stem_id IS NULL THEN RETURN; END IF;

  DELETE FROM public.ucat_question_catalog_projection projection
  WHERE projection.stem_id = p_stem_id
    AND NOT EXISTS (SELECT 1 FROM public.question_stems stem WHERE stem.id = p_stem_id);
  IF NOT EXISTS (SELECT 1 FROM public.question_stems stem WHERE stem.id = p_stem_id) THEN RETURN; END IF;

  INSERT INTO public.ucat_question_catalog_projection (
    stem_id, question_count, tag_ids, set_ids, set_names, set_names_text,
    stem_search_text, question_search_text, answer_option_search_text,
    tutor_source_note_search_text, stem_comparison_text, stem_comparison_hash,
    question_text_fingerprint, question_bundle_fingerprint,
    is_available_in_question_pool, refreshed_at
  )
  SELECT stem.id,
    COALESCE(question_summary.question_count, 0),
    COALESCE(tag_summary.tag_ids, '{}'::UUID[]),
    COALESCE(set_summary.set_ids, '{}'::UUID[]),
    COALESCE(set_summary.set_names, '[]'::JSONB),
    COALESCE(set_summary.set_names_text, ''),
    public.normalize_ucat_catalog_text(public.extract_text_from_prosemirror_json(stem.stem_text)),
    COALESCE(question_summary.question_search_text, ''),
    COALESCE(question_summary.answer_option_search_text, ''),
    public.normalize_ucat_catalog_text(stem.tutor_source_note),
    public.canonical_ucat_catalog_rich_text(stem.stem_text),
    MD5(public.canonical_ucat_catalog_rich_text(stem.stem_text)),
    COALESCE(question_summary.question_text_fingerprint, MD5('[]')),
    COALESCE(question_summary.question_bundle_fingerprint, MD5('[]')),
    stem.deleted_at IS NULL
      AND stem.status = 'published'
      AND stem.access_scope = 'public'
      AND COALESCE(set_summary.published_set_count, 0) = 0,
    NOW()
  FROM public.question_stems stem
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::INTEGER AS question_count,
      COALESCE(STRING_AGG(
        public.normalize_ucat_catalog_text(public.extract_text_from_prosemirror_json(question.question_text)),
        ' ' ORDER BY question.index, question.id
      ), '') AS question_search_text,
      COALESCE(STRING_AGG((
        SELECT COALESCE(STRING_AGG(
          public.normalize_ucat_catalog_text(public.extract_text_from_prosemirror_json(answer_option.answer_text)),
          ' ' ORDER BY answer_option.index, answer_option.id
        ), '')
        FROM public.question_answer_options answer_option
        WHERE answer_option.question_id = question.id AND answer_option.deleted_at IS NULL
      ), ' ' ORDER BY question.index, question.id), '') AS answer_option_search_text,
      MD5(COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
        'response_type', question.response_type::TEXT,
        'answer_scheme', question.answer_scheme::TEXT,
        'question_text', public.canonical_ucat_catalog_rich_text(question.question_text)
      ) ORDER BY question.index, question.id)::TEXT, '[]')) AS question_text_fingerprint,
      MD5(COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
        'response_type', question.response_type::TEXT,
        'answer_scheme', question.answer_scheme::TEXT,
        'question_text', public.canonical_ucat_catalog_rich_text(question.question_text),
        'answer_explanation', public.canonical_ucat_catalog_rich_text(question.answer_explanation),
        'answer_options', (
          SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
            'answer_text', public.canonical_ucat_catalog_rich_text(answer_option.answer_text),
            'answer_explanation', public.canonical_ucat_catalog_rich_text(answer_option.answer_explanation),
            'answer_key_value', answer_option.answer_key_value
          ) ORDER BY answer_option.index, answer_option.id), '[]'::JSONB)
          FROM public.question_answer_options answer_option
          WHERE answer_option.question_id = question.id AND answer_option.deleted_at IS NULL
        )
      ) ORDER BY question.index, question.id)::TEXT, '[]')) AS question_bundle_fingerprint
    FROM public.ucat_questions question
    WHERE question.question_stem_id = stem.id AND question.deleted_at IS NULL
  ) question_summary ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(ARRAY_AGG(DISTINCT link.tag_id ORDER BY link.tag_id), '{}'::UUID[]) AS tag_ids
    FROM public.questions_question_tags link
    JOIN public.ucat_questions question ON question.id = link.question_id
    WHERE question.question_stem_id = stem.id AND question.deleted_at IS NULL
  ) tag_summary ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(ARRAY_AGG(question_set.id ORDER BY question_set.updated_at DESC NULLS LAST, question_set.id), '{}'::UUID[]) AS set_ids,
      COALESCE(JSONB_AGG(question_set.name ORDER BY question_set.updated_at DESC NULLS LAST, question_set.id), '[]'::JSONB) AS set_names,
      COALESCE(STRING_AGG(
        public.normalize_ucat_catalog_text(public.extract_text_from_prosemirror_json(question_set.name)),
        ', ' ORDER BY question_set.updated_at DESC NULLS LAST, question_set.id
      ), '') AS set_names_text,
      COUNT(*) FILTER (WHERE question_set.status = 'published')::INTEGER AS published_set_count
    FROM public.question_stems_question_sets member
    JOIN public.question_sets question_set
      ON question_set.id = member.question_set_id AND question_set.deleted_at IS NULL
    WHERE member.question_stem_id = stem.id
  ) set_summary ON TRUE
  WHERE stem.id = p_stem_id
  ON CONFLICT (stem_id) DO UPDATE SET
    question_count = EXCLUDED.question_count,
    tag_ids = EXCLUDED.tag_ids,
    set_ids = EXCLUDED.set_ids,
    set_names = EXCLUDED.set_names,
    set_names_text = EXCLUDED.set_names_text,
    stem_search_text = EXCLUDED.stem_search_text,
    question_search_text = EXCLUDED.question_search_text,
    answer_option_search_text = EXCLUDED.answer_option_search_text,
    tutor_source_note_search_text = EXCLUDED.tutor_source_note_search_text,
    stem_comparison_text = EXCLUDED.stem_comparison_text,
    stem_comparison_hash = EXCLUDED.stem_comparison_hash,
    question_text_fingerprint = EXCLUDED.question_text_fingerprint,
    question_bundle_fingerprint = EXCLUDED.question_bundle_fingerprint,
    is_available_in_question_pool = EXCLUDED.is_available_in_question_pool,
    refreshed_at = EXCLUDED.refreshed_at;
END;
$$;

CREATE VIEW public.vtutor_ucat_question_catalog AS
SELECT stem.id, stem.section_id, section.section_number,
  section.name AS section_name, section.display_columns AS section_display_columns,
  stem.question_stem_category_id, category.name AS category_name,
  stem.status, stem.access_scope, stem.status_changed_at, stem.status_changed_by,
  status_staff.first_name AS status_changed_by_first_name,
  status_staff.last_name AS status_changed_by_last_name,
  stem.ai_generation_metadata, stem.source_channel, stem.tutor_source_note,
  stem.stem_text, stem.created_at, stem.updated_at, stem.created_by, stem.updated_by,
  stem.deleted_at, stem.deleted_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  updated_staff.first_name AS updated_by_first_name,
  updated_staff.last_name AS updated_by_last_name,
  projection.question_count, to_jsonb(projection.set_names) AS set_names,
  projection.set_ids, projection.tag_ids, projection.set_names_text,
  projection.stem_search_text, projection.question_search_text,
  projection.answer_option_search_text, projection.tutor_source_note_search_text,
  projection.stem_comparison_text, projection.stem_comparison_hash,
  projection.question_text_fingerprint, projection.question_bundle_fingerprint,
  projection.is_available_in_question_pool,
  ARRAY(SELECT DISTINCT question.response_type::TEXT
    FROM public.ucat_questions question
    WHERE question.question_stem_id = stem.id AND question.deleted_at IS NULL
    ORDER BY question.response_type::TEXT) AS response_types,
  ARRAY(SELECT DISTINCT question.answer_scheme::TEXT
    FROM public.ucat_questions question
    WHERE question.question_stem_id = stem.id AND question.deleted_at IS NULL
    ORDER BY question.answer_scheme::TEXT) AS answer_schemes,
  projection.ai_review_status
FROM public.question_stems stem
JOIN public.ucat_question_catalog_projection projection ON projection.stem_id = stem.id
JOIN public.ucat_sections section ON section.id = stem.section_id
LEFT JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
LEFT JOIN public.staff created_staff ON created_staff.id = stem.created_by
LEFT JOIN public.staff updated_staff ON updated_staff.id = stem.updated_by
LEFT JOIN public.staff status_staff ON status_staff.id = stem.status_changed_by
WHERE public.is_ucat_tutor();

ALTER VIEW public.vtutor_ucat_question_catalog SET (security_invoker = false);
GRANT SELECT ON public.vtutor_ucat_question_catalog TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ucat_ai_current_question_fingerprint(p_question_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.ucat_ai_hash(jsonb_build_object(
    'index', question.index,
    'questionText', public.ucat_ai_canonical_rich_node(question.question_text),
    'answerExplanation', public.ucat_ai_canonical_rich_node(question.answer_explanation),
    'responseType', question.response_type::TEXT,
    'answerScheme', question.answer_scheme::TEXT,
    'difficulty', to_jsonb(question.difficulty::DOUBLE PRECISION),
    'timeBurdenSeconds', to_jsonb(question.time_burden_seconds),
    'tagIds', COALESCE((
      SELECT jsonb_agg(link.tag_id::TEXT ORDER BY link.tag_id::TEXT COLLATE "C")
      FROM public.questions_question_tags link
      WHERE link.question_id = question.id
    ), '[]'::JSONB),
    'options', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'index', answer_option.index,
        'answerText', public.ucat_ai_canonical_rich_node(answer_option.answer_text),
        'answerExplanation', public.ucat_ai_canonical_rich_node(answer_option.answer_explanation),
        'answerKeyValue', answer_option.answer_key_value
      ) ORDER BY answer_option.index, answer_option.id)
      FROM public.question_answer_options answer_option
      WHERE answer_option.question_id = question.id AND answer_option.deleted_at IS NULL
    ), '[]'::JSONB)
  ))
  FROM public.ucat_questions question
  WHERE question.id = p_question_id AND question.deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.ucat_question_content_snapshot(p_question_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'schemaVersion', 1,
    'stem', jsonb_build_object(
      'id', stem.id, 'sectionId', stem.section_id,
      'sectionNumber', section.section_number, 'sectionName', section.name,
      'sectionDisplayColumns', section.display_columns,
      'categoryId', stem.question_stem_category_id,
      'categoryName', category.name, 'categoryDescription', category.description,
      'stemText', stem.stem_text
    ),
    'question', jsonb_build_object(
      'id', question.id, 'questionText', question.question_text,
      'answerExplanation', question.answer_explanation, 'index', question.index,
      'difficulty', question.difficulty,
      'timeBurdenSeconds', question.time_burden_seconds,
      'responseType', question.response_type,
      'answerScheme', question.answer_scheme,
      'tags', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', tag.id, 'name', tag.name, 'description', tag.description
        ) ORDER BY tag.name, tag.id)
        FROM public.questions_question_tags question_tag
        JOIN public.question_tags tag ON tag.id = question_tag.tag_id
        WHERE question_tag.question_id = question.id
      ), '[]'::JSONB)
    ),
    'answerOptions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', option.id, 'answerText', option.answer_text,
        'answerExplanation', option.answer_explanation, 'index', option.index,
        'answerKeyValue', option.answer_key_value
      ) ORDER BY option.index, option.id)
      FROM public.question_answer_options option
      WHERE option.question_id = question.id AND option.deleted_at IS NULL
    ), '[]'::JSONB)
  )
  FROM public.ucat_questions question
  JOIN public.question_stems stem ON stem.id = question.question_stem_id
  JOIN public.ucat_sections section ON section.id = stem.section_id
  LEFT JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
  WHERE question.id = p_question_id;
$$;

CREATE TRIGGER resolve_ratings_after_question_content_change
AFTER UPDATE OF question_text, response_type, answer_scheme, deleted_at
ON public.ucat_questions
FOR EACH ROW
WHEN (
  OLD.question_text IS DISTINCT FROM NEW.question_text
  OR OLD.response_type IS DISTINCT FROM NEW.response_type
  OR OLD.answer_scheme IS DISTINCT FROM NEW.answer_scheme
  OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
)
EXECUTE FUNCTION public.resolve_ucat_question_content_ratings();

CREATE TRIGGER resolve_ratings_after_answer_option_content_change
AFTER UPDATE OF answer_text, index, answer_key_value, deleted_at
ON public.question_answer_options
FOR EACH ROW
WHEN (
  OLD.answer_text IS DISTINCT FROM NEW.answer_text
  OR OLD.index IS DISTINCT FROM NEW.index
  OR OLD.answer_key_value IS DISTINCT FROM NEW.answer_key_value
  OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
)
EXECUTE FUNCTION public.resolve_ucat_question_content_ratings();

DROP FUNCTION IF EXISTS public.ucat_canonical_attempt_response_snapshot(
  UUID, public.ucat_answer_scheme, JSONB, UUID
);
DROP FUNCTION IF EXISTS public.ucat_canonical_response_snapshot(
  UUID, public.ucat_answer_scheme, JSONB, UUID
);
DROP FUNCTION IF EXISTS public.ucat_canonical_content_snapshot(JSONB);
DROP FUNCTION IF EXISTS public.ucat_response_contract_activation_report(TIMESTAMPTZ);
DROP TABLE public.ucat_response_contract_legacy_write_observations;

-- The canonical storage writer replaces the expansion-era legacy writer plus
-- response adapter. Preserve the lifecycle guard under a canonical name while
-- replacing only the private storage implementation beneath it.
ALTER FUNCTION public.tutor_ucat_upsert_stem_response_adapter(
  UUID, UUID, UUID, JSONB, public.ucat_access_scope, JSONB,
  public.ucat_question_source_channel, TEXT
) RENAME TO tutor_ucat_upsert_stem_with_blueprint_guard;

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_stem_before_blueprint_guard(
  p_stem_id UUID,
  p_section_id UUID,
  p_question_stem_category_id UUID,
  p_stem_text JSONB,
  p_access_scope public.ucat_access_scope,
  p_questions JSONB,
  p_source_channel public.ucat_question_source_channel DEFAULT NULL,
  p_tutor_source_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stem_id UUID;
  v_staff_id UUID;
  v_status public.ucat_content_status;
  v_question JSONB;
  v_question_id UUID;
  v_question_ids UUID[] := ARRAY[]::UUID[];
  v_option JSONB;
  v_option_id UUID;
  v_option_ids UUID[];
  v_tag_id UUID;
  v_file_id UUID;
  v_issues JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v_staff_id := public.current_tutor_id();

  IF p_stem_id IS NULL THEN
    INSERT INTO public.question_stems (
      section_id, question_stem_category_id, stem_text, status, access_scope,
      source_channel, tutor_source_note, created_by, updated_by
    ) VALUES (
      p_section_id, p_question_stem_category_id, COALESCE(p_stem_text, '{}'::jsonb),
      'draft', COALESCE(p_access_scope, 'public'),
      COALESCE(p_source_channel, 'individual'), NULLIF(BTRIM(COALESCE(p_tutor_source_note, '')), ''),
      v_staff_id, v_staff_id
    ) RETURNING id, status INTO v_stem_id, v_status;
  ELSE
    UPDATE public.question_stems
    SET section_id = p_section_id,
        question_stem_category_id = p_question_stem_category_id,
        stem_text = COALESCE(p_stem_text, '{}'::jsonb),
        tutor_source_note = NULLIF(BTRIM(COALESCE(p_tutor_source_note, '')), ''),
        updated_by = v_staff_id
    WHERE id = p_stem_id AND deleted_at IS NULL
    RETURNING id, status INTO v_stem_id, v_status;
    IF v_stem_id IS NULL THEN RAISE EXCEPTION 'question_stem_not_found'; END IF;
    PERFORM public.tutor_ucat_set_content_access('stem', v_stem_id, COALESCE(p_access_scope, 'public'));
  END IF;

  DELETE FROM public.question_stems_files WHERE question_stem_id = v_stem_id;
  INSERT INTO public.question_stems_files (question_stem_id, file_id)
  SELECT v_stem_id, file_id
  FROM unnest(public.extract_image_file_ids_from_doc(COALESCE(p_stem_text, '{}'::jsonb))) AS file_id
  ON CONFLICT (question_stem_id, file_id) DO NOTHING;

  FOR v_question IN SELECT * FROM jsonb_array_elements(COALESCE(p_questions, '[]'::jsonb))
  LOOP
    v_question_id := NULLIF(v_question->>'id', '')::UUID;
    IF v_question_id IS NOT NULL THEN
      UPDATE public.ucat_questions
      SET question_text = COALESCE(v_question->'question_text', '{}'::jsonb),
          answer_explanation = NULLIF(v_question->'answer_explanation', 'null'::jsonb),
          index = COALESCE((v_question->>'index')::INTEGER, 1),
          difficulty = NULLIF(v_question->>'difficulty', '')::NUMERIC,
          time_burden_seconds = NULLIF(v_question->>'time_burden_seconds', '')::INTEGER,
          response_type = (v_question->>'response_type')::public.ucat_response_type,
          answer_scheme = (v_question->>'answer_scheme')::public.ucat_answer_scheme,
          source_channel = COALESCE(NULLIF(v_question->>'source_channel', '')::public.ucat_question_source_channel, source_channel),
          ai_generation_metadata = NULLIF(v_question->'ai_generation_metadata', 'null'::jsonb),
          deleted_at = NULL,
          deleted_by = NULL,
          updated_by = v_staff_id
      WHERE id = v_question_id AND question_stem_id = v_stem_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'question_does_not_belong_to_stem'; END IF;
    ELSE
      INSERT INTO public.ucat_questions (
        question_stem_id, question_text, answer_explanation, index, difficulty,
        time_burden_seconds, response_type, answer_scheme, source_channel,
        ai_generation_metadata, created_by, updated_by
      ) VALUES (
        v_stem_id, COALESCE(v_question->'question_text', '{}'::jsonb),
        NULLIF(v_question->'answer_explanation', 'null'::jsonb),
        COALESCE((v_question->>'index')::INTEGER, 1),
        NULLIF(v_question->>'difficulty', '')::NUMERIC,
        NULLIF(v_question->>'time_burden_seconds', '')::INTEGER,
        (v_question->>'response_type')::public.ucat_response_type,
        (v_question->>'answer_scheme')::public.ucat_answer_scheme,
        COALESCE(NULLIF(v_question->>'source_channel', '')::public.ucat_question_source_channel, p_source_channel, 'individual'),
        NULLIF(v_question->'ai_generation_metadata', 'null'::jsonb),
        v_staff_id, v_staff_id
      ) RETURNING id INTO v_question_id;
    END IF;
    v_question_ids := array_append(v_question_ids, v_question_id);

    DELETE FROM public.questions_files WHERE question_id = v_question_id;
    INSERT INTO public.questions_files (question_id, file_id)
    SELECT v_question_id, file_id
    FROM unnest(public.extract_image_file_ids_from_doc(COALESCE(v_question->'question_text', '{}'::jsonb))) AS file_id
    ON CONFLICT (question_id, file_id) DO NOTHING;

    DELETE FROM public.questions_question_tags WHERE question_id = v_question_id;
    FOR v_tag_id IN
      SELECT DISTINCT NULLIF(value::TEXT, '')::UUID
      FROM jsonb_array_elements_text(COALESCE(v_question->'tag_ids', '[]'::jsonb))
    LOOP
      IF v_tag_id IS NOT NULL THEN
        INSERT INTO public.questions_question_tags (question_id, tag_id, created_by)
        VALUES (v_question_id, v_tag_id, v_staff_id)
        ON CONFLICT (question_id, tag_id) DO NOTHING;
      END IF;
    END LOOP;

    v_option_ids := ARRAY[]::UUID[];
    FOR v_option IN SELECT * FROM jsonb_array_elements(COALESCE(v_question->'answer_options', '[]'::jsonb))
    LOOP
      v_option_id := NULLIF(v_option->>'id', '')::UUID;
      IF v_option_id IS NOT NULL THEN
        UPDATE public.question_answer_options
        SET answer_text = COALESCE(v_option->'answer_text', '{}'::jsonb),
            answer_explanation = NULLIF(v_option->'answer_explanation', 'null'::jsonb),
            index = COALESCE((v_option->>'index')::INTEGER, 1),
            answer_key_value = NULLIF(v_option->>'answer_key_value', '')::public.ucat_answer_key_value,
            deleted_at = NULL,
            deleted_by = NULL,
            updated_by = v_staff_id
        WHERE id = v_option_id AND question_id = v_question_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'answer_option_does_not_belong_to_question'; END IF;
      ELSE
        INSERT INTO public.question_answer_options (
          question_id, answer_text, answer_explanation, index, answer_key_value,
          created_by, updated_by
        ) VALUES (
          v_question_id, COALESCE(v_option->'answer_text', '{}'::jsonb),
          NULLIF(v_option->'answer_explanation', 'null'::jsonb),
          COALESCE((v_option->>'index')::INTEGER, 1),
          NULLIF(v_option->>'answer_key_value', '')::public.ucat_answer_key_value,
          v_staff_id, v_staff_id
        ) RETURNING id INTO v_option_id;
      END IF;
      v_option_ids := array_append(v_option_ids, v_option_id);

      DELETE FROM public.answer_option_files WHERE answer_option_id = v_option_id;
      FOR v_file_id IN SELECT unnest(public.extract_image_file_ids_from_doc(COALESCE(v_option->'answer_text', '{}'::jsonb)))
      LOOP
        INSERT INTO public.answer_option_files (answer_option_id, file_id, usage)
        VALUES (v_option_id, v_file_id, 'option_text')
        ON CONFLICT (answer_option_id, file_id, usage) DO NOTHING;
      END LOOP;
      FOR v_file_id IN SELECT unnest(public.extract_image_file_ids_from_doc(COALESCE(v_option->'answer_explanation', '{}'::jsonb)))
      LOOP
        INSERT INTO public.answer_option_files (answer_option_id, file_id, usage)
        VALUES (v_option_id, v_file_id, 'option_explanation')
        ON CONFLICT (answer_option_id, file_id, usage) DO NOTHING;
      END LOOP;
    END LOOP;

    UPDATE public.question_answer_options
    SET deleted_at = NOW(), deleted_by = v_staff_id, updated_by = v_staff_id
    WHERE question_id = v_question_id
      AND deleted_at IS NULL
      AND NOT (id = ANY(v_option_ids));
  END LOOP;

  UPDATE public.ucat_questions
  SET deleted_at = NOW(), deleted_by = v_staff_id, updated_by = v_staff_id
  WHERE question_stem_id = v_stem_id
    AND deleted_at IS NULL
    AND NOT (id = ANY(v_question_ids));

  IF v_status = 'published' THEN
    v_issues := public.ucat_content_publication_issues('stem', v_stem_id);
    IF jsonb_array_length(v_issues) > 0 THEN
      RAISE EXCEPTION 'published_content_invalid:%', v_issues::TEXT;
    END IF;
  END IF;

  RETURN v_stem_id;
END;
$$;

DROP FUNCTION public.tutor_ucat_upsert_question_stem_bundle_legacy(
  UUID, UUID, UUID, JSONB, public.ucat_access_scope, JSONB,
  public.ucat_question_source_channel, TEXT
);

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_question_stem_bundle(
  p_stem_id UUID,
  p_section_id UUID,
  p_question_stem_category_id UUID,
  p_stem_text JSONB,
  p_access_scope public.ucat_access_scope,
  p_questions JSONB,
  p_source_channel public.ucat_question_source_channel DEFAULT NULL,
  p_tutor_source_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN
    RAISE EXCEPTION 'invalid_questions_payload';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_questions) question
    WHERE NOT (question ? 'response_type')
      OR NOT (question ? 'answer_scheme')
      OR question->>'response_type' IS NULL
      OR question->>'response_type' NOT IN ('multiple_choice', 'drag_and_drop')
      OR question->>'answer_scheme' IS NULL
      OR question->>'answer_scheme' NOT IN (
        'single_choice', 'situational_judgement_rating',
        'decision_making_binary_placement', 'situational_judgement_most_least'
      )
      OR jsonb_typeof(question->'answer_options') IS DISTINCT FROM 'array'
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(question->'answer_options') option
        WHERE NOT (option ? 'answer_key_value')
          OR (
            jsonb_typeof(option->'answer_key_value') <> 'null'
            AND option->>'answer_key_value' NOT IN ('correct', 'yes', 'no', 'most', 'least')
          )
      )
  ) THEN
    RAISE EXCEPTION 'canonical_response_contract_required';
  END IF;

  RETURN public.tutor_ucat_upsert_stem_with_blueprint_guard(
    p_stem_id, p_section_id, p_question_stem_category_id, p_stem_text,
    p_access_scope, p_questions, p_source_channel, p_tutor_source_note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_question_stem_bundle(
  UUID, UUID, UUID, JSONB, public.ucat_access_scope, JSONB,
  public.ucat_question_source_channel, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_question_stem_bundle(
  UUID, UUID, UUID, JSONB, public.ucat_access_scope, JSONB,
  public.ucat_question_source_channel, TEXT
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_stem_with_blueprint_guard(
  UUID, UUID, UUID, JSONB, public.ucat_access_scope, JSONB,
  public.ucat_question_source_channel, TEXT
) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.validate_ucat_question_attempt_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_scheme public.ucat_answer_scheme;
  v_kind TEXT;
  v_selected_option_id UUID;
  v_placements JSONB;
  v_historical_update BOOLEAN := false;
BEGIN
  IF NEW.answer_snapshot IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    v_historical_update := NEW.question_id IS NOT DISTINCT FROM OLD.question_id;
  END IF;

  SELECT question.answer_scheme INTO v_scheme
  FROM public.ucat_questions question
  WHERE question.id = NEW.question_id
    AND (question.deleted_at IS NULL OR v_historical_update);

  IF v_scheme IS NULL
    OR NEW.answer_snapshot->>'type' IS DISTINCT FROM 'ucat_response_v1'
    OR NEW.answer_snapshot->>'questionId' IS DISTINCT FROM NEW.question_id::TEXT
    OR NEW.answer_snapshot->>'answerScheme' IS DISTINCT FROM v_scheme::TEXT
  THEN
    RAISE EXCEPTION 'Invalid UCAT response snapshot contract';
  END IF;

  v_kind := NEW.answer_snapshot#>>'{response,kind}';
  IF v_scheme IN ('single_choice', 'situational_judgement_rating') THEN
    IF v_kind IS DISTINCT FROM 'single_select'
      OR ((NEW.answer_snapshot#>'{response}') ? 'selectedOptionId') IS NOT TRUE
    THEN
      RAISE EXCEPTION 'Invalid UCAT single-select response';
    END IF;
    IF jsonb_typeof(NEW.answer_snapshot#>'{response,selectedOptionId}') = 'string' THEN
      BEGIN
        v_selected_option_id := (NEW.answer_snapshot#>>'{response,selectedOptionId}')::UUID;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'UCAT response references an invalid option ID';
      END;
      IF NOT EXISTS (
        SELECT 1 FROM public.question_answer_options option
        WHERE option.id = v_selected_option_id
          AND option.question_id = NEW.question_id
          AND (option.deleted_at IS NULL OR v_historical_update)
      ) THEN
        RAISE EXCEPTION 'UCAT response references an unknown option';
      END IF;
    ELSIF jsonb_typeof(NEW.answer_snapshot#>'{response,selectedOptionId}') IS DISTINCT FROM 'null' THEN
      RAISE EXCEPTION 'Invalid UCAT single-select response';
    END IF;
    RETURN NEW;
  END IF;

  v_placements := NEW.answer_snapshot#>'{response,placements}';
  IF v_kind IS DISTINCT FROM 'placement'
    OR jsonb_typeof(v_placements) IS DISTINCT FROM 'object'
  THEN
    RAISE EXCEPTION 'Invalid UCAT placement response';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each_text(v_placements) placement
    WHERE placement.key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR NOT EXISTS (
         SELECT 1 FROM public.question_answer_options option
         WHERE option.id::TEXT = placement.key
           AND option.question_id = NEW.question_id
           AND (option.deleted_at IS NULL OR v_historical_update)
       )
       OR CASE v_scheme
            WHEN 'decision_making_binary_placement' THEN placement.value NOT IN ('yes', 'no')
            WHEN 'situational_judgement_most_least' THEN placement.value NOT IN ('most', 'least')
            ELSE true
          END
  ) THEN
    RAISE EXCEPTION 'UCAT response contains an unknown option or token';
  END IF;
  IF v_scheme = 'situational_judgement_most_least'
    AND (SELECT count(*) FROM jsonb_each_text(v_placements)) <>
        (SELECT count(DISTINCT value) FROM jsonb_each_text(v_placements))
  THEN
    RAISE EXCEPTION 'Most and Least tokens may each be used only once';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_ucat_question_attempt_response() FROM PUBLIC;
CREATE TRIGGER validate_ucat_question_attempt_response
BEFORE INSERT OR UPDATE OF question_id, answer_snapshot
ON public.student_question_attempts
FOR EACH ROW EXECUTE FUNCTION public.validate_ucat_question_attempt_response();

CREATE FUNCTION public.upsert_ucat_question_attempt_batch(
  p_student_id UUID,
  p_student_question_set_attempt_id UUID,
  p_student_practice_session_id UUID,
  p_attempts JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF (p_student_question_set_attempt_id IS NULL) = (p_student_practice_session_id IS NULL) THEN
    RAISE EXCEPTION 'exactly_one_attempt_context_required';
  END IF;
  IF jsonb_typeof(COALESCE(p_attempts, '[]'::JSONB)) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'attempts_must_be_an_array';
  END IF;

  IF p_student_question_set_attempt_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.student_question_set_attempts attempt
      WHERE attempt.id = p_student_question_set_attempt_id
        AND attempt.student_id = p_student_id
        AND attempt.completed_at IS NULL
        AND attempt.discarded_at IS NULL
        AND attempt.expired_at IS NULL
    ) THEN RAISE EXCEPTION 'question_set_attempt_is_not_active'; END IF;

    WITH input AS (
      SELECT * FROM jsonb_to_recordset(COALESCE(p_attempts, '[]'::JSONB)) AS row(
        question_id UUID, answer_snapshot JSONB, has_answer_snapshot BOOLEAN,
        is_flagged BOOLEAN, has_is_flagged BOOLEAN, is_submitted BOOLEAN,
        was_timed BOOLEAN, has_was_timed BOOLEAN, mode TEXT,
        score NUMERIC, has_score BOOLEAN, time_spent_milliseconds BIGINT,
        has_time_spent_milliseconds BOOLEAN
      )
    ), authorized AS (
      SELECT input.* FROM input
      JOIN public.student_question_set_attempts attempt
        ON attempt.id = p_student_question_set_attempt_id
      JOIN public.ucat_questions question ON question.id = input.question_id
      JOIN public.question_stems_question_sets membership
        ON membership.question_stem_id = question.question_stem_id
       AND membership.question_set_id = attempt.question_set_id
    ), written AS (
      INSERT INTO public.student_question_attempts (
        student_id, student_question_set_attempt_id, student_practice_session_id,
        learning_module_block_id, question_id, answer_snapshot, is_flagged,
        is_submitted, time_spent_milliseconds, time_spent_seconds, was_timed, mode, score
      )
      SELECT p_student_id, p_student_question_set_attempt_id, NULL, NULL,
        authorized.question_id,
        CASE WHEN authorized.has_answer_snapshot THEN authorized.answer_snapshot ELSE NULL END,
        CASE WHEN authorized.has_is_flagged THEN COALESCE(authorized.is_flagged, false) ELSE false END,
        COALESCE(authorized.is_submitted, false),
        CASE WHEN authorized.has_time_spent_milliseconds THEN GREATEST(COALESCE(authorized.time_spent_milliseconds, 0), 0) ELSE NULL END,
        CASE WHEN authorized.has_time_spent_milliseconds AND COALESCE(authorized.time_spent_milliseconds, 0) > 0
          THEN CEIL(GREATEST(authorized.time_spent_milliseconds, 0) / 1000.0)::INTEGER ELSE NULL END,
        CASE WHEN authorized.has_was_timed THEN COALESCE(authorized.was_timed, false) ELSE false END,
        authorized.mode, CASE WHEN authorized.has_score THEN COALESCE(authorized.score, 0) ELSE 0 END
      FROM authorized
      ON CONFLICT (student_question_set_attempt_id, question_id) DO UPDATE SET
        answer_snapshot = CASE WHEN (SELECT source.has_answer_snapshot FROM authorized source WHERE source.question_id = excluded.question_id)
          THEN excluded.answer_snapshot ELSE student_question_attempts.answer_snapshot END,
        is_flagged = CASE WHEN (SELECT source.has_is_flagged FROM authorized source WHERE source.question_id = excluded.question_id)
          THEN excluded.is_flagged ELSE student_question_attempts.is_flagged END,
        is_submitted = student_question_attempts.is_submitted OR excluded.is_submitted,
        time_spent_milliseconds = CASE WHEN (SELECT source.has_time_spent_milliseconds FROM authorized source WHERE source.question_id = excluded.question_id)
          THEN GREATEST(COALESCE(student_question_attempts.time_spent_milliseconds, 0), COALESCE(excluded.time_spent_milliseconds, 0))
          ELSE student_question_attempts.time_spent_milliseconds END,
        time_spent_seconds = CASE WHEN (SELECT source.has_time_spent_milliseconds FROM authorized source WHERE source.question_id = excluded.question_id)
          THEN CASE WHEN GREATEST(COALESCE(student_question_attempts.time_spent_milliseconds, 0), COALESCE(excluded.time_spent_milliseconds, 0)) > 0
            THEN CEIL(GREATEST(COALESCE(student_question_attempts.time_spent_milliseconds, 0), COALESCE(excluded.time_spent_milliseconds, 0)) / 1000.0)::INTEGER ELSE NULL END
          ELSE student_question_attempts.time_spent_seconds END,
        was_timed = CASE WHEN (SELECT source.has_was_timed FROM authorized source WHERE source.question_id = excluded.question_id)
          THEN excluded.was_timed ELSE student_question_attempts.was_timed END,
        mode = COALESCE(excluded.mode, student_question_attempts.mode),
        score = CASE WHEN (SELECT source.has_score FROM authorized source WHERE source.question_id = excluded.question_id)
          THEN excluded.score ELSE student_question_attempts.score END
      RETURNING 1
    ) SELECT count(*) INTO v_count FROM written;
    IF v_count <> jsonb_array_length(p_attempts) THEN RAISE EXCEPTION 'question_is_not_part_of_set_attempt'; END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.student_practice_sessions session
      WHERE session.id = p_student_practice_session_id
        AND session.student_id = p_student_id
        AND session.completed_at IS NULL
        AND session.discarded_at IS NULL
        AND session.expired_at IS NULL
    ) THEN RAISE EXCEPTION 'practice_session_is_not_active'; END IF;

    WITH input AS (
      SELECT * FROM jsonb_to_recordset(COALESCE(p_attempts, '[]'::JSONB)) AS row(
        question_id UUID, answer_snapshot JSONB, has_answer_snapshot BOOLEAN,
        is_flagged BOOLEAN, has_is_flagged BOOLEAN, is_submitted BOOLEAN,
        was_timed BOOLEAN, has_was_timed BOOLEAN, mode TEXT,
        score NUMERIC, has_score BOOLEAN, time_spent_milliseconds BIGINT,
        has_time_spent_milliseconds BOOLEAN
      )
    ), written AS (
      INSERT INTO public.student_question_attempts (
        student_id, student_question_set_attempt_id, student_practice_session_id,
        learning_module_block_id, question_id, answer_snapshot, is_flagged,
        is_submitted, first_seen_at, time_spent_milliseconds, time_spent_seconds,
        was_timed, mode, score
      )
      SELECT p_student_id, NULL, p_student_practice_session_id, NULL, input.question_id,
        CASE WHEN input.has_answer_snapshot THEN input.answer_snapshot ELSE NULL END,
        CASE WHEN input.has_is_flagged THEN COALESCE(input.is_flagged, false) ELSE false END,
        COALESCE(input.is_submitted, false), NOW(),
        CASE WHEN input.has_time_spent_milliseconds THEN GREATEST(COALESCE(input.time_spent_milliseconds, 0), 0) ELSE NULL END,
        CASE WHEN input.has_time_spent_milliseconds AND COALESCE(input.time_spent_milliseconds, 0) > 0
          THEN CEIL(GREATEST(input.time_spent_milliseconds, 0) / 1000.0)::INTEGER ELSE NULL END,
        CASE WHEN input.has_was_timed THEN COALESCE(input.was_timed, false) ELSE false END,
        input.mode, CASE WHEN input.has_score THEN COALESCE(input.score, 0) ELSE 0 END
      FROM input
      ON CONFLICT (student_practice_session_id, question_id) DO UPDATE SET
        answer_snapshot = CASE WHEN (SELECT source.has_answer_snapshot FROM input source WHERE source.question_id = excluded.question_id)
          THEN excluded.answer_snapshot ELSE student_question_attempts.answer_snapshot END,
        is_flagged = CASE WHEN (SELECT source.has_is_flagged FROM input source WHERE source.question_id = excluded.question_id)
          THEN excluded.is_flagged ELSE student_question_attempts.is_flagged END,
        is_submitted = student_question_attempts.is_submitted OR excluded.is_submitted,
        first_seen_at = COALESCE(student_question_attempts.first_seen_at, excluded.first_seen_at),
        time_spent_milliseconds = CASE WHEN (SELECT source.has_time_spent_milliseconds FROM input source WHERE source.question_id = excluded.question_id)
          THEN GREATEST(COALESCE(student_question_attempts.time_spent_milliseconds, 0), COALESCE(excluded.time_spent_milliseconds, 0))
          ELSE student_question_attempts.time_spent_milliseconds END,
        time_spent_seconds = CASE WHEN (SELECT source.has_time_spent_milliseconds FROM input source WHERE source.question_id = excluded.question_id)
          THEN CASE WHEN GREATEST(COALESCE(student_question_attempts.time_spent_milliseconds, 0), COALESCE(excluded.time_spent_milliseconds, 0)) > 0
            THEN CEIL(GREATEST(COALESCE(student_question_attempts.time_spent_milliseconds, 0), COALESCE(excluded.time_spent_milliseconds, 0)) / 1000.0)::INTEGER ELSE NULL END
          ELSE student_question_attempts.time_spent_seconds END,
        was_timed = CASE WHEN (SELECT source.has_was_timed FROM input source WHERE source.question_id = excluded.question_id)
          THEN excluded.was_timed ELSE student_question_attempts.was_timed END,
        mode = COALESCE(excluded.mode, student_question_attempts.mode),
        score = CASE WHEN (SELECT source.has_score FROM input source WHERE source.question_id = excluded.question_id)
          THEN excluded.score ELSE student_question_attempts.score END
      RETURNING 1
    ) SELECT count(*) INTO v_count FROM written;
    IF v_count <> jsonb_array_length(p_attempts) THEN RAISE EXCEPTION 'question_attempt_batch_was_not_fully_persisted'; END IF;
  END IF;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_ucat_question_attempt_batch(UUID, UUID, UUID, JSONB)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_ucat_question_attempt_batch(UUID, UUID, UUID, JSONB)
TO service_role;

CREATE VIEW public.vstudent_ucat_my_question_attempts AS
SELECT
  attempt.id,
  attempt.student_id,
  attempt.student_question_set_attempt_id,
  attempt.student_practice_session_id,
  COALESCE(attempt.question_id, (attempt.content_snapshot#>>'{question,id}')::UUID) AS question_id,
  COALESCE(question.question_stem_id, (attempt.content_snapshot#>>'{stem,id}')::UUID) AS question_stem_id,
  COALESCE(question.index, (attempt.content_snapshot#>>'{question,index}')::INTEGER) AS question_index,
  COALESCE(question.question_text, attempt.content_snapshot#>'{question,questionText}') AS question_text,
  COALESCE(question.response_type, (attempt.content_snapshot#>>'{question,responseType}')::public.ucat_response_type) AS response_type,
  COALESCE(question.answer_scheme, (attempt.content_snapshot#>>'{question,answerScheme}')::public.ucat_answer_scheme) AS answer_scheme,
  COALESCE(question.time_burden_seconds, (attempt.content_snapshot#>>'{question,timeBurdenSeconds}')::INTEGER) AS time_burden_seconds,
  COALESCE(stem.stem_text, attempt.content_snapshot#>'{stem,stemText}') AS stem_text,
  COALESCE(stem.question_stem_category_id, (attempt.content_snapshot#>>'{stem,categoryId}')::UUID) AS question_stem_category_id,
  COALESCE(category.name, attempt.content_snapshot#>>'{stem,categoryName}') AS category_name,
  COALESCE(section.id, (attempt.content_snapshot#>>'{stem,sectionId}')::UUID) AS ucat_section_id,
  COALESCE(section.name, attempt.content_snapshot#>>'{stem,sectionName}') AS section_name,
  COALESCE(section.section_number, (attempt.content_snapshot#>>'{stem,sectionNumber}')::INTEGER) AS section_number,
  COALESCE(selected_option.answer_text, (
    SELECT option.value->'answerText'
    FROM jsonb_array_elements(COALESCE(attempt.content_snapshot->'answerOptions', '[]'::jsonb)) option(value)
    WHERE option.value->>'id' = attempt.answer_snapshot#>>'{response,selectedOptionId}'
    LIMIT 1
  )) AS selected_answer_text,
  attempt.answer_snapshot,
  attempt.score,
  attempt.is_flagged,
  attempt.is_submitted,
  attempt.attempted_at,
  attempt.time_spent_seconds,
  attempt.student_question_speed,
  attempt.was_timed,
  attempt.mode,
  attempt.content_snapshot
FROM public.student_question_attempts attempt
JOIN public.vstudent_ucat_access_context context
  ON context.student_id = attempt.student_id AND context.has_ucat_access
LEFT JOIN public.student_question_set_attempts set_attempt
  ON set_attempt.id = attempt.student_question_set_attempt_id
LEFT JOIN public.student_practice_sessions practice_session
  ON practice_session.id = attempt.student_practice_session_id
LEFT JOIN public.ucat_questions question ON question.id = attempt.question_id
LEFT JOIN public.question_stems stem ON stem.id = question.question_stem_id
LEFT JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
LEFT JOIN public.ucat_sections section ON section.id = stem.section_id
LEFT JOIN public.question_answer_options selected_option
  ON selected_option.id = (attempt.answer_snapshot#>>'{response,selectedOptionId}')::UUID
WHERE (attempt.student_question_set_attempt_id IS NULL OR set_attempt.discarded_at IS NULL)
  AND (attempt.student_practice_session_id IS NULL OR practice_session.discarded_at IS NULL);

CREATE VIEW public.vstudent_ucat_my_question_progress AS
WITH ranked_attempts AS (
  SELECT
    attempt.question_id,
    attempt.question_stem_id,
    attempt.answer_scheme,
    attempt.ucat_section_id,
    attempt.question_stem_category_id,
    attempt.score,
    row_number() OVER (
      PARTITION BY attempt.question_id
      ORDER BY attempt.score DESC NULLS LAST, attempt.attempted_at DESC, attempt.id DESC
    ) AS question_rank
  FROM public.vstudent_ucat_my_question_attempts attempt
  JOIN public.ucat_questions current_question
    ON current_question.id = attempt.question_id AND current_question.deleted_at IS NULL
  JOIN public.vstudent_ucat_accessible_question_stems accessible_stem
    ON accessible_stem.id = current_question.question_stem_id
  WHERE attempt.is_submitted
), best_attempts AS (
  SELECT
    ranked.question_id,
    ranked.question_stem_id,
    ranked.answer_scheme,
    ranked.ucat_section_id,
    ranked.question_stem_category_id,
    ranked.score,
    row_number() OVER (
      PARTITION BY ranked.ucat_section_id, ranked.question_stem_id
      ORDER BY ranked.question_id
    ) AS stem_question_rank
  FROM ranked_attempts ranked
  WHERE ranked.question_rank = 1
)
SELECT
  best.ucat_section_id AS section_id,
  best.question_stem_category_id AS category_id,
  COALESCE(sum(best.score), 0)::INTEGER AS correct_score,
  sum(CASE
    WHEN best.answer_scheme = 'decision_making_binary_placement'
      THEN CASE WHEN best.stem_question_rank = 1 THEN 2 ELSE 0 END
    ELSE 1
  END)::INTEGER AS max_score
FROM best_attempts best
WHERE best.ucat_section_id IS NOT NULL
GROUP BY best.ucat_section_id, best.question_stem_category_id;

CREATE VIEW public.vstudent_ucat_study_plan_readiness_evidence AS
WITH submitted_evidence AS (
  SELECT
    attempt.ucat_section_id AS section_id,
    attempt.question_stem_category_id AS category_id,
    COALESCE(attempt.student_practice_session_id::TEXT, attempt.student_question_set_attempt_id::TEXT) AS evidence_session_id,
    attempt.question_id,
    attempt.score,
    attempt.student_question_speed,
    attempt.was_timed
  FROM public.vstudent_ucat_my_question_attempts attempt
  LEFT JOIN public.student_practice_sessions practice_session ON practice_session.id = attempt.student_practice_session_id
  LEFT JOIN public.student_question_set_attempts set_attempt ON set_attempt.id = attempt.student_question_set_attempt_id
  WHERE attempt.is_submitted
    AND attempt.ucat_section_id IS NOT NULL
    AND (practice_session.completed_at IS NOT NULL OR set_attempt.completed_at IS NOT NULL)
), session_category AS (
  SELECT section_id, category_id, evidence_session_id,
    count(DISTINCT question_id)::INTEGER AS question_count,
    avg(score) FILTER (WHERE score IS NOT NULL) AS accuracy,
    COALESCE(
      avg(student_question_speed) FILTER (WHERE NOT was_timed AND student_question_speed > 0),
      avg(student_question_speed) FILTER (WHERE student_question_speed > 0)
    ) AS observed_pace
  FROM submitted_evidence
  GROUP BY section_id, category_id, evidence_session_id
), category_evidence AS (
  SELECT section_id, category_id, 'category'::TEXT AS readiness_scope,
    sum(question_count)::INTEGER AS attempted_question_count,
    count(*)::INTEGER AS completed_practice_sessions,
    count(*) FILTER (WHERE question_count >= 10)::INTEGER AS qualifying_practice_sessions,
    max(question_count) AS largest_practice_session_question_count,
    avg(accuracy) AS recent_accuracy,
    avg(observed_pace) AS observed_pace
  FROM session_category WHERE category_id IS NOT NULL
  GROUP BY section_id, category_id
), session_section AS (
  SELECT section_id, evidence_session_id,
    count(DISTINCT question_id)::INTEGER AS question_count,
    avg(score) FILTER (WHERE score IS NOT NULL) AS accuracy,
    COALESCE(
      avg(student_question_speed) FILTER (WHERE NOT was_timed AND student_question_speed > 0),
      avg(student_question_speed) FILTER (WHERE student_question_speed > 0)
    ) AS observed_pace
  FROM submitted_evidence
  GROUP BY section_id, evidence_session_id
), section_evidence AS (
  SELECT section_id, NULL::UUID AS category_id, 'section'::TEXT AS readiness_scope,
    sum(question_count)::INTEGER AS attempted_question_count,
    count(*)::INTEGER AS completed_practice_sessions,
    count(*) FILTER (WHERE question_count >= 10)::INTEGER AS qualifying_practice_sessions,
    max(question_count) AS largest_practice_session_question_count,
    avg(accuracy) AS recent_accuracy,
    avg(observed_pace) AS observed_pace
  FROM session_section GROUP BY section_id
)
SELECT * FROM category_evidence
UNION ALL
SELECT * FROM section_evidence;

CREATE VIEW public.vstudent_ucat_question_stem_delivery AS
SELECT stem.id, stem.section_id, section.section_number, section.name AS section_name,
  section.display_columns, section.instructions_text AS section_instructions_text,
  section.instructions_time_limit_seconds AS section_instructions_time_limit_seconds,
  section.time_limit_seconds AS section_time_limit_seconds,
  stem.question_stem_category_id, stem.stem_text, stem.created_at, stem.updated_at,
  (SELECT json_agg(json_build_object(
    'id', question.id, 'question_text', question.question_text,
    'answer_explanation', question.answer_explanation, 'index', question.index,
    'difficulty', question.difficulty, 'time_burden_seconds', question.time_burden_seconds,
    'response_type', question.response_type, 'answer_scheme', question.answer_scheme,
    'answer_options', (SELECT json_agg(json_build_object(
      'id', option.id, 'answer_text', option.answer_text,
      'answer_explanation', option.answer_explanation, 'index', option.index,
      'answer_key_value', option.answer_key_value
    ) ORDER BY option.index)
    FROM public.question_answer_options option
    WHERE option.question_id = question.id AND option.deleted_at IS NULL)
  ) ORDER BY question.index)
  FROM public.ucat_questions question
  WHERE question.question_stem_id = stem.id AND question.deleted_at IS NULL) AS questions
FROM public.question_stems stem
JOIN public.vstudent_ucat_accessible_question_stems accessible ON accessible.id = stem.id
JOIN public.ucat_sections section ON section.id = stem.section_id;

CREATE VIEW public.vstudent_ucat_question_stem_detail AS
SELECT stem.id, stem.section_id, section.section_number, section.name AS section_name,
  section.display_columns, section.instructions_text AS section_instructions_text,
  section.instructions_time_limit_seconds AS section_instructions_time_limit_seconds,
  section.time_limit_seconds AS section_time_limit_seconds,
  stem.question_stem_category_id, stem.stem_text, stem.created_at, stem.updated_at,
  (SELECT json_agg(json_build_object(
    'id', question.id, 'question_text', question.question_text,
    'answer_explanation', question.answer_explanation, 'index', question.index,
    'difficulty', question.difficulty, 'time_burden_seconds', question.time_burden_seconds,
    'response_type', question.response_type, 'answer_scheme', question.answer_scheme,
    'answer_options', (SELECT json_agg(json_build_object(
      'id', option.id, 'answer_text', option.answer_text,
      'answer_explanation', option.answer_explanation, 'index', option.index,
      'answer_key_value', option.answer_key_value,
      'selection_count', (SELECT count(*)::INTEGER FROM public.student_question_attempts attempt
        WHERE attempt.question_id = question.id
          AND attempt.answer_snapshot#>>'{response,selectedOptionId}' = option.id::TEXT
          AND attempt.is_submitted),
      'total_answered', (SELECT count(*)::INTEGER FROM public.student_question_attempts attempt
        WHERE attempt.question_id = question.id
          AND attempt.answer_snapshot#>>'{response,selectedOptionId}' IS NOT NULL
          AND attempt.is_submitted),
      'percentage', COALESCE(round(100.0 *
        (SELECT count(*)::NUMERIC FROM public.student_question_attempts attempt
          WHERE attempt.question_id = question.id
            AND attempt.answer_snapshot#>>'{response,selectedOptionId}' = option.id::TEXT
            AND attempt.is_submitted)
        / NULLIF((SELECT count(*)::NUMERIC FROM public.student_question_attempts attempt
          WHERE attempt.question_id = question.id
            AND attempt.answer_snapshot#>>'{response,selectedOptionId}' IS NOT NULL
            AND attempt.is_submitted), 0), 1), 0)
    ) ORDER BY option.index)
    FROM public.question_answer_options option
    WHERE option.question_id = question.id AND option.deleted_at IS NULL)
  ) ORDER BY question.index)
  FROM public.ucat_questions question
  WHERE question.question_stem_id = stem.id AND question.deleted_at IS NULL) AS questions
FROM public.question_stems stem
JOIN public.vstudent_ucat_accessible_question_stems accessible ON accessible.id = stem.id
JOIN public.ucat_sections section ON section.id = stem.section_id;

CREATE VIEW public.vtutor_ucat_question_stem_detail AS
SELECT stem.id, stem.section_id, section.section_number, section.name AS section_name,
  section.display_columns, stem.question_stem_category_id, category.name AS category_name,
  stem.status, stem.access_scope, stem.status_changed_at, stem.status_changed_by,
  stem.ai_generation_metadata, stem.source_channel, stem.tutor_source_note,
  stem.stem_text, stem.created_at, stem.updated_at, stem.created_by, stem.updated_by,
  stem.deleted_at, stem.deleted_by,
  public.ucat_content_publication_issues('stem', stem.id) AS publication_issues,
  (SELECT json_agg(json_build_object(
    'id', question.id, 'question_text', question.question_text,
    'answer_explanation', question.answer_explanation, 'index', question.index,
    'difficulty', question.difficulty, 'time_burden_seconds', question.time_burden_seconds,
    'response_type', question.response_type, 'answer_scheme', question.answer_scheme,
    'source_channel', question.source_channel,
    'ai_generation_metadata', question.ai_generation_metadata,
    'tags', (SELECT COALESCE(json_agg(json_build_object('id', tag.id, 'name', tag.name) ORDER BY tag.name), '[]'::json)
      FROM public.questions_question_tags question_tag
      JOIN public.question_tags tag ON tag.id = question_tag.tag_id
      WHERE question_tag.question_id = question.id),
    'answer_options', (SELECT COALESCE(json_agg(json_build_object(
      'id', option.id, 'answer_text', option.answer_text,
      'answer_explanation', option.answer_explanation, 'index', option.index,
      'answer_key_value', option.answer_key_value
    ) ORDER BY option.index, option.id), '[]'::json)
    FROM public.question_answer_options option
    WHERE option.question_id = question.id AND option.deleted_at IS NULL)
  ) ORDER BY question.index, question.id)
  FROM public.ucat_questions question
  WHERE question.question_stem_id = stem.id AND question.deleted_at IS NULL) AS questions
FROM public.question_stems stem
JOIN public.ucat_sections section ON section.id = stem.section_id
LEFT JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
WHERE public.is_ucat_tutor();

CREATE VIEW public.vtutor_ucat_student_question_attempts AS
SELECT attempt.id, attempt.student_id,
  student.first_name AS student_first_name, student.last_name AS student_last_name,
  attempt.student_question_set_attempt_id, attempt.question_id,
  attempt.answer_snapshot, attempt.score, attempt.is_flagged, attempt.is_submitted,
  attempt.attempted_at, attempt.time_spent_seconds, attempt.student_question_speed,
  attempt.was_timed, attempt.mode
FROM public.student_question_attempts attempt
JOIN public.students student ON student.id = attempt.student_id
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(attempt.student_id);

CREATE VIEW public.vtutor_ucat_student_question_attempts_for_progress AS
SELECT attempt.id, attempt.student_id, student.first_name AS student_first_name,
  student.last_name AS student_last_name, attempt.student_question_set_attempt_id,
  attempt.question_id, attempt.answer_snapshot,
  attempt.score, attempt.is_flagged, attempt.is_submitted, attempt.attempted_at,
  attempt.time_spent_seconds, attempt.student_question_speed, attempt.was_timed,
  attempt.mode, section.id AS ucat_section_id, section.name AS section_name,
  section.section_number, question.response_type, question.answer_scheme,
  stem.question_stem_category_id, category.name AS category_name,
  question.question_stem_id
FROM public.student_question_attempts attempt
JOIN public.students student ON student.id = attempt.student_id
JOIN public.ucat_questions question ON question.id = attempt.question_id AND question.deleted_at IS NULL
JOIN public.question_stems stem ON stem.id = question.question_stem_id AND stem.deleted_at IS NULL
LEFT JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
JOIN public.ucat_sections section ON section.id = stem.section_id
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(attempt.student_id);

CREATE VIEW public.vtutor_ucat_student_set_attempt_detail AS
SELECT sqsa.id AS attempt_id, sqsa.student_id,
  student.first_name || ' ' || student.last_name AS student_name,
  sqsa.question_set_id, question_set.description AS set_description,
  sqsa.score_points, sqsa.total_points, sqsa.scaled_score,
  sqsa.time_taken_seconds, sqsa.set_time_limit_seconds,
  sqsa.set_time_limit_at_exam_speed_seconds, sqsa.set_speed,
  sqsa.student_set_speed, sqsa.student_exam_speed, sqsa.was_timed,
  sqsa.attempted_at, sqsa.completed_at,
  (SELECT json_agg(json_build_object(
    'question_id', question.id, 'stem_id', question.question_stem_id,
    'index', question.index, 'question_text', question.question_text,
    'response_type', question.response_type, 'answer_scheme', question.answer_scheme,
    'student_score', question_attempt.score,
    'student_question_speed', question_attempt.student_question_speed,
    'was_correct', question_attempt.score > 0,
    'student_answer_snapshot', question_attempt.answer_snapshot,
    'correct_answer_summary', json_build_object(
      'correct_option_id', (SELECT option.id FROM public.question_answer_options option
        WHERE option.question_id = question.id AND option.answer_key_value = 'correct' LIMIT 1),
      'answer_key_by_option_id', (SELECT COALESCE(jsonb_object_agg(option.id, option.answer_key_value), '{}'::jsonb)
        FROM public.question_answer_options option
        WHERE option.question_id = question.id AND option.answer_key_value IS NOT NULL)
    )
  ) ORDER BY question.index)
  FROM public.student_question_attempts question_attempt
  JOIN public.ucat_questions question ON question.id = question_attempt.question_id
  WHERE question_attempt.student_question_set_attempt_id = sqsa.id
    AND question_attempt.is_submitted) AS questions
FROM public.student_question_set_attempts sqsa
JOIN public.students student ON student.id = sqsa.student_id
JOIN public.question_sets question_set ON question_set.id = sqsa.question_set_id
WHERE public.is_ucat_tutor()
  AND public.can_current_tutor_view_ucat_student(sqsa.student_id);

ALTER VIEW public.vstudent_ucat_my_question_attempts SET (security_invoker = false);
ALTER VIEW public.vstudent_ucat_my_question_progress SET (security_invoker = false);
ALTER VIEW public.vstudent_ucat_study_plan_readiness_evidence SET (security_invoker = false);
ALTER VIEW public.vstudent_ucat_question_stem_delivery SET (security_invoker = false);
ALTER VIEW public.vstudent_ucat_question_stem_detail SET (security_invoker = false);
ALTER VIEW public.vtutor_ucat_question_stem_detail SET (security_invoker = false);
ALTER VIEW public.vtutor_ucat_student_question_attempts SET (security_invoker = false);
ALTER VIEW public.vtutor_ucat_student_question_attempts_for_progress SET (security_invoker = false);
ALTER VIEW public.vtutor_ucat_student_set_attempt_detail SET (security_invoker = false);

GRANT SELECT ON public.vstudent_ucat_my_question_attempts TO authenticated, service_role;
GRANT SELECT ON public.vstudent_ucat_my_question_progress TO authenticated, service_role;
GRANT SELECT ON public.vstudent_ucat_study_plan_readiness_evidence TO authenticated, service_role;
GRANT SELECT ON public.vstudent_ucat_question_stem_delivery TO authenticated, service_role;
GRANT SELECT ON public.vstudent_ucat_question_stem_detail TO authenticated, service_role;
GRANT SELECT ON public.vtutor_ucat_question_stem_detail TO authenticated, service_role;
GRANT SELECT ON public.vtutor_ucat_student_question_attempts TO authenticated, service_role;
GRANT SELECT ON public.vtutor_ucat_student_question_attempts_for_progress TO authenticated, service_role;
GRANT SELECT ON public.vtutor_ucat_student_set_attempt_detail TO authenticated, service_role;

COMMENT ON TYPE public.ucat_response_type IS
  'Candidate-facing interaction. Independent from question-stem category.';
COMMENT ON TYPE public.ucat_answer_scheme IS
  'Canonical authority for response state, validation, persistence, scoring, maximum score, and review.';

-- Diagnostic helpers inspect privileged base-table state. Public application
-- flows reach them only through guarded SECURITY DEFINER writers/views.
REVOKE ALL ON FUNCTION public.ucat_mock_blueprint_compliance(UUID) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.ucat_content_before_mock_blueprint_issues(TEXT, UUID) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.ucat_mock_blueprint_compliance(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.ucat_content_before_mock_blueprint_issues(TEXT, UUID) TO service_role;

DROP FUNCTION IF EXISTS public.tutor_ucat_list_question_catalog(
  TEXT, BOOLEAN, TEXT, TEXT[], UUID[], UUID[], BOOLEAN, UUID[], TEXT[], TEXT[],
  UUID[], BOOLEAN, TEXT[], UUID[], TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT,
  INTEGER, INTEGER, BOOLEAN, TEXT[], INTEGER, INTEGER
);

CREATE OR REPLACE FUNCTION public.tutor_ucat_list_question_catalog(
  p_status TEXT DEFAULT 'draft',
  p_show_deleted BOOLEAN DEFAULT FALSE,
  p_search TEXT DEFAULT NULL,
  p_search_scopes TEXT[] DEFAULT ARRAY['stem_text', 'question_text', 'answer_option_text', 'tutor_source_note']::TEXT[],
  p_section_ids UUID[] DEFAULT NULL,
  p_category_ids UUID[] DEFAULT NULL,
  p_include_no_category BOOLEAN DEFAULT FALSE,
  p_tag_ids UUID[] DEFAULT NULL,
  p_access_scopes TEXT[] DEFAULT NULL,
  p_set_ids UUID[] DEFAULT NULL,
  p_include_without_set BOOLEAN DEFAULT FALSE,
  p_source_channels TEXT[] DEFAULT NULL,
  p_created_by UUID[] DEFAULT NULL,
  p_created_from TIMESTAMPTZ DEFAULT NULL,
  p_created_to TIMESTAMPTZ DEFAULT NULL,
  p_sort_by TEXT DEFAULT NULL,
  p_sort_direction TEXT DEFAULT 'desc',
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20,
  p_ids_only BOOLEAN DEFAULT FALSE,
  p_ai_review_statuses TEXT[] DEFAULT NULL,
  p_question_count_min INTEGER DEFAULT NULL,
  p_question_count_max INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
  safe_page INTEGER := GREATEST(COALESCE(p_page, 1), 1);
  safe_page_size INTEGER := LEAST(
    GREATEST(COALESCE(p_page_size, 20), 1),
    CASE WHEN p_ids_only THEN 50000 ELSE 100 END
  );
  safe_search TEXT := LOWER(BTRIM(REGEXP_REPLACE(COALESCE(p_search, ''), '[[:space:]]+', ' ', 'g')));
  safe_like_search TEXT;
  safe_direction TEXT := CASE WHEN LOWER(COALESCE(p_sort_direction, 'desc')) = 'asc' THEN 'asc' ELSE 'desc' END;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  safe_search := REPLACE(safe_search, '’', '''');
  safe_search := REPLACE(safe_search, '‘', '''');
  safe_search := REPLACE(safe_search, '“', '"');
  safe_search := REPLACE(safe_search, '”', '"');
  safe_search := REPLACE(safe_search, '‐', '-');
  safe_search := REPLACE(safe_search, '‑', '-');
  safe_search := REPLACE(safe_search, '‒', '-');
  safe_search := REPLACE(safe_search, '–', '-');
  safe_search := REPLACE(safe_search, '—', '-');
  safe_search := REPLACE(safe_search, '―', '-');
  safe_like_search := REPLACE(
    REPLACE(REPLACE(safe_search, E'\\', E'\\\\'), '%', E'\\%'),
    '_',
    E'\\_'
  );

  IF p_status IS NOT NULL AND p_status NOT IN ('draft', 'in_review', 'published') THEN
    RAISE EXCEPTION 'invalid question catalog status';
  END IF;

  IF p_question_count_min IS NOT NULL AND p_question_count_min < 0 THEN
    RAISE EXCEPTION 'invalid question count min';
  END IF;

  IF p_question_count_max IS NOT NULL AND p_question_count_max < 0 THEN
    RAISE EXCEPTION 'invalid question count max';
  END IF;

  IF
    p_question_count_min IS NOT NULL
    AND p_question_count_max IS NOT NULL
    AND p_question_count_min > p_question_count_max
  THEN
    RAISE EXCEPTION 'invalid question count range';
  END IF;

  IF COALESCE(CARDINALITY(p_ai_review_statuses), 0) > 0
    AND EXISTS (
      SELECT 1
      FROM UNNEST(p_ai_review_statuses) status_value
      WHERE status_value NOT IN (
        'not_requested',
        'reviewing',
        'deferred',
        'format_blocked',
        'unavailable',
        'unreviewable',
        'passed',
        'concerns',
        'critical'
      )
    )
  THEN
    RAISE EXCEPTION 'invalid ai review status filter';
  END IF;

  WITH filtered AS MATERIALIZED (
    SELECT catalog.*
    FROM public.vtutor_ucat_question_catalog catalog
    WHERE
      (
        (p_show_deleted AND catalog.deleted_at IS NOT NULL)
        OR
        (
          NOT p_show_deleted
          AND catalog.deleted_at IS NULL
          AND catalog.status::TEXT = COALESCE(p_status, 'draft')
        )
      )
      AND (
        safe_search = ''
        OR (
          ('stem_text' = ANY(COALESCE(p_search_scopes, '{}'::TEXT[]))
            AND catalog.stem_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\')
          OR ('question_text' = ANY(COALESCE(p_search_scopes, '{}'::TEXT[]))
            AND catalog.question_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\')
          OR ('answer_option_text' = ANY(COALESCE(p_search_scopes, '{}'::TEXT[]))
            AND catalog.answer_option_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\')
          OR ('tutor_source_note' = ANY(COALESCE(p_search_scopes, '{}'::TEXT[]))
            AND catalog.tutor_source_note_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\')
        )
      )
      AND (COALESCE(CARDINALITY(p_section_ids), 0) = 0 OR catalog.section_id = ANY(p_section_ids))
      AND (
        (COALESCE(CARDINALITY(p_category_ids), 0) = 0 AND NOT p_include_no_category)
        OR catalog.question_stem_category_id = ANY(COALESCE(p_category_ids, '{}'::UUID[]))
        OR (p_include_no_category AND catalog.question_stem_category_id IS NULL)
      )
      AND (COALESCE(CARDINALITY(p_tag_ids), 0) = 0 OR catalog.tag_ids && p_tag_ids)
      AND (
        COALESCE(CARDINALITY(p_access_scopes), 0) = 0
        OR catalog.access_scope::TEXT = ANY(p_access_scopes)
      )
      AND (
        (COALESCE(CARDINALITY(p_set_ids), 0) = 0 AND NOT p_include_without_set)
        OR catalog.set_ids && COALESCE(p_set_ids, '{}'::UUID[])
        OR (p_include_without_set AND CARDINALITY(catalog.set_ids) = 0)
      )
      AND (
        COALESCE(CARDINALITY(p_source_channels), 0) = 0
        OR catalog.source_channel::TEXT = ANY(p_source_channels)
      )
      AND (
        COALESCE(CARDINALITY(p_ai_review_statuses), 0) = 0
        OR catalog.ai_review_status = ANY(p_ai_review_statuses)
      )
      AND (COALESCE(CARDINALITY(p_created_by), 0) = 0 OR catalog.created_by = ANY(p_created_by))
      AND (p_created_from IS NULL OR catalog.created_at >= p_created_from)
      AND (p_created_to IS NULL OR catalog.created_at <= p_created_to)
      AND (p_question_count_min IS NULL OR catalog.question_count >= p_question_count_min)
      AND (p_question_count_max IS NULL OR catalog.question_count <= p_question_count_max)
  ),
  ranked AS (
    SELECT
      filtered.*,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE WHEN p_sort_by = 'section_name' AND safe_direction = 'asc' THEN section_name END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'section_name' AND safe_direction = 'desc' THEN section_name END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'category_name' AND safe_direction = 'asc' THEN category_name END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'category_name' AND safe_direction = 'desc' THEN category_name END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'question_count' AND safe_direction = 'asc' THEN question_count END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'question_count' AND safe_direction = 'desc' THEN question_count END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'sets' AND safe_direction = 'asc' THEN set_names_text END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'sets' AND safe_direction = 'desc' THEN set_names_text END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'visibility' AND safe_direction = 'asc' THEN access_scope::TEXT END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'visibility' AND safe_direction = 'desc' THEN access_scope::TEXT END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'source' AND safe_direction = 'asc' THEN source_channel::TEXT END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'source' AND safe_direction = 'desc' THEN source_channel::TEXT END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'created_at' AND safe_direction = 'asc' THEN created_at END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'created_at' AND safe_direction = 'desc' THEN created_at END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'status' AND safe_direction = 'asc' THEN status::TEXT END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'status' AND safe_direction = 'desc' THEN status::TEXT END DESC NULLS LAST,
          CASE WHEN p_sort_by IS NULL AND safe_direction = 'asc' THEN updated_at END ASC NULLS LAST,
          CASE WHEN p_sort_by IS NULL AND safe_direction = 'desc' THEN updated_at END DESC NULLS LAST,
          id ASC
      ) AS result_ordinal
    FROM filtered
  ),
  page_rows AS (
    SELECT *
    FROM ranked
    WHERE result_ordinal > (safe_page - 1) * safe_page_size
      AND result_ordinal <= safe_page * safe_page_size
  )
  SELECT JSONB_BUILD_OBJECT(
    'items',
    COALESCE(
      JSONB_AGG(
        CASE
          WHEN p_ids_only THEN JSONB_BUILD_OBJECT('id', id)
          ELSE TO_JSONB(page_rows)
            - 'result_ordinal'
            - 'stem_search_text'
            - 'question_search_text'
            - 'answer_option_search_text'
            - 'tutor_source_note_search_text'
            - 'stem_comparison_text'
            - 'stem_comparison_hash'
            - 'question_text_fingerprint'
            - 'question_bundle_fingerprint'
            - 'set_names_text'
        END
        ORDER BY result_ordinal
      ),
      '[]'::JSONB
    ),
    'total', (SELECT COUNT(*) FROM filtered),
    'page', safe_page,
    'pageSize', safe_page_size
  )
  INTO result
  FROM page_rows;

  RETURN COALESCE(
    result,
    JSONB_BUILD_OBJECT('items', '[]'::JSONB, 'total', 0, 'page', safe_page, 'pageSize', safe_page_size)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_list_question_catalog(
  TEXT, BOOLEAN, TEXT, TEXT[], UUID[], UUID[], BOOLEAN, UUID[], TEXT[],
  UUID[], BOOLEAN, TEXT[], UUID[], TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, TEXT[], INTEGER, INTEGER
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_list_question_catalog(
  TEXT, BOOLEAN, TEXT, TEXT[], UUID[], UUID[], BOOLEAN, UUID[], TEXT[],
  UUID[], BOOLEAN, TEXT[], UUID[], TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, TEXT[], INTEGER, INTEGER
) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_student_ucat_question_set_engine_payload(
  p_set_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payload JSONB;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.vstudent_ucat_accessible_question_sets accessible
    WHERE accessible.id = p_set_id
  ) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'source_type', 'set',
    'set_detail', jsonb_build_object(
      'id', question_set.id,
      'name', question_set.name,
      'description', question_set.description,
      'time_limit_seconds', question_set.time_limit_seconds,
      'created_at', question_set.created_at,
      'updated_at', question_set.updated_at,
      'stems', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'stem_id', stem.id,
            'stem_text', stem.stem_text,
            'questions_meta', COALESCE((
              SELECT jsonb_agg(
                jsonb_build_object('id', question.id, 'index', question.index)
                ORDER BY question.index
              )
              FROM public.ucat_questions question
              WHERE question.question_stem_id = stem.id
                AND question.deleted_at IS NULL
            ), '[]'::JSONB)
          )
          ORDER BY membership.index
        )
        FROM public.question_stems_question_sets membership
        JOIN public.question_stems stem
          ON stem.id = membership.question_stem_id
          AND stem.deleted_at IS NULL
          AND stem.status = 'published'
        WHERE membership.question_set_id = question_set.id
      ), '[]'::JSONB)
    ),
    'stem_details', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', stem.id,
          'section_id', stem.section_id,
          'section_number', section.section_number,
          'section_name', section.name,
          'display_columns', section.display_columns,
          'section_instructions_text', section.instructions_text,
          'section_instructions_time_limit_seconds', section.instructions_time_limit_seconds,
          'section_time_limit_seconds', section.time_limit_seconds,
          'question_stem_category_id', stem.question_stem_category_id,
          'stem_text', stem.stem_text,
          'created_at', stem.created_at,
          'updated_at', stem.updated_at,
          'questions', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', question.id,
                'question_text', question.question_text,
                'answer_explanation', question.answer_explanation,
                'index', question.index,
                'difficulty', question.difficulty,
                'time_burden_seconds', question.time_burden_seconds,
                'response_type', question.response_type,
                'answer_scheme', question.answer_scheme,
                'answer_options', COALESCE((
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'id', option.id,
                      'answer_text', option.answer_text,
                      'answer_explanation', option.answer_explanation,
                      'index', option.index,
                      'answer_key_value', option.answer_key_value
                    )
                    ORDER BY option.index
                  )
                  FROM public.question_answer_options option
                  WHERE option.question_id = question.id
                    AND option.deleted_at IS NULL
                ), '[]'::JSONB)
              )
              ORDER BY question.index
            )
            FROM public.ucat_questions question
            WHERE question.question_stem_id = stem.id
              AND question.deleted_at IS NULL
          ), '[]'::JSONB)
        )
        ORDER BY membership.index
      )
      FROM public.question_stems_question_sets membership
      JOIN public.question_stems stem
        ON stem.id = membership.question_stem_id
        AND stem.deleted_at IS NULL
        AND stem.status = 'published'
      JOIN public.ucat_sections section ON section.id = stem.section_id
      WHERE membership.question_set_id = question_set.id
    ), '[]'::JSONB)
  )
  INTO v_payload
  FROM public.question_sets question_set
  WHERE question_set.id = p_set_id
    AND question_set.deleted_at IS NULL
    AND question_set.status = 'published';

  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_ucat_question_set_engine_payload(UUID)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_student_ucat_question_set_engine_payload(UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_merge_exact_duplicate_stems(
  p_target_stem_id UUID,
  p_source_stem_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_projection public.ucat_question_catalog_projection%ROWTYPE;
  source_projection public.ucat_question_catalog_projection%ROWTYPE;
  source_question RECORD;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'UCAT tutor access required' USING ERRCODE = '42501';
  END IF;
  IF p_target_stem_id IS NULL
    OR p_source_stem_id IS NULL
    OR p_target_stem_id = p_source_stem_id
  THEN
    RAISE EXCEPTION 'Two different question stems are required';
  END IF;

  SELECT projection.* INTO target_projection
  FROM public.ucat_question_catalog_projection projection
  JOIN public.question_stems stem ON stem.id = projection.stem_id
  WHERE projection.stem_id = p_target_stem_id
    AND stem.deleted_at IS NULL
  FOR UPDATE OF stem;

  SELECT projection.* INTO source_projection
  FROM public.ucat_question_catalog_projection projection
  JOIN public.question_stems stem ON stem.id = projection.stem_id
  WHERE projection.stem_id = p_source_stem_id
    AND stem.deleted_at IS NULL
  FOR UPDATE OF stem;

  IF target_projection.stem_id IS NULL OR source_projection.stem_id IS NULL THEN
    RAISE EXCEPTION 'Question stem not found';
  END IF;
  IF target_projection.stem_comparison_hash <> source_projection.stem_comparison_hash THEN
    RAISE EXCEPTION 'The question stems no longer have matching normalized stem content';
  END IF;

  FOR source_question IN
    SELECT source.id
    FROM public.ucat_questions source
    WHERE source.question_stem_id = p_source_stem_id
      AND source.deleted_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.ucat_questions target
        WHERE target.question_stem_id = p_target_stem_id
          AND target.deleted_at IS NULL
          AND target.response_type = source.response_type
          AND target.answer_scheme = source.answer_scheme
          AND public.canonical_ucat_catalog_rich_text(target.question_text)
            = public.canonical_ucat_catalog_rich_text(source.question_text)
      )
  LOOP
    UPDATE public.question_answer_options
    SET
      deleted_at = NOW(),
      deleted_by = public.current_tutor_id()
    WHERE question_id = source_question.id
      AND deleted_at IS NULL;

    UPDATE public.ucat_questions
    SET
      deleted_at = NOW(),
      deleted_by = public.current_tutor_id()
    WHERE id = source_question.id;
  END LOOP;

  PERFORM public.tutor_ucat_merge_question_stems(
    p_target_stem_id,
    p_source_stem_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_merge_exact_duplicate_stems(
  UUID, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_merge_exact_duplicate_stems(
  UUID, UUID
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_merge_question_stems(
  p_target_stem_id UUID,
  p_source_stem_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.question_stems%ROWTYPE;
  v_source public.question_stems%ROWTYPE;
  v_target_content JSONB;
  v_source_content JSONB;
  v_unique_source_content JSONB;
  v_next_question_index INTEGER;
  v_question RECORD;
  v_duplicate_question_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_target_stem_id IS NULL OR p_source_stem_id IS NULL OR p_target_stem_id = p_source_stem_id THEN
    RAISE EXCEPTION 'Two different question stems are required';
  END IF;

  SELECT * INTO v_target
  FROM public.question_stems
  WHERE id = p_target_stem_id AND deleted_at IS NULL
  FOR UPDATE;

  SELECT * INTO v_source
  FROM public.question_stems
  WHERE id = p_source_stem_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_target.id IS NULL OR v_source.id IS NULL THEN
    RAISE EXCEPTION 'Question stem not found';
  END IF;

  IF v_target.section_id <> v_source.section_id THEN
    RAISE EXCEPTION 'Question stems must belong to the same UCAT section';
  END IF;

  -- Preserve rich-text blocks that exist only on the source stem. This captures
  -- importer-added instructions without duplicating blocks shared by both stems.
  v_target_content := COALESCE(v_target.stem_text->'content', '[]'::JSONB);
  v_source_content := COALESCE(v_source.stem_text->'content', '[]'::JSONB);
  SELECT COALESCE(jsonb_agg(source_block ORDER BY ordinal), '[]'::JSONB)
  INTO v_unique_source_content
  FROM jsonb_array_elements(v_source_content) WITH ORDINALITY AS source(source_block, ordinal)
  WHERE NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_target_content) AS target(target_block)
    WHERE target.target_block = source.source_block
  );

  SELECT COALESCE(MAX(index), -1) + 1
  INTO v_next_question_index
  FROM public.ucat_questions
  WHERE question_stem_id = p_target_stem_id AND deleted_at IS NULL;

  FOR v_question IN
    SELECT q.*
    FROM public.ucat_questions q
    WHERE q.question_stem_id = p_source_stem_id AND q.deleted_at IS NULL
    ORDER BY q.index, q.id
  LOOP
    -- Collapse a byte-for-byte equivalent question already present on the target.
    -- Question text, explanation, metadata, tags, and ordered options must all match.
    v_duplicate_question_id := NULL;
    SELECT candidate.id INTO v_duplicate_question_id
    FROM public.ucat_questions candidate
    WHERE jsonb_array_length(v_unique_source_content) = 0
      AND candidate.question_stem_id = p_target_stem_id
      AND candidate.deleted_at IS NULL
      AND candidate.question_text = v_question.question_text
      AND candidate.answer_explanation IS NOT DISTINCT FROM v_question.answer_explanation
      AND candidate.difficulty IS NOT DISTINCT FROM v_question.difficulty
      AND candidate.time_burden_seconds IS NOT DISTINCT FROM v_question.time_burden_seconds
      AND candidate.response_type = v_question.response_type
      AND candidate.answer_scheme = v_question.answer_scheme
      AND (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'answer_text', option.answer_text,
          'answer_explanation', option.answer_explanation,
          'answer_key_value', option.answer_key_value
        ) ORDER BY option.index), '[]'::JSONB)
        FROM public.question_answer_options option
        WHERE option.question_id = candidate.id AND option.deleted_at IS NULL
      ) = (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'answer_text', option.answer_text,
          'answer_explanation', option.answer_explanation,
          'answer_key_value', option.answer_key_value
        ) ORDER BY option.index), '[]'::JSONB)
        FROM public.question_answer_options option
        WHERE option.question_id = v_question.id AND option.deleted_at IS NULL
      )
      AND (
        SELECT COALESCE(jsonb_agg(tag.tag_id ORDER BY tag.tag_id), '[]'::JSONB)
        FROM public.questions_question_tags tag
        WHERE tag.question_id = candidate.id
      ) = (
        SELECT COALESCE(jsonb_agg(tag.tag_id ORDER BY tag.tag_id), '[]'::JSONB)
        FROM public.questions_question_tags tag
        WHERE tag.question_id = v_question.id
      )
    LIMIT 1;

    IF v_duplicate_question_id IS NULL THEN
      UPDATE public.ucat_questions
      SET question_stem_id = p_target_stem_id,
          index = v_next_question_index,
          question_text = CASE
            WHEN jsonb_array_length(v_unique_source_content) > 0
              AND jsonb_typeof(question_text) = 'object'
              AND jsonb_typeof(question_text->'content') = 'array'
              THEN jsonb_set(
                question_text,
                '{content}',
                v_unique_source_content || COALESCE(question_text->'content', '[]'::JSONB),
                true
              )
            ELSE question_text
          END,
          updated_at = NOW(),
          updated_by = public.current_tutor_id()
      WHERE id = v_question.id;

      -- Source-only stem blocks may contain images which now live in the moved
      -- question. Retain their file links at question scope as well.
      IF jsonb_array_length(v_unique_source_content) > 0 THEN
        INSERT INTO public.questions_files (question_id, file_id)
        SELECT v_question.id, source_file.file_id
        FROM public.question_stems_files source_file
        WHERE source_file.question_stem_id = p_source_stem_id
        ON CONFLICT (question_id, file_id) DO NOTHING;
      END IF;

      v_next_question_index := v_next_question_index + 1;
    ELSE
      UPDATE public.question_answer_options
      SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
      WHERE question_id = v_question.id AND deleted_at IS NULL;

      UPDATE public.ucat_questions
      SET deleted_at = NOW(), deleted_by = public.current_tutor_id()
      WHERE id = v_question.id;
    END IF;
  END LOOP;

  -- Retain every set membership without creating duplicate target memberships.
  UPDATE public.question_stems_question_sets source_membership
  SET question_stem_id = p_target_stem_id,
      updated_at = NOW(),
      updated_by = public.current_tutor_id()
  WHERE source_membership.question_stem_id = p_source_stem_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.question_stems_question_sets target_membership
      WHERE target_membership.question_stem_id = p_target_stem_id
        AND target_membership.question_set_id = source_membership.question_set_id
    );

  DELETE FROM public.question_stems_question_sets
  WHERE question_stem_id = p_source_stem_id;

  -- Retain all stem-level rich-text file links.
  INSERT INTO public.question_stems_files (question_stem_id, file_id)
  SELECT p_target_stem_id, source_file.file_id
  FROM public.question_stems_files source_file
  WHERE source_file.question_stem_id = p_source_stem_id
  ON CONFLICT (question_stem_id, file_id) DO NOTHING;

  DELETE FROM public.question_stems_files
  WHERE question_stem_id = p_source_stem_id;

  UPDATE public.question_stems
  SET deleted_at = NOW(),
      deleted_by = public.current_tutor_id(),
      updated_at = NOW(),
      updated_by = public.current_tutor_id()
  WHERE id = p_source_stem_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_merge_question_stems(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_merge_question_stems(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.ucat_content_core_publication_issues(p_content_type text, p_content_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_issues JSONB := '[]'::jsonb;
  v_access public.ucat_access_scope;
BEGIN
  IF p_content_type = 'stem' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.question_stems
      WHERE id = p_content_id AND deleted_at IS NULL
    ) THEN
      RETURN jsonb_build_array(jsonb_build_object('code', 'not_found', 'message', 'Question stem not found.'));
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.question_stems
      WHERE id = p_content_id AND question_stem_category_id IS NULL
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'missing_category', 'message', 'Choose a stem category.'));
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.ucat_questions
      WHERE question_stem_id = p_content_id AND deleted_at IS NULL
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'missing_questions', 'message', 'Add at least one question.'));
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.ucat_questions question
      WHERE question.question_stem_id = p_content_id
        AND question.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.questions_question_tags question_tag
          WHERE question_tag.question_id = question.id
        )
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'missing_tags', 'message', 'Every question needs at least one tag.'));
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.ucat_questions question
      WHERE question.question_stem_id = p_content_id
        AND question.deleted_at IS NULL
        AND (
          (question.answer_scheme <> 'decision_making_binary_placement' AND NOT public.ucat_rich_text_has_content(question.answer_explanation))
          OR (question.answer_scheme = 'decision_making_binary_placement' AND EXISTS (
            SELECT 1 FROM public.question_answer_options option
            WHERE option.question_id = question.id
              AND option.deleted_at IS NULL
              AND NOT public.ucat_rich_text_has_content(option.answer_explanation)
          ))
        )
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'missing_explanations', 'message', 'Complete every required answer explanation.'));
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.ucat_questions question
      WHERE question.question_stem_id = p_content_id
        AND question.deleted_at IS NULL
        AND (
          NOT public.ucat_rich_text_has_content(question.question_text)
          OR (SELECT COUNT(*) FROM public.question_answer_options option WHERE option.question_id = question.id AND option.deleted_at IS NULL) < 2
          OR EXISTS (
            SELECT 1 FROM public.question_answer_options option
            WHERE option.question_id = question.id
              AND option.deleted_at IS NULL
              AND NOT public.ucat_rich_text_has_content(option.answer_text)
          )
          OR (
            question.answer_scheme IN ('single_choice', 'situational_judgement_rating')
            AND (SELECT COUNT(*) FROM public.question_answer_options option WHERE option.question_id = question.id AND option.deleted_at IS NULL AND option.answer_key_value = 'correct') <> 1
          )
        )
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'invalid_answer_structure', 'message', 'Every question needs valid answer options and a valid correct answer.'));
    END IF;

  ELSIF p_content_type = 'set' THEN
    SELECT access_scope INTO v_access
    FROM public.question_sets
    WHERE id = p_content_id AND deleted_at IS NULL;

    IF v_access IS NULL THEN
      RETURN jsonb_build_array(jsonb_build_object('code', 'not_found', 'message', 'Question set not found.'));
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.question_stems_question_sets
      WHERE question_set_id = p_content_id
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'missing_stems', 'message', 'Add at least one question stem.'));
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.question_stems_question_sets member
      JOIN public.question_stems stem ON stem.id = member.question_stem_id
      WHERE member.question_set_id = p_content_id
        AND (stem.deleted_at IS NOT NULL OR stem.status <> 'published')
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'unpublished_children', 'message', 'Every stem in a published set must be published.'));
    END IF;

    IF v_access = 'public' AND EXISTS (
      SELECT 1
      FROM public.question_stems_question_sets member
      JOIN public.question_stems stem ON stem.id = member.question_stem_id
      WHERE member.question_set_id = p_content_id
        AND stem.access_scope = 'private'
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'private_children', 'message', 'A public set cannot contain private stems.'));
    END IF;

  ELSIF p_content_type = 'mock' THEN
    SELECT access_scope INTO v_access
    FROM public.ucat_mocks
    WHERE id = p_content_id AND deleted_at IS NULL;

    IF v_access IS NULL THEN
      RETURN jsonb_build_array(jsonb_build_object('code', 'not_found', 'message', 'Mock exam not found.'));
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.question_sets_ucat_mocks
      WHERE ucat_mock_id = p_content_id
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'missing_sets', 'message', 'Add at least one question set.'));
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.question_sets_ucat_mocks member
      JOIN public.question_sets question_set ON question_set.id = member.question_set_id
      WHERE member.ucat_mock_id = p_content_id
        AND (question_set.deleted_at IS NOT NULL OR question_set.status <> 'published')
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'unpublished_children', 'message', 'Every set in a published mock must be published.'));
    END IF;

    IF v_access = 'public' AND EXISTS (
      SELECT 1
      FROM public.question_sets_ucat_mocks member
      JOIN public.question_sets question_set ON question_set.id = member.question_set_id
      WHERE member.ucat_mock_id = p_content_id
        AND question_set.access_scope = 'private'
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object('code', 'private_children', 'message', 'A public mock cannot contain private sets.'));
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_ucat_content_type';
  END IF;

  RETURN v_issues;
END;
$function$
