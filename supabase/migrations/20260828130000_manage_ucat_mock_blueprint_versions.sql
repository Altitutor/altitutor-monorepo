-- Tutor-managed UCAT blueprint versions. Historical versions remain immutable;
-- the guarded tutor API calls this service-role-only function to create a new
-- version atomically.

CREATE FUNCTION public.tutor_ucat_create_mock_blueprint_version(
  p_source_blueprint_id UUID,
  p_test_year INTEGER,
  p_official_facts_label TEXT,
  p_altitutor_policy_label TEXT,
  p_sections JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blueprint_id UUID := gen_random_uuid();
  v_version INTEGER;
  v_section JSONB;
  v_rule JSONB;
  v_section_code TEXT;
  v_section_number INTEGER;
  v_category_id UUID;
  v_category_name TEXT;
  v_category_rules JSONB;
  v_source_policy JSONB;
BEGIN
  IF p_test_year < 2026 THEN
    RAISE EXCEPTION 'mock_blueprint_test_year_invalid';
  END IF;
  IF NULLIF(btrim(p_official_facts_label), '') IS NULL
     OR NULLIF(btrim(p_altitutor_policy_label), '') IS NULL THEN
    RAISE EXCEPTION 'mock_blueprint_labels_required';
  END IF;
  IF COALESCE(jsonb_typeof(p_sections), 'null') <> 'array' OR jsonb_array_length(p_sections) <> 4 THEN
    RAISE EXCEPTION 'mock_blueprint_requires_four_sections';
  END IF;
  IF p_source_blueprint_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.ucat_mock_blueprints
    WHERE id = p_source_blueprint_id AND test_year = p_test_year
  ) THEN
    RAISE EXCEPTION 'mock_blueprint_source_not_found_for_year';
  END IF;

  -- Serialize version allocation per test year.
  PERFORM pg_advisory_xact_lock(20874, p_test_year);
  SELECT COALESCE(max(version), 0) + 1
  INTO v_version
  FROM public.ucat_mock_blueprints
  WHERE test_year = p_test_year;

  INSERT INTO public.ucat_mock_blueprints (
    id, code, test_year, version, official_facts_label, altitutor_policy_label
  ) VALUES (
    v_blueprint_id,
    format('ucat-anz-%s-v%s', p_test_year, v_version),
    p_test_year,
    v_version,
    btrim(p_official_facts_label),
    btrim(p_altitutor_policy_label)
  );

  FOR v_section IN SELECT value FROM jsonb_array_elements(p_sections)
  LOOP
    v_section_code := v_section->>'section';
    v_section_number := CASE v_section_code
      WHEN 'verbal_reasoning' THEN 1
      WHEN 'decision_making' THEN 2
      WHEN 'quantitative_reasoning' THEN 3
      WHEN 'situational_judgement' THEN 4
      ELSE NULL
    END;
    IF v_section_number IS NULL THEN
      RAISE EXCEPTION 'mock_blueprint_section_invalid:%', v_section_code;
    END IF;
    IF (v_section->>'sectionIndex')::INTEGER <> v_section_number - 1 THEN
      RAISE EXCEPTION 'mock_blueprint_section_order_invalid:%', v_section_code;
    END IF;
    IF (v_section->>'exactQuestionCount')::INTEGER <= 0
       OR (v_section->>'answeringTimeSeconds')::INTEGER <= 0
       OR (v_section->>'instructionTimeSeconds')::INTEGER <= 0 THEN
      RAISE EXCEPTION 'mock_blueprint_section_values_invalid:%', v_section_code;
    END IF;

    v_category_rules := '[]'::JSONB;
    FOR v_rule IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(v_section->'categoryRules', '[]'::JSONB))
    LOOP
      IF COALESCE((v_rule->>'min')::INTEGER, -1) < 0
         OR COALESCE((v_rule->>'max')::INTEGER, -1) < COALESCE((v_rule->>'min')::INTEGER, -1)
         OR (
           v_rule ? 'preferred'
           AND (
             (v_rule->>'preferred')::INTEGER < (v_rule->>'min')::INTEGER
             OR (v_rule->>'preferred')::INTEGER > (v_rule->>'max')::INTEGER
           )
         ) THEN
        RAISE EXCEPTION 'mock_blueprint_category_range_invalid:%', v_section_code;
      END IF;
      IF v_rule->>'unit' NOT IN ('questions', 'stems') THEN
        RAISE EXCEPTION 'mock_blueprint_category_unit_invalid:%', v_section_code;
      END IF;

      IF v_rule ? 'categoryId' THEN
        v_category_id := (v_rule->>'categoryId')::UUID;
        SELECT category.name
        INTO v_category_name
        FROM public.question_stem_categories category
        JOIN public.ucat_sections section ON section.id = category.ucat_section_id
        WHERE category.id = v_category_id
          AND section.section_number = v_section_number;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'mock_blueprint_category_invalid_for_section:%', v_category_id;
        END IF;
        v_rule := (v_rule - 'category') || jsonb_build_object(
          'categoryId', v_category_id,
          'category', v_category_name
        );
      ELSIF v_rule ? 'answerScheme' THEN
        IF v_section_code <> 'situational_judgement'
           OR v_rule->>'answerScheme' <> 'situational_judgement_rating'
           OR NULLIF(btrim(v_rule->>'label'), '') IS NULL THEN
          RAISE EXCEPTION 'mock_blueprint_system_rule_invalid:%', v_section_code;
        END IF;
      ELSE
        RAISE EXCEPTION 'mock_blueprint_category_or_system_rule_required:%', v_section_code;
      END IF;
      v_category_rules := v_category_rules || jsonb_build_array(v_rule);
    END LOOP;

    SELECT section.altitutor_composition_policy
    INTO v_source_policy
    FROM public.ucat_mock_blueprint_sections section
    WHERE section.blueprint_id = p_source_blueprint_id
      AND section.section_code = v_section_code;
    v_source_policy := COALESCE(v_source_policy, '{}'::JSONB) - 'categoryRules';

    INSERT INTO public.ucat_mock_blueprint_sections (
      blueprint_id,
      section_code,
      section_index,
      exact_question_count,
      answering_time_seconds,
      instruction_time_seconds,
      altitutor_composition_policy
    ) VALUES (
      v_blueprint_id,
      v_section_code,
      (v_section->>'sectionIndex')::INTEGER,
      (v_section->>'exactQuestionCount')::INTEGER,
      (v_section->>'answeringTimeSeconds')::INTEGER,
      (v_section->>'instructionTimeSeconds')::INTEGER,
      v_source_policy || jsonb_build_object('categoryRules', v_category_rules)
    );
  END LOOP;

  IF (
    SELECT count(DISTINCT section_code)
    FROM public.ucat_mock_blueprint_sections
    WHERE blueprint_id = v_blueprint_id
  ) <> 4 THEN
    RAISE EXCEPTION 'mock_blueprint_sections_must_be_unique';
  END IF;

  RETURN v_blueprint_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_create_mock_blueprint_version(
  UUID, INTEGER, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_create_mock_blueprint_version(
  UUID, INTEGER, TEXT, TEXT, JSONB
) TO service_role;

COMMENT ON FUNCTION public.tutor_ucat_create_mock_blueprint_version(
  UUID, INTEGER, TEXT, TEXT, JSONB
) IS 'Creates the next immutable UCAT mock blueprint version. When a source is supplied, advanced rules are copied while editable category rules and official section facts are replaced.';

-- A new draft has no historical blueprint attachment to protect, so its target
-- blueprint can be selected during creation. Changing the blueprint on an
-- existing mock continues to require the durable eligibility-audit workflow.
CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_mock(
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
  v_existing_blueprint_id UUID;
BEGIN
  IF p_mock_id IS NULL THEN
    RETURN public.tutor_ucat_upsert_mock_before_eligibility_audit(
      NULL, p_name, p_access_scope, p_set_ids, p_instructions_text, p_blueprint_id
    );
  END IF;

  SELECT blueprint_id
  INTO v_existing_blueprint_id
  FROM public.ucat_mocks
  WHERE id = p_mock_id;

  IF p_blueprint_id IS DISTINCT FROM v_existing_blueprint_id THEN
    RAISE EXCEPTION 'mock_blueprint_requires_eligible_audit';
  END IF;

  RETURN public.tutor_ucat_upsert_mock_before_eligibility_audit(
    p_mock_id, p_name, p_access_scope, p_set_ids, p_instructions_text, p_blueprint_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_mock(
  UUID, TEXT, public.ucat_access_scope, JSONB, JSONB, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_mock(
  UUID, TEXT, public.ucat_access_scope, JSONB, JSONB, UUID
) TO authenticated;
