-- AI review remains optional. Once a completed AI assessment has raised a
-- finding for the stem's current shared/question content, however, staff must
-- record a decision before that stem can be published.
--
-- Scope fingerprints deliberately mirror tutor-web's assessment fingerprint
-- implementation. This lets an unrelated question edit make only that
-- question's findings stale, without reviving or invalidating other decisions.

CREATE OR REPLACE FUNCTION public.ucat_ai_stable_json_value(value JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  result JSONB;
BEGIN
  IF value IS NULL THEN
    RETURN NULL;
  END IF;

  CASE jsonb_typeof(value)
    WHEN 'string' THEN
      RETURN to_jsonb(normalize(value #>> '{}', NFC));
    WHEN 'array' THEN
      SELECT COALESCE(jsonb_agg(public.ucat_ai_stable_json_value(item) ORDER BY ordinal), '[]'::JSONB)
      INTO result
      FROM jsonb_array_elements(value) WITH ORDINALITY AS element(item, ordinal);
      RETURN result;
    WHEN 'object' THEN
      SELECT COALESCE(jsonb_object_agg(key, public.ucat_ai_stable_json_value(item)), '{}'::JSONB)
      INTO result
      FROM jsonb_each(value) AS member(key, item);
      RETURN result;
    ELSE
      RETURN value;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.ucat_ai_stable_json_stringify(value JSONB)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  result TEXT;
BEGIN
  IF value IS NULL THEN
    RETURN 'null';
  END IF;

  CASE jsonb_typeof(value)
    WHEN 'string' THEN
      RETURN to_jsonb(normalize(value #>> '{}', NFC))::TEXT;
    WHEN 'array' THEN
      SELECT '[' || COALESCE(
        string_agg(public.ucat_ai_stable_json_stringify(item), ',' ORDER BY ordinal),
        ''
      ) || ']'
      INTO result
      FROM jsonb_array_elements(value) WITH ORDINALITY AS element(item, ordinal);
      RETURN result;
    WHEN 'object' THEN
      SELECT '{' || COALESCE(
        string_agg(
          to_jsonb(key)::TEXT || ':' || public.ucat_ai_stable_json_stringify(item),
          ',' ORDER BY key COLLATE "C"
        ),
        ''
      ) || '}'
      INTO result
      FROM jsonb_each(value) AS member(key, item);
      RETURN result;
    ELSE
      RETURN value::TEXT;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.ucat_ai_hash(value JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  SELECT encode(
    extensions.digest(public.ucat_ai_stable_json_stringify(value), 'sha256'),
    'hex'
  );
$$;

CREATE OR REPLACE FUNCTION public.ucat_ai_normalized_text(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT btrim(
    regexp_replace(
      translate(
        normalize(COALESCE(value, ''), NFC),
        U&'\00AD\200B\200C\200D\2060\FEFF',
        ''
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.ucat_ai_positive_number(value JSONB)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  parsed DOUBLE PRECISION;
BEGIN
  parsed := (value #>> '{}')::DOUBLE PRECISION;
  IF parsed IN (
    'Infinity'::DOUBLE PRECISION,
    '-Infinity'::DOUBLE PRECISION,
    'NaN'::DOUBLE PRECISION
  ) OR parsed <= 0 THEN
    RETURN NULL;
  END IF;
  RETURN parsed;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.ucat_ai_canonical_rich_node(value JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  attrs JSONB;
  content JSONB;
  canonical_attrs JSONB;
  authoring_metadata JSONB;
  source TEXT;
  source_value TEXT;
  normalized_value TEXT;
BEGIN
  IF value IS NULL OR jsonb_typeof(value) NOT IN ('array', 'object') THEN
    RETURN value;
  END IF;

  IF jsonb_typeof(value) = 'array' THEN
    SELECT COALESCE(jsonb_agg(canonical ORDER BY ordinal), '[]'::JSONB)
    INTO content
    FROM (
      SELECT
        public.ucat_ai_canonical_rich_node(item) AS canonical,
        ordinal
      FROM jsonb_array_elements(value) WITH ORDINALITY AS element(item, ordinal)
    ) nodes
    WHERE canonical IS NOT NULL;
    RETURN content;
  END IF;

  IF value->>'type' = 'text' THEN
    normalized_value := public.ucat_ai_normalized_text(value->>'text');
    IF normalized_value = '' THEN
      RETURN NULL;
    END IF;
    RETURN jsonb_build_object('type', 'text', 'text', normalized_value);
  END IF;

  attrs := CASE
    WHEN jsonb_typeof(value->'attrs') = 'object' THEN value->'attrs'
    ELSE '{}'::JSONB
  END;

  IF value->>'type' = 'image' THEN
    IF jsonb_typeof(attrs->'fileId') = 'string' AND attrs->>'fileId' <> '' THEN
      source := 'file:' || (attrs->>'fileId');
    ELSIF jsonb_typeof(attrs->'storagePath') = 'string' AND attrs->>'storagePath' <> '' THEN
      source := 'path:' || (attrs->>'storagePath');
    ELSIF jsonb_typeof(attrs->'src') = 'string' AND attrs->>'src' <> '' THEN
      source_value := attrs->>'src';
      IF source_value LIKE 'data:%' THEN
        source := 'data:' || public.ucat_ai_hash(to_jsonb(source_value));
      ELSE
        source := regexp_replace(source_value, '[?#].*$', '');
      END IF;
    END IF;

    SELECT NULLIF(
      COALESCE(jsonb_object_agg(key, public.ucat_ai_stable_json_value(item)), '{}'::JSONB),
      '{}'::JSONB
    )
    INTO authoring_metadata
    FROM jsonb_each(attrs) AS member(key, item)
    WHERE item IS NOT NULL
      AND key !~* '(^src$|url$|fileid$|storagepath$|svg|xml)';

    RETURN jsonb_build_object(
      'type', 'image',
      'source', to_jsonb(source),
      'alt', public.ucat_ai_normalized_text(attrs->>'alt'),
      'visualType', CASE WHEN jsonb_typeof(attrs->'visualType') = 'string' THEN attrs->'visualType' ELSE 'null'::JSONB END,
      'visualSpec', CASE WHEN jsonb_typeof(attrs->'visualSpec') = 'object'
        THEN public.ucat_ai_stable_json_value(attrs->'visualSpec') ELSE 'null'::JSONB END,
      'visualTitle', public.ucat_ai_normalized_text(attrs->>'visualTitle'),
      'visualAltText', public.ucat_ai_normalized_text(attrs->>'visualAltText'),
      'width', to_jsonb(public.ucat_ai_positive_number(
        COALESCE(
          attrs->'modelWidth',
          attrs->'originalModelWidth',
          attrs->'modelSpecifiedWidth',
          attrs->'visualWidth',
          attrs->'width'
        )
      )),
      'height', to_jsonb(public.ucat_ai_positive_number(
        COALESCE(
          attrs->'modelHeight',
          attrs->'originalModelHeight',
          attrs->'modelSpecifiedHeight',
          attrs->'visualHeight',
          attrs->'height'
        )
      )),
      'authoringMetadata', COALESCE(authoring_metadata, 'null'::JSONB)
    );
  END IF;

  IF jsonb_typeof(value->'content') = 'array' THEN
    SELECT COALESCE(jsonb_agg(canonical ORDER BY ordinal), '[]'::JSONB)
    INTO content
    FROM (
      SELECT
        public.ucat_ai_canonical_rich_node(item) AS canonical,
        ordinal
      FROM jsonb_array_elements(value->'content') WITH ORDINALITY AS element(item, ordinal)
    ) nodes
    WHERE canonical IS NOT NULL;
  END IF;

  SELECT COALESCE(jsonb_object_agg(key, public.ucat_ai_stable_json_value(item)), '{}'::JSONB)
  INTO canonical_attrs
  FROM jsonb_each(attrs) AS member(key, item)
  WHERE key IN ('colspan', 'rowspan', 'colwidth');

  RETURN jsonb_strip_nulls(
    jsonb_build_object(
      'type', CASE WHEN jsonb_typeof(value->'type') = 'string' THEN value->'type' ELSE '"node"'::JSONB END,
      'content', CASE WHEN jsonb_array_length(COALESCE(content, '[]'::JSONB)) > 0 THEN content END,
      'attrs', CASE WHEN canonical_attrs <> '{}'::JSONB THEN canonical_attrs END
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ucat_ai_current_shared_fingerprint(p_stem_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.ucat_ai_hash(jsonb_build_object(
    'sectionId', stem.section_id::TEXT,
    'sectionName', public.ucat_ai_normalized_text(section.name),
    'categoryId', to_jsonb(stem.question_stem_category_id::TEXT),
    'categoryName', public.ucat_ai_normalized_text(category.name),
    'displayColumns', section.display_columns,
    'accessScope', stem.access_scope::TEXT,
    'stemText', public.ucat_ai_canonical_rich_node(stem.stem_text),
    'questionMembership', COALESCE((
      SELECT jsonb_agg(question.id::TEXT ORDER BY question.index, question.id)
      FROM public.ucat_questions question
      WHERE question.question_stem_id = stem.id
        AND question.deleted_at IS NULL
    ), '[]'::JSONB)
  ))
  FROM public.question_stems stem
  JOIN public.ucat_sections section ON section.id = stem.section_id
  LEFT JOIN public.question_stem_categories category
    ON category.id = stem.question_stem_category_id
  WHERE stem.id = p_stem_id
    AND stem.deleted_at IS NULL;
$$;

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
    'questionType', question.question_type::TEXT,
    'difficulty', to_jsonb(question.difficulty::DOUBLE PRECISION),
    'timeBurdenSeconds', to_jsonb(question.time_burden_seconds),
    'tagIds', COALESCE((
      SELECT jsonb_agg(link.tag_id::TEXT ORDER BY link.tag_id::TEXT COLLATE "C")
      FROM public.questions_question_tags link
      WHERE link.question_id = question.id
    ), '[]'::JSONB),
    'options', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'index', answer_option.index,
          'answerText', public.ucat_ai_canonical_rich_node(answer_option.answer_text),
          'answerExplanation', public.ucat_ai_canonical_rich_node(answer_option.answer_explanation),
          'isAnswer', answer_option.is_answer
        )
        ORDER BY answer_option.index, answer_option.id
      )
      FROM public.question_answer_options answer_option
      WHERE answer_option.question_id = question.id
        AND answer_option.deleted_at IS NULL
    ), '[]'::JSONB)
  ))
  FROM public.ucat_questions question
  WHERE question.id = p_question_id
    AND question.deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.ucat_unresolved_current_ai_assessment_findings(
  p_stem_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH current_scope AS (
    SELECT public.ucat_ai_current_shared_fingerprint(p_stem_id) AS shared_fingerprint
  ),
  candidate_findings AS (
    SELECT
      run.id AS run_id,
      run.requested_at,
      finding.value AS finding,
      finding.value->>'scopeType' AS scope_type,
      NULLIF(finding.value->>'questionId', '')::UUID AS question_id
    FROM public.ucat_ai_question_assessment_cycles cycle
    JOIN public.ucat_ai_question_assessment_runs run
      ON run.cycle_id = cycle.id
    CROSS JOIN current_scope
    CROSS JOIN LATERAL jsonb_array_elements(
      COALESCE(run.assessment_result->'findings', '[]'::JSONB)
    ) AS finding(value)
    WHERE cycle.stem_id = p_stem_id
      AND cycle.is_current = TRUE
      AND run.status = 'completed'
      AND (
        (
          finding.value->>'scopeType' = 'shared'
          AND run.scope_type = 'full'
          AND run.shared_fingerprint = current_scope.shared_fingerprint
        )
        OR
        (
          finding.value->>'scopeType' = 'question'
          AND NULLIF(finding.value->>'questionId', '') IS NOT NULL
          AND (NULLIF(finding.value->>'questionId', '')::UUID = ANY(run.target_question_ids))
          AND run.question_fingerprints->>(finding.value->>'questionId')
            = public.ucat_ai_current_question_fingerprint(
                NULLIF(finding.value->>'questionId', '')::UUID
              )
        )
      )
  ),
  effective_findings AS (
    SELECT candidate.*
    FROM candidate_findings candidate
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.ucat_ai_question_assessment_cycles newer_cycle
      JOIN public.ucat_ai_question_assessment_runs newer
        ON newer.cycle_id = newer_cycle.id
      CROSS JOIN current_scope
      WHERE newer_cycle.stem_id = p_stem_id
        AND newer_cycle.is_current = TRUE
        AND (newer.requested_at, newer.id) > (candidate.requested_at, candidate.run_id)
        AND (
          (
            candidate.scope_type = 'shared'
            AND newer.scope_type = 'full'
            AND newer.shared_fingerprint = current_scope.shared_fingerprint
          )
          OR
          (
            candidate.scope_type = 'question'
            AND candidate.question_id = ANY(newer.target_question_ids)
            AND newer.question_fingerprints->>candidate.question_id::TEXT
              = public.ucat_ai_current_question_fingerprint(candidate.question_id)
          )
        )
    )
  )
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'code', 'unresolved_ai_review_finding',
      'message', 'Resolve the current AI review finding before publishing.',
      'entity_type', 'stem',
      'entity_id', p_stem_id,
      'assessment_run_id', effective.run_id,
      'finding_key', effective.finding->>'key',
      'question_id', effective.question_id,
      'review_dimension', effective.finding->>'category',
      'title', effective.finding->>'title'
    ) ORDER BY effective.requested_at, effective.finding->>'key'),
    '[]'::JSONB
  )
  FROM effective_findings effective
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.ucat_ai_question_assessment_decisions decision
    WHERE decision.run_id = effective.run_id
      AND decision.finding_key = effective.finding->>'key'
  );
$$;

COMMENT ON FUNCTION public.ucat_unresolved_current_ai_assessment_findings(UUID) IS
  'Returns unresolved findings only from the effective AI assessment run for each exact current stem/question scope. Missing, failed, stale, superseded, deterministic, and duplicate reviews are intentionally ignored.';

REVOKE ALL ON FUNCTION public.ucat_ai_stable_json_value(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ucat_ai_stable_json_stringify(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ucat_ai_hash(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ucat_ai_normalized_text(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ucat_ai_positive_number(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ucat_ai_canonical_rich_node(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ucat_ai_current_shared_fingerprint(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ucat_ai_current_question_fingerprint(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ucat_unresolved_current_ai_assessment_findings(UUID)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ucat_content_publication_issues(
  p_content_type TEXT,
  p_content_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues JSONB := '[]'::JSONB;
  v_enriched JSONB := '[]'::JSONB;
BEGIN
  IF p_content_type IN ('stem', 'set', 'mock') THEN
    v_issues := public.ucat_content_core_publication_issues(p_content_type, p_content_id);

    SELECT COALESCE(
      jsonb_agg(
        issue || jsonb_build_object(
          'entity_type', p_content_type,
          'entity_id', p_content_id
        )
      ),
      '[]'::JSONB
    )
    INTO v_enriched
    FROM jsonb_array_elements(v_issues) issue
    WHERE issue->>'code' <> 'missing_tags';

    IF p_content_type = 'stem' THEN
      v_enriched := v_enriched
        || public.ucat_unresolved_current_ai_assessment_findings(p_content_id);
    ELSIF p_content_type = 'mock' THEN
      SELECT v_enriched || COALESCE(
        jsonb_agg(
          issue || jsonb_build_object(
            'entity_type', 'mock',
            'entity_id', p_content_id
          )
        ),
        '[]'::JSONB
      )
      INTO v_enriched
      FROM jsonb_array_elements(public.ucat_mock_publication_shape_issues(p_content_id)) issue;
    END IF;

    RETURN v_enriched;
  END IF;

  IF p_content_type = 'lesson' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.ucat_learning_modules
      WHERE id = p_content_id
        AND deleted_at IS NULL
        AND kind = 'lesson'
    ) THEN
      RETURN jsonb_build_array(jsonb_build_object(
        'code', 'not_found',
        'message', 'Lesson not found.',
        'entity_type', 'lesson',
        'entity_id', p_content_id
      ));
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.ucat_learning_module_blocks block
      LEFT JOIN public.question_stems stem ON stem.id = block.question_stem_id
      LEFT JOIN public.ucat_questions question ON question.id = block.question_id
      LEFT JOIN public.question_stems question_stem ON question_stem.id = question.question_stem_id
      WHERE block.learning_module_id = p_content_id
        AND block.deleted_at IS NULL
        AND (
          (
            block.block_type = 'question_stem'
            AND (
              block.content->'pendingGeneratedStem' = 'true'::JSONB
              OR block.question_stem_id IS NULL
              OR stem.id IS NULL
              OR stem.deleted_at IS NOT NULL
              OR stem.status IS DISTINCT FROM 'published'
            )
          )
          OR
          (
            block.block_type = 'question'
            AND (
              block.content->'pendingGeneratedStem' = 'true'::JSONB
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
      v_enriched := v_enriched || jsonb_build_array(jsonb_build_object(
        'code', 'unpublished_assessment',
        'message', 'Every assessment block must reference published question content with no pending placeholders.',
        'entity_type', 'lesson',
        'entity_id', p_content_id
      ));
    END IF;

    RETURN v_enriched;
  END IF;

  RAISE EXCEPTION 'invalid_ucat_content_type';
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) TO authenticated;

-- "Keep as is" is a one-click resolution. Retain an optional reason for audit
-- context, but do not require staff to write one.
CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_record_assessment_decision(
  p_run_id UUID,
  p_stem_id UUID,
  p_finding_key TEXT,
  p_decision TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_staff_id UUID;
  v_run RECORD;
  v_finding JSONB;
  v_decision_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_decision NOT IN ('dismissed', 'acknowledged', 'suggestion_rejected') THEN
    RAISE EXCEPTION 'invalid_assessment_decision';
  END IF;

  SELECT run.id, run.stem_id, run.content_fingerprint, run.assessment_result, cycle.is_current
  INTO v_run
  FROM public.ucat_ai_question_assessment_runs run
  JOIN public.ucat_ai_question_assessment_cycles cycle ON cycle.id = run.cycle_id
  WHERE run.id = p_run_id AND run.stem_id = p_stem_id AND run.status = 'completed';
  IF NOT FOUND THEN RAISE EXCEPTION 'assessment_finding_unavailable'; END IF;
  IF v_run.is_current IS DISTINCT FROM true THEN RAISE EXCEPTION 'assessment_finding_stale'; END IF;

  SELECT value INTO v_finding
  FROM jsonb_array_elements(COALESCE(v_run.assessment_result->'findings', '[]'::JSONB))
  WHERE value->>'key' = p_finding_key
  LIMIT 1;
  IF v_finding IS NULL THEN RAISE EXCEPTION 'assessment_finding_not_found'; END IF;
  IF p_decision = 'suggestion_rejected' AND v_finding->'suggestion' IS NULL THEN
    RAISE EXCEPTION 'assessment_suggestion_not_found';
  END IF;

  v_staff_id := public.current_tutor_id();
  INSERT INTO public.ucat_ai_question_assessment_decisions (
    run_id, stem_id, finding_key, decision, reason,
    reviewed_content_fingerprint, patch, decided_by
  ) VALUES (
    p_run_id, p_stem_id, p_finding_key, p_decision,
    NULLIF(BTRIM(COALESCE(p_reason, '')), ''),
    v_run.content_fingerprint,
    CASE WHEN p_decision = 'suggestion_rejected'
      THEN v_finding->'suggestion'->'patches' ELSE NULL END,
    v_staff_id
  ) RETURNING id INTO v_decision_id;

  RETURN jsonb_build_object('id', v_decision_id, 'decision', p_decision);
END;
$$;
