-- Attach immutable blueprints explicitly and derive compliance from the live
-- set/stem composition. Existing mocks remain unversioned until a tutor opts in.

ALTER TABLE public.ucat_mocks
  ADD COLUMN blueprint_id UUID REFERENCES public.ucat_mock_blueprints(id) ON DELETE RESTRICT;

CREATE INDEX idx_ucat_mocks_blueprint_id
  ON public.ucat_mocks(blueprint_id)
  WHERE blueprint_id IS NOT NULL;

CREATE FUNCTION public.ucat_mock_blueprint_compliance(p_mock_id UUID)
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
  v_sections JSONB := '[]'::jsonb;
  v_reasons JSONB := '[]'::jsonb;
  v_actual INTEGER;
  v_set_count INTEGER;
  v_time_limit INTEGER;
  v_compliant BOOLEAN := true;
  v_check_compliant BOOLEAN;
  v_label TEXT;
  v_minimum INTEGER;
  v_maximum INTEGER;
  v_expected INTEGER;
BEGIN
  SELECT blueprint.* INTO v_blueprint
  FROM public.ucat_mocks mock
  JOIN public.ucat_mock_blueprints blueprint ON blueprint.id = mock.blueprint_id
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
      min(question_set.time_limit_seconds)
    INTO v_set_count, v_time_limit
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

    FOR v_rule IN SELECT * FROM jsonb_array_elements(coalesce(v_policy->'presentationRules', '[]'::jsonb))
    LOOP
      v_minimum := (v_rule->>'min')::integer;
      v_maximum := (v_rule->>'max')::integer;
      v_label := format('%s: %s', v_rule->>'category', array_to_string(ARRAY(SELECT jsonb_array_elements_text(v_rule->'formats')), ' or '));
      SELECT count(question.id)::integer INTO v_actual
      FROM public.question_sets_ucat_mocks mock_member
      JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_member.question_set_id
      JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
      JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
      JOIN public.ucat_sections section ON section.id = stem.section_id
      JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
      WHERE mock_member.ucat_mock_id = p_mock_id AND category.name = v_rule->>'category'
        AND stem.presentation_format::text IN (SELECT jsonb_array_elements_text(v_rule->'formats'))
        AND CASE section.section_number WHEN 1 THEN 'verbal_reasoning' WHEN 2 THEN 'decision_making' WHEN 3 THEN 'quantitative_reasoning' WHEN 4 THEN 'situational_judgement' END = v_section.section_code;
      v_check_compliant := v_actual BETWEEN v_minimum AND v_maximum;
      v_checks := v_checks || jsonb_build_array(jsonb_build_object(
        'code', 'PRESENTATION_COUNT_OUT_OF_RANGE', 'label', v_label, 'unit', 'questions',
        'minimum', v_minimum, 'maximum', v_maximum, 'actual', v_actual, 'compliant', v_check_compliant,
        'reason', format('Allowed %s–%s; found %s.', v_minimum, v_maximum, v_actual)
      ));
      IF NOT v_check_compliant THEN v_compliant := false; END IF;
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
$$;

REVOKE ALL ON FUNCTION public.ucat_mock_blueprint_compliance(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ucat_mock_blueprint_compliance(UUID) TO authenticated;

ALTER FUNCTION public.ucat_content_publication_issues(TEXT, UUID)
  RENAME TO ucat_content_before_mock_blueprint_issues;

CREATE FUNCTION public.ucat_content_publication_issues(p_content_type TEXT, p_content_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues JSONB;
  v_compliance JSONB;
BEGIN
  v_issues := public.ucat_content_before_mock_blueprint_issues(p_content_type, p_content_id);
  IF p_content_type = 'mock' THEN
    v_compliance := public.ucat_mock_blueprint_compliance(p_content_id);
    IF (v_compliance->>'applicable')::boolean AND NOT (v_compliance->>'compliant')::boolean THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'blueprint_noncompliant',
        'message', 'The mock does not satisfy its selected full-mock blueprint.',
        'compliance', v_compliance
      ));
    END IF;
  END IF;
  RETURN v_issues;
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_content_before_mock_blueprint_issues(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ucat_content_publication_issues(TEXT, UUID) TO authenticated;

CREATE FUNCTION public.tutor_ucat_upsert_mock(
  p_mock_id UUID,
  p_name TEXT,
  p_access_scope public.ucat_access_scope,
  p_set_ids JSONB,
  p_instructions_text JSONB,
  p_blueprint_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mock_id UUID;
  v_status public.ucat_content_status;
  v_issues JSONB;
BEGIN
  v_mock_id := public.tutor_ucat_upsert_mock(
    p_mock_id, p_name, p_access_scope, p_set_ids, p_instructions_text
  );
  IF p_blueprint_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ucat_mock_blueprints WHERE id = p_blueprint_id
  ) THEN RAISE EXCEPTION 'mock_blueprint_not_found'; END IF;
  UPDATE public.ucat_mocks SET blueprint_id = p_blueprint_id WHERE id = v_mock_id
  RETURNING status INTO v_status;
  IF v_status = 'published' THEN
    v_issues := public.ucat_content_publication_issues('mock', v_mock_id);
    IF jsonb_array_length(v_issues) > 0 THEN RAISE EXCEPTION 'published_content_invalid:%', v_issues::text; END IF;
  END IF;
  RETURN v_mock_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_mock(UUID, TEXT, public.ucat_access_scope, JSONB, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_mock(UUID, TEXT, public.ucat_access_scope, JSONB, JSONB, UUID) TO authenticated;

CREATE OR REPLACE VIEW public.vtutor_ucat_mocks AS
SELECT
  mock.id, mock.name, mock.status, mock.access_scope, mock.status_changed_at, mock.status_changed_by,
  mock.created_at, mock.updated_at, mock.created_by, mock.updated_by, mock.deleted_at, mock.deleted_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  (SELECT count(*)::integer FROM public.question_sets_ucat_mocks member WHERE member.ucat_mock_id = mock.id) AS set_count,
  public.ucat_content_publication_issues('mock', mock.id) AS publication_issues,
  mock.blueprint_id,
  public.ucat_mock_blueprint_compliance(mock.id) AS blueprint_compliance
FROM public.ucat_mocks mock
LEFT JOIN public.staff created_staff ON created_staff.id = mock.created_by
WHERE public.is_ucat_tutor();

CREATE OR REPLACE VIEW public.vtutor_ucat_mock_detail AS
SELECT
  mock.id, mock.name, mock.status, mock.access_scope, mock.status_changed_at, mock.status_changed_by,
  mock.instructions_text, mock.created_at, mock.updated_at, mock.created_by, mock.updated_by,
  mock.deleted_at, mock.deleted_by,
  public.ucat_content_publication_issues('mock', mock.id) AS publication_issues,
  (
    SELECT json_agg(json_build_object(
      'id', question_set.id, 'name', question_set.name, 'description', question_set.description,
      'time_limit_seconds', question_set.time_limit_seconds, 'sections', question_set.sections,
      'question_count', question_set.question_count, 'status', question_set.status,
      'access_scope', question_set.access_scope
    ) ORDER BY member.index)
    FROM public.question_sets_ucat_mocks member
    JOIN public.vtutor_ucat_question_sets question_set ON question_set.id = member.question_set_id
    WHERE member.ucat_mock_id = mock.id
  ) AS sets,
  mock.blueprint_id,
  public.ucat_mock_blueprint_compliance(mock.id) AS blueprint_compliance
FROM public.ucat_mocks mock
WHERE public.is_ucat_tutor();

CREATE OR REPLACE VIEW public.vtutor_ucat_question_sets AS
SELECT
  question_set.id, question_set.name, question_set.description, question_set.time_limit_seconds,
  question_set.status, question_set.access_scope,
  (question_set.status = 'published' AND question_set.access_scope = 'public' AND NOT EXISTS (
    SELECT 1 FROM public.question_sets_ucat_mocks pool_member
    JOIN public.ucat_mocks pool_parent ON pool_parent.id = pool_member.ucat_mock_id
    WHERE pool_member.question_set_id = question_set.id AND pool_parent.deleted_at IS NULL AND pool_parent.status = 'published'
  )) AS is_available_in_sets_pool,
  question_set.status_changed_at, question_set.status_changed_by, question_set.sections,
  question_set.time_limit_at_exam_speed_seconds, question_set.speed,
  question_set.created_at, question_set.updated_at, question_set.created_by, question_set.updated_by,
  question_set.deleted_at, question_set.deleted_by,
  created_staff.first_name AS created_by_first_name, created_staff.last_name AS created_by_last_name,
  (SELECT count(*)::integer FROM public.question_stems_question_sets member WHERE member.question_set_id = question_set.id) AS stem_count,
  (SELECT count(*)::integer FROM public.ucat_questions question JOIN public.question_stems_question_sets member ON member.question_stem_id = question.question_stem_id WHERE member.question_set_id = question_set.id AND question.deleted_at IS NULL) AS question_count,
  (SELECT coalesce(jsonb_agg(member.ucat_mock_id ORDER BY member.index NULLS LAST, member.ucat_mock_id), '[]'::jsonb) FROM public.question_sets_ucat_mocks member JOIN public.ucat_mocks parent ON parent.id = member.ucat_mock_id AND parent.deleted_at IS NULL WHERE member.question_set_id = question_set.id) AS ucat_mock_ids,
  public.ucat_content_publication_issues('set', question_set.id) AS publication_issues,
  (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'mockId', parent.id, 'mockName', parent.name, 'compliance', public.ucat_mock_blueprint_compliance(parent.id)
  ) ORDER BY parent.name, parent.id), '[]'::jsonb)
  FROM public.question_sets_ucat_mocks member
  JOIN public.ucat_mocks parent ON parent.id = member.ucat_mock_id AND parent.deleted_at IS NULL
  WHERE member.question_set_id = question_set.id AND parent.blueprint_id IS NOT NULL) AS linked_mock_blueprint_compliance
FROM public.question_sets question_set
LEFT JOIN public.staff created_staff ON created_staff.id = question_set.created_by
WHERE public.is_ucat_tutor();

-- Blueprint construction needs the independent presentation axis.
CREATE OR REPLACE VIEW public.vtutor_ucat_question_stem_detail AS
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
  ) AS questions,
  stem.presentation_format
FROM public.question_stems stem
JOIN public.ucat_sections section ON section.id = stem.section_id
LEFT JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_mocks TO authenticated;
GRANT SELECT ON public.vtutor_ucat_mock_detail TO authenticated;
GRANT SELECT ON public.vtutor_ucat_question_sets TO authenticated;
