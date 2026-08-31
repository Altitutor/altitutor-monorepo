-- Publication and published-mock write guards block only official question
-- totals and answering time. Category ranges and questions-per-stem remain
-- visible as non-blocking checks. Deleted or unpublished parent mocks do
-- not prevent saving a published component set.

CREATE OR REPLACE FUNCTION public.ucat_mock_blueprint_candidate_compliance(
  p_mock_id UUID,
  p_blueprint_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blueprint public.ucat_mock_blueprints%ROWTYPE;
  v_section public.ucat_mock_blueprint_sections%ROWTYPE;
  v_policy JSONB;
  v_rule JSONB;
  v_checks JSONB;
  v_sections JSONB := '[]'::JSONB;
  v_reasons JSONB := '[]'::JSONB;
  v_actual INTEGER;
  v_set_count INTEGER;
  v_time_limit INTEGER;
  v_compliant BOOLEAN := true;
  v_check_compliant BOOLEAN;
  v_label TEXT;
  v_minimum INTEGER;
  v_maximum INTEGER;
  v_expected INTEGER;
  v_section_number INTEGER;
BEGIN
  SELECT blueprint.* INTO v_blueprint
  FROM public.ucat_mocks mock
  JOIN public.ucat_mock_blueprints blueprint ON blueprint.id = p_blueprint_id
  WHERE mock.id = p_mock_id AND mock.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'applicable', false,
      'compliant', true,
      'blueprintId', p_blueprint_id,
      'blueprintCode', null,
      'sections', '[]'::JSONB,
      'reasons', jsonb_build_array(jsonb_build_object(
        'code', 'BLUEPRINT_NOT_SELECTED',
        'message', 'Select a managed full-mock blueprint.'
      ))
    );
  END IF;

  FOR v_section IN
    SELECT * FROM public.ucat_mock_blueprint_sections
    WHERE blueprint_id = v_blueprint.id
    ORDER BY section_index
  LOOP
    v_checks := '[]'::JSONB;
    v_policy := v_section.altitutor_composition_policy;
    v_section_number := v_section.section_index + 1;

    SELECT
      count(question_set.id)::INTEGER,
      min(public.ucat_question_set_time_limit_seconds(question_set.id))
    INTO v_set_count, v_time_limit
    FROM public.question_sets question_set
    JOIN public.ucat_sections section ON section.id = question_set.section_id
    WHERE question_set.mock_id = p_mock_id
      AND question_set.deleted_at IS NULL
      AND section.section_number = v_section_number;

    SELECT count(question.id)::INTEGER INTO v_actual
    FROM public.question_sets mock_set
    JOIN public.question_stems_question_sets set_member
      ON set_member.question_set_id = mock_set.id
    JOIN public.question_stems stem
      ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
    JOIN public.ucat_questions question
      ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
    WHERE mock_set.mock_id = p_mock_id
      AND mock_set.deleted_at IS NULL
      AND mock_set.section_id = stem.section_id
      AND EXISTS (
        SELECT 1 FROM public.ucat_sections section
        WHERE section.id = mock_set.section_id
          AND section.section_number = v_section_number
      );

    v_check_compliant := v_set_count = 1 AND v_actual = v_section.exact_question_count;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code', 'QUESTION_TOTAL_MISMATCH', 'label', 'Candidate-visible question total',
      'unit', 'questions', 'target', v_section.exact_question_count,
      'actual', v_actual, 'compliant', v_check_compliant,
      'reason', CASE WHEN v_check_compliant THEN 'Exact total met.'
        ELSE format(
          'Requires exactly %s questions in one section set; found %s questions across %s sets.',
          v_section.exact_question_count, v_actual, v_set_count
        ) END
    ));
    IF NOT v_check_compliant THEN v_compliant := false; END IF;

    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code', 'SECTION_ORDER_INVALID', 'label', 'Section order', 'unit', 'position',
      'target', v_section_number, 'actual', CASE WHEN v_set_count = 1 THEN v_section_number ELSE NULL END,
      'compliant', v_set_count = 1,
      'reason', CASE WHEN v_set_count = 1
        THEN 'Section order is fixed by the selected blueprint.'
        ELSE 'The blueprint section slot is empty.' END
    ));

    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code', 'INSTRUCTION_TIME_MISMATCH', 'label', 'Instruction time', 'unit', 'seconds',
      'target', v_section.instruction_time_seconds, 'actual', v_section.instruction_time_seconds,
      'compliant', true,
      'reason', 'Instruction time is supplied by the selected immutable blueprint version.'
    ));

    v_check_compliant := v_set_count = 1 AND v_time_limit = v_section.answering_time_seconds;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code', 'ANSWERING_TIME_MISMATCH', 'label', 'Answering time', 'unit', 'seconds',
      'target', v_section.answering_time_seconds, 'actual', v_time_limit,
      'compliant', v_check_compliant,
      'reason', CASE WHEN v_check_compliant THEN 'Exact answering time met.'
        ELSE format(
          'Requires exactly %s seconds; found %s.',
          v_section.answering_time_seconds,
          COALESCE(v_time_limit::TEXT, 'no section set')
        ) END
    ));
    IF NOT v_check_compliant THEN v_compliant := false; END IF;

    IF v_policy ? 'exactStemCount' THEN
      v_expected := (v_policy->>'exactStemCount')::INTEGER;
      SELECT count(DISTINCT stem.id)::INTEGER INTO v_actual
      FROM public.question_sets mock_set
      JOIN public.question_stems_question_sets set_member
        ON set_member.question_set_id = mock_set.id
      JOIN public.question_stems stem
        ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
      JOIN public.ucat_sections section ON section.id = mock_set.section_id
      WHERE mock_set.mock_id = p_mock_id
        AND mock_set.deleted_at IS NULL
        AND section.section_number = v_section_number;
      v_check_compliant := v_actual = v_expected;
      v_checks := v_checks || jsonb_build_array(jsonb_build_object(
        'code', 'STEM_TOTAL_MISMATCH', 'label', 'Stem total', 'unit', 'stems',
        'target', v_expected, 'actual', v_actual, 'compliant', v_check_compliant,
        'reason', format('Target %s stems; found %s.', v_expected, v_actual)
      ));
    END IF;

    FOR v_rule IN
      SELECT * FROM jsonb_array_elements(COALESCE(v_policy->'categoryRules', '[]'::JSONB))
    LOOP
      v_label := COALESCE(v_rule->>'label', v_rule->>'category', 'Answer-scheme questions');
      v_minimum := (v_rule->>'min')::INTEGER;
      v_maximum := (v_rule->>'max')::INTEGER;
      IF v_rule ? 'categoryId' OR v_rule ? 'category' THEN
        IF v_rule->>'unit' = 'stems' THEN
          SELECT count(DISTINCT stem.id)::INTEGER INTO v_actual
          FROM public.question_sets mock_set
          JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_set.id
          JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
          JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
          JOIN public.ucat_sections section ON section.id = mock_set.section_id
          WHERE mock_set.mock_id = p_mock_id
            AND mock_set.deleted_at IS NULL
            AND section.section_number = v_section_number
            AND (
              category.id = NULLIF(v_rule->>'categoryId', '')::UUID
              OR (NOT (v_rule ? 'categoryId') AND category.name = v_rule->>'category')
            );
        ELSE
          SELECT count(question.id)::INTEGER INTO v_actual
          FROM public.question_sets mock_set
          JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_set.id
          JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
          JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
          JOIN public.ucat_sections section ON section.id = mock_set.section_id
          JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
          WHERE mock_set.mock_id = p_mock_id
            AND mock_set.deleted_at IS NULL
            AND section.section_number = v_section_number
            AND (
              category.id = NULLIF(v_rule->>'categoryId', '')::UUID
              OR (NOT (v_rule ? 'categoryId') AND category.name = v_rule->>'category')
            );
        END IF;
      ELSE
        SELECT count(question.id)::INTEGER INTO v_actual
        FROM public.question_sets mock_set
        JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_set.id
        JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
        JOIN public.ucat_sections section ON section.id = mock_set.section_id
        JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
        WHERE mock_set.mock_id = p_mock_id
          AND mock_set.deleted_at IS NULL
          AND section.section_number = v_section_number
          AND question.answer_scheme::TEXT = v_rule->>'answerScheme';
      END IF;

      v_check_compliant := v_actual BETWEEN v_minimum AND v_maximum;
      v_checks := v_checks || jsonb_build_array(jsonb_build_object(
        'code', 'CATEGORY_COUNT_OUT_OF_RANGE', 'label', v_label, 'unit', v_rule->>'unit',
        'minimum', v_minimum, 'preferred', (v_rule->>'preferred')::INTEGER,
        'maximum', v_maximum, 'actual', v_actual, 'compliant', v_check_compliant,
        'reason', format(
          'Allowed %s–%s; preferred %s; found %s.',
          v_minimum, v_maximum, COALESCE(v_rule->>'preferred', 'any in range'), v_actual
        )
      ));

      IF v_rule ? 'requiredAnswerScheme' THEN
        SELECT count(question.id)::INTEGER INTO v_actual
        FROM public.question_sets mock_set
        JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_set.id
        JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
        JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
        JOIN public.ucat_sections section ON section.id = mock_set.section_id
        JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
        WHERE mock_set.mock_id = p_mock_id
          AND mock_set.deleted_at IS NULL
          AND section.section_number = v_section_number
          AND (
            category.id = NULLIF(v_rule->>'categoryId', '')::UUID
            OR (NOT (v_rule ? 'categoryId') AND category.name = v_rule->>'category')
          )
          AND question.answer_scheme::TEXT <> v_rule->>'requiredAnswerScheme';
        v_check_compliant := v_actual = 0;
        v_checks := v_checks || jsonb_build_array(jsonb_build_object(
          'code', 'CATEGORY_ANSWER_SCHEME_MISMATCH',
          'label', format('%s Answer scheme mismatches', v_label),
          'unit', 'questions', 'target', 0, 'actual', v_actual,
          'compliant', v_check_compliant,
          'reason', format(
            'Requires %s; found %s mismatches.',
            v_rule->>'requiredAnswerScheme', v_actual
          )
        ));
      END IF;
    END LOOP;

    FOR v_rule IN
      SELECT * FROM jsonb_array_elements(COALESCE(v_policy->'responseContractRules', '[]'::JSONB))
    LOOP
      v_expected := (v_rule->>'questionsPerStem')::INTEGER;
      SELECT count(*)::INTEGER INTO v_actual FROM (
        SELECT stem.id
        FROM public.question_sets mock_set
        JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_set.id
        JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
        JOIN public.ucat_sections section ON section.id = mock_set.section_id
        JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
        WHERE mock_set.mock_id = p_mock_id
          AND mock_set.deleted_at IS NULL
          AND section.section_number = v_section_number
        GROUP BY stem.id
        HAVING bool_or(question.answer_scheme::TEXT = v_rule->>'answerScheme')
          AND count(question.id) <> v_expected
      ) invalid_contract_stems;
      v_check_compliant := v_actual = 0;
      v_checks := v_checks || jsonb_build_array(jsonb_build_object(
        'code', 'RESPONSE_CONTRACT_STEM_COUNT_INVALID',
        'label', format('%s questions per stem', v_rule->>'answerScheme'),
        'unit', 'invalid stems', 'target', 0, 'actual', v_actual,
        'compliant', v_check_compliant,
        'reason', format(
          'Each matching stem requires exactly %s question(s); found %s invalid stems.',
          v_expected, v_actual
        )
      ));
    END LOOP;

    SELECT count(*)::INTEGER INTO v_actual FROM (
      SELECT stem.id
      FROM public.question_sets mock_set
      JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_set.id
      JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
      JOIN public.ucat_sections section ON section.id = mock_set.section_id
      WHERE mock_set.mock_id = p_mock_id
        AND mock_set.deleted_at IS NULL
        AND section.section_number = v_section_number
      GROUP BY stem.id HAVING count(*) > 1
    ) duplicate_stems;
    v_check_compliant := v_actual = 0;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code', 'DUPLICATE_STEM_ID', 'label', 'Duplicate stems', 'unit', 'stems',
      'target', 0, 'actual', v_actual, 'compliant', v_check_compliant,
      'reason', format('A stem may appear only once; found %s duplicated stems.', v_actual)
    ));

    FOR v_rule IN
      SELECT * FROM jsonb_array_elements(COALESCE(v_policy->'structureRules', '[]'::JSONB))
    LOOP
      v_minimum := (v_rule->>'min')::INTEGER;
      v_maximum := (v_rule->>'max')::INTEGER;
      v_label := v_rule->>'label';
      IF v_rule->>'kind' = 'stem_count' THEN
        SELECT count(*)::INTEGER INTO v_actual FROM (
          SELECT stem.id
          FROM public.question_sets mock_set
          JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_set.id
          JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
          JOIN public.ucat_sections section ON section.id = mock_set.section_id
          JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
          WHERE mock_set.mock_id = p_mock_id
            AND mock_set.deleted_at IS NULL
            AND section.section_number = v_section_number
          GROUP BY stem.id
          HAVING CASE WHEN v_rule->>'questionCardinality' = 'single'
            THEN count(question.id) = 1 ELSE count(question.id) > 1 END
        ) matching_stems;
        v_check_compliant := v_actual BETWEEN v_minimum AND v_maximum;
      ELSE
        SELECT count(*)::INTEGER INTO v_actual FROM (
          SELECT stem.id
          FROM public.question_sets mock_set
          JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_set.id
          JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
          JOIN public.ucat_sections section ON section.id = mock_set.section_id
          JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
          WHERE mock_set.mock_id = p_mock_id
            AND mock_set.deleted_at IS NULL
            AND section.section_number = v_section_number
          GROUP BY stem.id HAVING count(question.id) NOT BETWEEN v_minimum AND v_maximum
        ) invalid_stems;
        v_check_compliant := v_actual = 0;
      END IF;
      v_checks := v_checks || jsonb_build_array(jsonb_build_object(
        'code', 'STRUCTURE_RULE_FAILED', 'label', v_label,
        'unit', CASE WHEN v_rule->>'kind' = 'stem_count' THEN 'stems' ELSE 'invalid stems' END,
        'minimum', v_minimum, 'maximum', v_maximum, 'actual', v_actual,
        'compliant', v_check_compliant,
        'reason', CASE WHEN v_rule->>'kind' = 'stem_count'
          THEN format('Allowed %s–%s; found %s.', v_minimum, v_maximum, v_actual)
          ELSE format(
            '%s stems fall outside %s–%s questions per stem.',
            v_actual, v_minimum, v_maximum
          ) END
      ));
    END LOOP;

    v_sections := v_sections || jsonb_build_array(jsonb_build_object(
      'section', v_section.section_code,
      'targetQuestions', v_section.exact_question_count,
      'actualQuestions', (v_checks->0->>'actual')::INTEGER,
      'compliant', NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_checks) item
        WHERE item->>'code' IN (
          'QUESTION_TOTAL_MISMATCH',
          'ANSWERING_TIME_MISMATCH',
          'INSTRUCTION_TIME_MISMATCH'
        ) AND NOT (item->>'compliant')::BOOLEAN
      ),
      'checks', v_checks
    ));
  END LOOP;

  SELECT COALESCE(bool_and(
    item->>'code' NOT IN (
      'QUESTION_TOTAL_MISMATCH',
      'ANSWERING_TIME_MISMATCH',
      'INSTRUCTION_TIME_MISMATCH'
    ) OR (item->>'compliant')::BOOLEAN
  ), true)
  INTO v_compliant
  FROM jsonb_array_elements(v_sections) AS section
  CROSS JOIN jsonb_array_elements(section->'checks') AS item;

  IF NOT v_compliant THEN
    v_reasons := jsonb_build_array(jsonb_build_object(
      'code', 'BLUEPRINT_NONCOMPLIANT',
      'message', 'Question totals or answering times violate the selected full-mock blueprint.'
    ));
  END IF;

  RETURN jsonb_build_object(
    'applicable', true,
    'compliant', v_compliant,
    'blueprintId', v_blueprint.id,
    'blueprintCode', v_blueprint.code,
    'testYear', v_blueprint.test_year,
    'version', v_blueprint.version,
    'sections', v_sections,
    'reasons', v_reasons
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_question_set_v2(
  p_set_id UUID,
  p_authoring_note TEXT,
  p_description JSONB,
  p_timing_mode public.ucat_question_set_timing_mode,
  p_pace_multiplier NUMERIC,
  p_fixed_time_limit_seconds INTEGER,
  p_set_format public.ucat_question_set_format,
  p_access_scope public.ucat_access_scope,
  p_stem_ids JSONB,
  p_section_id UUID,
  p_reference_blueprint_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set_id UUID;
  v_staff_id UUID;
  v_stem_id UUID;
  v_index INTEGER := 0;
  v_status public.ucat_content_status;
  v_issues JSONB;
  v_current public.question_sets%ROWTYPE;
  v_next_index INTEGER;
  v_mock_blueprint_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_staff_id := public.current_tutor_id();
  IF p_section_id IS NULL THEN RAISE EXCEPTION 'question_set_section_required'; END IF;
  IF p_reference_blueprint_id IS NULL THEN RAISE EXCEPTION 'question_set_blueprint_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ucat_sections WHERE id = p_section_id) THEN
    RAISE EXCEPTION 'ucat_section_not_found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ucat_mock_blueprints WHERE id = p_reference_blueprint_id) THEN
    RAISE EXCEPTION 'question_set_blueprint_not_found';
  END IF;

  IF p_set_id IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      p_section_id::TEXT || ':' || p_set_format::TEXT,
      20876
    ));
    SELECT COALESCE(max(catalog_index), 0) + 1 INTO v_next_index
    FROM public.question_sets
    WHERE deleted_at IS NULL AND mock_id IS NULL
      AND section_id = p_section_id AND set_format = p_set_format;

    INSERT INTO public.question_sets (
      name, authoring_note, description, status, access_scope, section_id,
      set_format, timing_mode, pace_multiplier, fixed_time_limit_seconds,
      reference_blueprint_id, mock_id, catalog_index, created_by, updated_by
    ) VALUES (
      NULL, NULLIF(BTRIM(p_authoring_note), ''), p_description, 'draft',
      COALESCE(p_access_scope, 'public'), p_section_id, p_set_format,
      p_timing_mode, p_pace_multiplier, p_fixed_time_limit_seconds,
      p_reference_blueprint_id, NULL, v_next_index, v_staff_id, v_staff_id
    ) RETURNING id, status INTO v_set_id, v_status;
  ELSE
    SELECT * INTO v_current
    FROM public.question_sets
    WHERE id = p_set_id AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'question_set_not_found'; END IF;

    IF v_current.mock_id IS NOT NULL THEN
      SELECT blueprint_id INTO v_mock_blueprint_id
      FROM public.ucat_mocks WHERE id = v_current.mock_id;
      IF p_section_id IS DISTINCT FROM v_current.section_id THEN
        RAISE EXCEPTION 'mock_component_section_frozen';
      END IF;
      IF p_set_format <> 'full_section'
        OR p_timing_mode <> 'pace'
        OR p_pace_multiplier <> 1
        OR p_fixed_time_limit_seconds IS NOT NULL
        OR p_reference_blueprint_id IS DISTINCT FROM v_mock_blueprint_id
      THEN
        RAISE EXCEPTION 'mock_component_intent_is_blueprint_owned';
      END IF;
    ELSIF p_section_id IS DISTINCT FROM v_current.section_id
      AND EXISTS (
        SELECT 1 FROM public.question_stems_question_sets member
        WHERE member.question_set_id = p_set_id
      )
    THEN
      RAISE EXCEPTION 'question_set_section_has_members';
    END IF;

    IF v_current.mock_id IS NULL AND (
      p_section_id IS DISTINCT FROM v_current.section_id
      OR p_set_format IS DISTINCT FROM v_current.set_format
    ) THEN
      PERFORM pg_advisory_xact_lock(hashtextextended(
        v_current.section_id::TEXT || ':' || v_current.set_format::TEXT,
        20876
      ));
      PERFORM pg_advisory_xact_lock(hashtextextended(
        p_section_id::TEXT || ':' || p_set_format::TEXT,
        20876
      ));
      SELECT COALESCE(max(catalog_index), 0) + 1 INTO v_next_index
      FROM public.question_sets
      WHERE deleted_at IS NULL AND mock_id IS NULL
        AND section_id = p_section_id AND set_format = p_set_format;
    ELSE
      v_next_index := v_current.catalog_index;
    END IF;

    UPDATE public.question_sets
    SET authoring_note = NULLIF(BTRIM(p_authoring_note), ''),
        description = p_description,
        timing_mode = p_timing_mode,
        pace_multiplier = p_pace_multiplier,
        fixed_time_limit_seconds = p_fixed_time_limit_seconds,
        set_format = p_set_format,
        access_scope = COALESCE(p_access_scope, 'public'),
        section_id = p_section_id,
        reference_blueprint_id = p_reference_blueprint_id,
        catalog_index = v_next_index,
        updated_by = v_staff_id
    WHERE id = p_set_id
    RETURNING id, status INTO v_set_id, v_status;
    IF v_current.mock_id IS NULL AND (
      p_section_id IS DISTINCT FROM v_current.section_id
      OR p_set_format IS DISTINCT FROM v_current.set_format
    ) THEN
      PERFORM public.ucat_compact_standalone_set_catalog(v_current.section_id, v_current.set_format);
    END IF;
  END IF;

  DELETE FROM public.question_stems_question_sets WHERE question_set_id = v_set_id;
  FOR v_stem_id IN
    SELECT NULLIF(value::TEXT, '')::UUID
    FROM jsonb_array_elements_text(COALESCE(p_stem_ids, '[]'::JSONB))
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.question_stems
      WHERE id = v_stem_id AND deleted_at IS NULL AND section_id = p_section_id
    ) THEN
      RAISE EXCEPTION 'question_stem_not_found_or_section_mismatch';
    END IF;
    v_index := v_index + 1;
    INSERT INTO public.question_stems_question_sets (
      question_stem_id, question_set_id, index, created_by, updated_by
    ) VALUES (v_stem_id, v_set_id, v_index, v_staff_id, v_staff_id);
  END LOOP;

  IF v_status = 'in_review' AND EXISTS (
    SELECT 1 FROM public.question_stems_question_sets member
    JOIN public.question_stems child ON child.id = member.question_stem_id
    WHERE member.question_set_id = v_set_id AND child.status = 'draft'
  ) THEN
    RAISE EXCEPTION 'in_review_set_contains_draft_stem';
  END IF;

  IF v_status = 'published' THEN
    v_issues := public.ucat_content_publication_issues('set', v_set_id);
    IF jsonb_array_length(v_issues) > 0 THEN
      RAISE EXCEPTION 'published_content_invalid:%', v_issues::TEXT;
    END IF;
    IF v_current.mock_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.ucat_mocks parent
        WHERE parent.id = v_current.mock_id
          AND parent.deleted_at IS NULL
          AND parent.status = 'published'
          AND NOT (public.ucat_mock_blueprint_compliance(parent.id)->>'compliant')::BOOLEAN
      )
    THEN
      RAISE EXCEPTION 'published_mock_blueprint_noncompliant:%', v_current.mock_id;
    END IF;
  END IF;
  RETURN v_set_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_question_set_v2(
  UUID, TEXT, JSONB, public.ucat_question_set_timing_mode, NUMERIC, INTEGER,
  public.ucat_question_set_format, public.ucat_access_scope, JSONB, UUID, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_question_set_v2(
  UUID, TEXT, JSONB, public.ucat_question_set_timing_mode, NUMERIC, INTEGER,
  public.ucat_question_set_format, public.ucat_access_scope, JSONB, UUID, UUID
) TO authenticated;
