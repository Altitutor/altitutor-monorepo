-- Remove stem presentation_format from schema, blueprints, compliance, and tutor views.
-- Focused practice and full-mock composition continue to use category/structure rules only.

ALTER TABLE public.ucat_mock_blueprint_sections
  DISABLE TRIGGER prevent_ucat_mock_blueprint_section_mutation;

UPDATE public.ucat_mock_blueprint_sections
SET altitutor_composition_policy = altitutor_composition_policy - 'presentationRules'
WHERE altitutor_composition_policy ? 'presentationRules';

ALTER TABLE public.ucat_mock_blueprint_sections
  ENABLE TRIGGER prevent_ucat_mock_blueprint_section_mutation;

CREATE OR REPLACE FUNCTION public.ucat_mock_blueprint_candidate_compliance(p_mock_id uuid, p_blueprint_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blueprint public.ucat_mock_blueprints%ROWTYPE;
  v_section public.ucat_mock_blueprint_sections%ROWTYPE;
  v_policy JSONB;
  v_rule JSONB;
  v_checks JSONB;
  v_sections JSONB := '[]'::jsonb;
  v_reasons JSONB := '[]'::jsonb;
  v_actual INTEGER;
  v_set_count INTEGER;
  v_time_limit INTEGER;
  v_member_index INTEGER;
  v_compliant BOOLEAN := true;
  v_check_compliant BOOLEAN;
  v_label TEXT;
  v_minimum INTEGER;
  v_maximum INTEGER;
  v_expected INTEGER;
BEGIN
  SELECT blueprint.* INTO v_blueprint
  FROM public.ucat_mocks mock
  JOIN public.ucat_mock_blueprints blueprint ON blueprint.id = p_blueprint_id
  WHERE mock.id = p_mock_id AND mock.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'applicable', false,
      'compliant', true,
      'blueprintId', null,
      'blueprintCode', null,
      'sections', '[]'::jsonb,
      'reasons', jsonb_build_array(jsonb_build_object(
        'code', 'BLUEPRINT_NOT_SELECTED',
        'message', 'No full-mock blueprint is selected.'
      ))
    );
  END IF;

  FOR v_section IN
    SELECT * FROM public.ucat_mock_blueprint_sections
    WHERE blueprint_id = v_blueprint.id
    ORDER BY section_index
  LOOP
    v_checks := '[]'::jsonb;
    v_policy := v_section.altitutor_composition_policy;

    SELECT
      count(DISTINCT member.question_set_id)::integer,
      min(question_set.time_limit_seconds),
      min(member.index)
    INTO v_set_count, v_time_limit, v_member_index
    FROM public.question_sets_ucat_mocks member
    JOIN public.question_sets question_set
      ON question_set.id = member.question_set_id AND question_set.deleted_at IS NULL
    WHERE member.ucat_mock_id = p_mock_id
      AND EXISTS (
        SELECT 1
        FROM public.question_stems_question_sets set_member
        JOIN public.question_stems stem ON stem.id = set_member.question_stem_id
        JOIN public.ucat_sections section ON section.id = stem.section_id
        WHERE set_member.question_set_id = member.question_set_id
          AND stem.deleted_at IS NULL
          AND CASE section.section_number
            WHEN 1 THEN 'verbal_reasoning'
            WHEN 2 THEN 'decision_making'
            WHEN 3 THEN 'quantitative_reasoning'
            WHEN 4 THEN 'situational_judgement'
          END = v_section.section_code
      );

    SELECT count(question.id)::integer INTO v_actual
    FROM public.question_sets_ucat_mocks mock_member
    JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_member.question_set_id
    JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
    JOIN public.ucat_sections section ON section.id = stem.section_id
    JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
    WHERE mock_member.ucat_mock_id = p_mock_id
      AND CASE section.section_number
        WHEN 1 THEN 'verbal_reasoning'
        WHEN 2 THEN 'decision_making'
        WHEN 3 THEN 'quantitative_reasoning'
        WHEN 4 THEN 'situational_judgement'
      END = v_section.section_code;

    v_check_compliant := v_set_count = 1 AND v_actual = v_section.exact_question_count;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code', 'QUESTION_TOTAL_MISMATCH', 'label', 'Candidate-visible question total',
      'unit', 'questions', 'target', v_section.exact_question_count,
      'actual', v_actual, 'compliant', v_check_compliant,
      'reason', CASE WHEN v_check_compliant THEN 'Exact total met.'
        ELSE format('Requires exactly %s questions in one section set; found %s questions across %s sets.', v_section.exact_question_count, v_actual, v_set_count) END
    ));
    IF NOT v_check_compliant THEN v_compliant := false; END IF;

    v_check_compliant := v_set_count = 1 AND v_member_index = v_section.section_index + 1;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code', 'SECTION_ORDER_INVALID', 'label', 'Section order', 'unit', 'position',
      'target', v_section.section_index + 1, 'actual', v_member_index,
      'compliant', v_check_compliant,
      'reason', format('Target position %s; found %s.', v_section.section_index + 1, coalesce(v_member_index::text, 'no section set'))
    ));
    IF NOT v_check_compliant THEN v_compliant := false; END IF;

    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code', 'INSTRUCTION_TIME_MISMATCH', 'label', 'Instruction time', 'unit', 'seconds',
      'target', v_section.instruction_time_seconds, 'actual', v_section.instruction_time_seconds,
      'compliant', true, 'reason', 'Instruction time is supplied by the selected immutable blueprint version.'
    ));

    v_check_compliant := v_set_count = 1 AND v_time_limit = v_section.answering_time_seconds;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code', 'ANSWERING_TIME_MISMATCH', 'label', 'Answering time', 'unit', 'seconds',
      'target', v_section.answering_time_seconds, 'actual', v_time_limit,
      'compliant', v_check_compliant,
      'reason', CASE WHEN v_check_compliant THEN 'Exact answering time met.'
        ELSE format('Requires exactly %s seconds; found %s.', v_section.answering_time_seconds, coalesce(v_time_limit::text, 'no section set')) END
    ));
    IF NOT v_check_compliant THEN v_compliant := false; END IF;

    IF v_policy ? 'exactStemCount' THEN
      v_expected := (v_policy->>'exactStemCount')::integer;
      SELECT count(DISTINCT stem.id)::integer INTO v_actual
      FROM public.question_sets_ucat_mocks mock_member
      JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_member.question_set_id
      JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
      JOIN public.ucat_sections section ON section.id = stem.section_id
      WHERE mock_member.ucat_mock_id = p_mock_id
        AND CASE section.section_number WHEN 1 THEN 'verbal_reasoning' WHEN 2 THEN 'decision_making' WHEN 3 THEN 'quantitative_reasoning' WHEN 4 THEN 'situational_judgement' END = v_section.section_code;
      v_check_compliant := v_actual = v_expected;
      v_checks := v_checks || jsonb_build_array(jsonb_build_object(
        'code', 'STEM_TOTAL_MISMATCH', 'label', 'Stem total', 'unit', 'stems',
        'target', v_expected, 'actual', v_actual, 'compliant', v_check_compliant,
        'reason', format('Target %s stems; found %s.', v_expected, v_actual)
      ));
      IF NOT v_check_compliant THEN v_compliant := false; END IF;
    END IF;

    FOR v_rule IN SELECT * FROM jsonb_array_elements(coalesce(v_policy->'categoryRules', '[]'::jsonb))
    LOOP
      v_label := coalesce(v_rule->>'label', v_rule->>'category', 'Answer-scheme questions');
      v_minimum := (v_rule->>'min')::integer;
      v_maximum := (v_rule->>'max')::integer;
      IF v_rule ? 'category' THEN
        IF v_rule->>'unit' = 'stems' THEN
          SELECT count(DISTINCT stem.id)::integer INTO v_actual
          FROM public.question_sets_ucat_mocks mock_member
          JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_member.question_set_id
          JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
          JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
          JOIN public.ucat_sections section ON section.id = stem.section_id
          WHERE mock_member.ucat_mock_id = p_mock_id AND category.name = v_rule->>'category'
            AND CASE section.section_number WHEN 1 THEN 'verbal_reasoning' WHEN 2 THEN 'decision_making' WHEN 3 THEN 'quantitative_reasoning' WHEN 4 THEN 'situational_judgement' END = v_section.section_code;
        ELSE
          SELECT count(question.id)::integer INTO v_actual
          FROM public.question_sets_ucat_mocks mock_member
          JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_member.question_set_id
          JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
          JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
          JOIN public.ucat_sections section ON section.id = stem.section_id
          JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
          WHERE mock_member.ucat_mock_id = p_mock_id AND category.name = v_rule->>'category'
            AND CASE section.section_number WHEN 1 THEN 'verbal_reasoning' WHEN 2 THEN 'decision_making' WHEN 3 THEN 'quantitative_reasoning' WHEN 4 THEN 'situational_judgement' END = v_section.section_code;
        END IF;
      ELSE
        SELECT count(question.id)::integer INTO v_actual
        FROM public.question_sets_ucat_mocks mock_member
        JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_member.question_set_id
        JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
        JOIN public.ucat_sections section ON section.id = stem.section_id
        JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
        WHERE mock_member.ucat_mock_id = p_mock_id AND question.answer_scheme::text = v_rule->>'answerScheme'
          AND CASE section.section_number WHEN 1 THEN 'verbal_reasoning' WHEN 2 THEN 'decision_making' WHEN 3 THEN 'quantitative_reasoning' WHEN 4 THEN 'situational_judgement' END = v_section.section_code;
      END IF;
      v_check_compliant := v_actual BETWEEN v_minimum AND v_maximum;
      v_checks := v_checks || jsonb_build_array(jsonb_build_object(
        'code', 'CATEGORY_COUNT_OUT_OF_RANGE', 'label', v_label, 'unit', v_rule->>'unit',
        'minimum', v_minimum, 'preferred', (v_rule->>'preferred')::integer, 'maximum', v_maximum,
        'actual', v_actual, 'compliant', v_check_compliant,
        'reason', format('Allowed %s–%s; preferred %s; found %s.', v_minimum, v_maximum, coalesce(v_rule->>'preferred', 'any in range'), v_actual)
      ));
      IF NOT v_check_compliant THEN v_compliant := false; END IF;

      IF v_rule ? 'requiredAnswerScheme' THEN
        SELECT count(question.id)::integer INTO v_actual
        FROM public.question_sets_ucat_mocks mock_member
        JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_member.question_set_id
        JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
        JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
        JOIN public.ucat_sections section ON section.id = stem.section_id
        JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
        WHERE mock_member.ucat_mock_id = p_mock_id
          AND category.name = v_rule->>'category'
          AND question.answer_scheme::text <> v_rule->>'requiredAnswerScheme'
          AND CASE section.section_number WHEN 1 THEN 'verbal_reasoning' WHEN 2 THEN 'decision_making' WHEN 3 THEN 'quantitative_reasoning' WHEN 4 THEN 'situational_judgement' END = v_section.section_code;
        v_check_compliant := v_actual = 0;
        v_checks := v_checks || jsonb_build_array(jsonb_build_object(
          'code', 'CATEGORY_ANSWER_SCHEME_MISMATCH', 'label', format('%s Answer scheme mismatches', v_label),
          'unit', 'questions', 'target', 0, 'actual', v_actual, 'compliant', v_check_compliant,
          'reason', format('Requires %s; found %s mismatches.', v_rule->>'requiredAnswerScheme', v_actual)
        ));
        IF NOT v_check_compliant THEN v_compliant := false; END IF;
      END IF;
    END LOOP;


    FOR v_rule IN SELECT * FROM jsonb_array_elements(coalesce(v_policy->'responseContractRules', '[]'::jsonb))
    LOOP
      v_expected := (v_rule->>'questionsPerStem')::integer;
      SELECT count(*)::integer INTO v_actual FROM (
        SELECT stem.id
        FROM public.question_sets_ucat_mocks mock_member
        JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_member.question_set_id
        JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
        JOIN public.ucat_sections section ON section.id = stem.section_id
        JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
        WHERE mock_member.ucat_mock_id = p_mock_id
          AND CASE section.section_number WHEN 1 THEN 'verbal_reasoning' WHEN 2 THEN 'decision_making' WHEN 3 THEN 'quantitative_reasoning' WHEN 4 THEN 'situational_judgement' END = v_section.section_code
        GROUP BY stem.id
        HAVING bool_or(question.answer_scheme::text = v_rule->>'answerScheme')
          AND count(question.id) <> v_expected
      ) invalid_contract_stems;
      v_check_compliant := v_actual = 0;
      v_checks := v_checks || jsonb_build_array(jsonb_build_object(
        'code', 'RESPONSE_CONTRACT_STEM_COUNT_INVALID',
        'label', format('%s questions per stem', v_rule->>'answerScheme'),
        'unit', 'invalid stems', 'target', 0, 'actual', v_actual, 'compliant', v_check_compliant,
        'reason', format('Each matching stem requires exactly %s question(s); found %s invalid stems.', v_expected, v_actual)
      ));
      IF NOT v_check_compliant THEN v_compliant := false; END IF;
    END LOOP;

    SELECT count(*)::integer INTO v_actual FROM (
      SELECT stem.id
      FROM public.question_sets_ucat_mocks mock_member
      JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_member.question_set_id
      JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
      JOIN public.ucat_sections section ON section.id = stem.section_id
      WHERE mock_member.ucat_mock_id = p_mock_id
        AND CASE section.section_number WHEN 1 THEN 'verbal_reasoning' WHEN 2 THEN 'decision_making' WHEN 3 THEN 'quantitative_reasoning' WHEN 4 THEN 'situational_judgement' END = v_section.section_code
      GROUP BY stem.id HAVING count(*) > 1
    ) duplicate_stems;
    v_check_compliant := v_actual = 0;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code', 'DUPLICATE_STEM_ID', 'label', 'Duplicate stems', 'unit', 'stems',
      'target', 0, 'actual', v_actual, 'compliant', v_check_compliant,
      'reason', format('A stem may appear only once; found %s duplicated stems.', v_actual)
    ));
    IF NOT v_check_compliant THEN v_compliant := false; END IF;

    FOR v_rule IN SELECT * FROM jsonb_array_elements(coalesce(v_policy->'structureRules', '[]'::jsonb))
    LOOP
      v_minimum := (v_rule->>'min')::integer;
      v_maximum := (v_rule->>'max')::integer;
      v_label := v_rule->>'label';
      IF v_rule->>'kind' = 'stem_count' THEN
        SELECT count(*)::integer INTO v_actual FROM (
          SELECT stem.id
          FROM public.question_sets_ucat_mocks mock_member
          JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_member.question_set_id
          JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
          JOIN public.ucat_sections section ON section.id = stem.section_id
          JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
          WHERE mock_member.ucat_mock_id = p_mock_id
            AND CASE section.section_number WHEN 1 THEN 'verbal_reasoning' WHEN 2 THEN 'decision_making' WHEN 3 THEN 'quantitative_reasoning' WHEN 4 THEN 'situational_judgement' END = v_section.section_code
          GROUP BY stem.id
          HAVING CASE WHEN v_rule->>'questionCardinality' = 'single' THEN count(question.id) = 1 ELSE count(question.id) > 1 END
        ) matching_stems;
        v_check_compliant := v_actual BETWEEN v_minimum AND v_maximum;
      ELSE
        SELECT count(*)::integer INTO v_actual FROM (
          SELECT stem.id
          FROM public.question_sets_ucat_mocks mock_member
          JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_member.question_set_id
          JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
          JOIN public.ucat_sections section ON section.id = stem.section_id
          JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
          WHERE mock_member.ucat_mock_id = p_mock_id
            AND CASE section.section_number WHEN 1 THEN 'verbal_reasoning' WHEN 2 THEN 'decision_making' WHEN 3 THEN 'quantitative_reasoning' WHEN 4 THEN 'situational_judgement' END = v_section.section_code
          GROUP BY stem.id HAVING count(question.id) NOT BETWEEN v_minimum AND v_maximum
        ) invalid_stems;
        v_check_compliant := v_actual = 0;
      END IF;
      v_checks := v_checks || jsonb_build_array(jsonb_build_object(
        'code', 'STRUCTURE_RULE_FAILED', 'label', v_label,
        'unit', CASE WHEN v_rule->>'kind' = 'stem_count' THEN 'stems' ELSE 'invalid stems' END,
        'minimum', v_minimum, 'maximum', v_maximum, 'actual', v_actual, 'compliant', v_check_compliant,
        'reason', CASE WHEN v_rule->>'kind' = 'stem_count' THEN format('Allowed %s–%s; found %s.', v_minimum, v_maximum, v_actual)
          ELSE format('%s stems fall outside %s–%s questions per stem.', v_actual, v_minimum, v_maximum) END
      ));
      IF NOT v_check_compliant THEN v_compliant := false; END IF;
    END LOOP;

    v_sections := v_sections || jsonb_build_array(jsonb_build_object(
      'section', v_section.section_code,
      'targetQuestions', v_section.exact_question_count,
      'actualQuestions', (v_checks->0->>'actual')::integer,
      'compliant', NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_checks) item WHERE NOT (item->>'compliant')::boolean),
      'checks', v_checks
    ));
  END LOOP;

  IF NOT v_compliant THEN
    v_reasons := jsonb_build_array(jsonb_build_object(
      'code', 'BLUEPRINT_NONCOMPLIANT',
      'message', 'One or more section sets violate the selected full-mock blueprint.'
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
$function$;

CREATE OR REPLACE FUNCTION public.ucat_mock_blueprint_compliance(p_mock_id UUID)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.ucat_mock_blueprint_candidate_compliance(
    p_mock_id,
    (SELECT mock.blueprint_id FROM public.ucat_mocks mock
      WHERE mock.id = p_mock_id AND mock.deleted_at IS NULL)
  );
$$;

GRANT EXECUTE ON FUNCTION public.ucat_mock_blueprint_compliance(UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_audit_mock_blueprint(
  p_mock_id UUID,
  p_blueprint_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id UUID;
  v_compliance JSONB;
  v_publication JSONB;
  v_section_purity JSONB;
  v_provisional JSONB;
  v_non_metadata_compliant BOOLEAN;
  v_decision public.ucat_mock_blueprint_audit_decision;
  v_unpublished_sets INTEGER;
  v_unpublished_stems INTEGER;
  v_impure_sets INTEGER;
  v_unclassified_dm INTEGER;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ucat_mocks WHERE id = p_mock_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'mock_not_found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ucat_mock_blueprints WHERE id = p_blueprint_id) THEN
    RAISE EXCEPTION 'mock_blueprint_not_found';
  END IF;

  v_compliance := public.ucat_mock_blueprint_candidate_compliance(p_mock_id, p_blueprint_id);

  SELECT
    count(DISTINCT question_set.id) FILTER (WHERE question_set.status <> 'published')::integer,
    count(DISTINCT stem.id) FILTER (WHERE stem.status <> 'published')::integer
  INTO v_unpublished_sets, v_unpublished_stems
  FROM public.question_sets_ucat_mocks mock_member
  JOIN public.question_sets question_set ON question_set.id = mock_member.question_set_id AND question_set.deleted_at IS NULL
  LEFT JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = question_set.id
  LEFT JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
  WHERE mock_member.ucat_mock_id = p_mock_id;

  v_publication := jsonb_build_object(
    'compliant', coalesce(v_unpublished_sets, 0) = 0 AND coalesce(v_unpublished_stems, 0) = 0,
    'unpublishedSetCount', coalesce(v_unpublished_sets, 0),
    'unpublishedStemCount', coalesce(v_unpublished_stems, 0),
    'reason', CASE WHEN coalesce(v_unpublished_sets, 0) = 0 AND coalesce(v_unpublished_stems, 0) = 0
      THEN 'Every shared set and stem is published.'
      ELSE format('%s shared sets and %s stems are not published.', coalesce(v_unpublished_sets, 0), coalesce(v_unpublished_stems, 0)) END
  );

  SELECT count(*)::integer INTO v_impure_sets
  FROM (
    SELECT mock_member.question_set_id
    FROM public.question_sets_ucat_mocks mock_member
    JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_member.question_set_id
    JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
    WHERE mock_member.ucat_mock_id = p_mock_id
    GROUP BY mock_member.question_set_id
    HAVING count(DISTINCT stem.section_id) <> 1
  ) impure;
  v_section_purity := jsonb_build_object(
    'compliant', coalesce(v_impure_sets, 0) = 0,
    'impureSetCount', coalesce(v_impure_sets, 0),
    'reason', CASE WHEN coalesce(v_impure_sets, 0) = 0 THEN 'Every shared set contains exactly one section.'
      ELSE format('%s shared sets mix sections.', v_impure_sets) END
  );

  SELECT count(DISTINCT stem.id) FILTER (WHERE section.section_number = 2 AND stem.question_stem_category_id IS NULL)::integer
  INTO v_unclassified_dm
  FROM public.question_sets_ucat_mocks mock_member
  JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_member.question_set_id
  JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
  JOIN public.ucat_sections section ON section.id = stem.section_id
  WHERE mock_member.ucat_mock_id = p_mock_id;

  v_provisional := jsonb_build_object(
    'reviewed', coalesce(v_unclassified_dm, 0) = 0,
    'unclassifiedDecisionMakingStemCount', coalesce(v_unclassified_dm, 0),
    'reason', CASE WHEN coalesce(v_unclassified_dm, 0) = 0
      THEN 'Required Decision Making category metadata has been reviewed.'
      ELSE format('%s Decision Making stems need classification.', coalesce(v_unclassified_dm, 0)) END
  );

  SELECT coalesce(bool_and((check_item->>'compliant')::boolean), true)
  INTO v_non_metadata_compliant
  FROM jsonb_array_elements(v_compliance->'sections') section_item
  CROSS JOIN LATERAL jsonb_array_elements(section_item->'checks') check_item
  WHERE check_item->>'code' NOT IN ('CATEGORY_COUNT_OUT_OF_RANGE');

  IF NOT (v_publication->>'compliant')::boolean
    OR NOT (v_section_purity->>'compliant')::boolean
    OR NOT v_non_metadata_compliant
  THEN
    v_decision := 'failed';
  ELSIF NOT (v_provisional->>'reviewed')::boolean THEN
    v_decision := 'provisional';
  ELSIF NOT (v_compliance->>'compliant')::boolean THEN
    v_decision := 'failed';
  ELSE
    v_decision := 'eligible';
  END IF;

  INSERT INTO public.ucat_mock_blueprint_eligibility_audits (
    mock_id, blueprint_id, checked_at, gate_results, decision
  ) VALUES (
    p_mock_id,
    p_blueprint_id,
    clock_timestamp(),
    jsonb_build_object(
      'compliance', v_compliance,
      'publicationState', v_publication,
      'sectionPurity', v_section_purity,
      'provisionalMetadata', v_provisional
    ),
    v_decision
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

DROP VIEW IF EXISTS public.vtutor_ucat_question_stem_detail;
CREATE VIEW public.vtutor_ucat_question_stem_detail AS
SELECT
  stem.id,
  stem.section_id,
  section.section_number,
  section.name AS section_name,
  section.display_columns,
  stem.question_stem_category_id,
  category.name AS category_name,
  stem.status,
  stem.access_scope,
  stem.status_changed_at,
  stem.status_changed_by,
  stem.ai_generation_metadata,
  stem.source_channel,
  stem.tutor_source_note,
  stem.stem_text,
  stem.created_at,
  stem.updated_at,
  stem.created_by,
  stem.updated_by,
  stem.deleted_at,
  stem.deleted_by,
  public.ucat_content_publication_issues('stem', stem.id) AS publication_issues,
  (
    SELECT json_agg(json_build_object(
      'id', question.id,
      'question_text', question.question_text,
      'answer_explanation', question.answer_explanation,
      'index', question.index,
      'difficulty', question.difficulty,
      'time_burden_seconds', question.time_burden_seconds,
      'question_type', question.question_type,
      'response_type', question.response_type,
      'answer_scheme', question.answer_scheme,
      'source_channel', question.source_channel,
      'ai_generation_metadata', question.ai_generation_metadata,
      'tags', (
        SELECT coalesce(json_agg(json_build_object('id', tag.id, 'name', tag.name) ORDER BY tag.name), '[]'::json)
        FROM public.questions_question_tags question_tag
        JOIN public.question_tags tag ON tag.id = question_tag.tag_id
        WHERE question_tag.question_id = question.id
      ),
      'answer_options', (
        SELECT coalesce(json_agg(json_build_object(
          'id', option.id,
          'answer_text', option.answer_text,
          'answer_explanation', option.answer_explanation,
          'index', option.index,
          'is_answer', option.is_answer,
          'answer_key_value', option.answer_key_value
        ) ORDER BY option.index, option.id), '[]'::json)
        FROM public.question_answer_options option
        WHERE option.question_id = question.id AND option.deleted_at IS NULL
      )
    ) ORDER BY question.index, question.id)
    FROM public.ucat_questions question
    WHERE question.question_stem_id = stem.id AND question.deleted_at IS NULL
  ) AS questions
FROM public.question_stems stem
JOIN public.ucat_sections section ON section.id = stem.section_id
LEFT JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
WHERE public.is_ucat_tutor();

ALTER VIEW public.vtutor_ucat_question_stem_detail SET (security_invoker = false);
GRANT SELECT ON public.vtutor_ucat_question_stem_detail TO authenticated;

ALTER TABLE public.question_stems
  DROP COLUMN IF EXISTS presentation_format;

DROP TYPE IF EXISTS public.ucat_stem_presentation_format;
