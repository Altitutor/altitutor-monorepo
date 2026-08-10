-- Existing mocks stay unversioned. Tutors may attach an immutable blueprint
-- only through a durable, read-only candidate audit and confirmation.

CREATE TYPE public.ucat_mock_blueprint_audit_decision AS ENUM (
  'eligible',
  'provisional',
  'failed',
  'attached'
);

CREATE TABLE public.ucat_mock_blueprint_eligibility_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_id UUID NOT NULL REFERENCES public.ucat_mocks(id) ON DELETE RESTRICT,
  blueprint_id UUID NOT NULL REFERENCES public.ucat_mock_blueprints(id) ON DELETE RESTRICT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  checked_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  gate_results JSONB NOT NULL CHECK (jsonb_typeof(gate_results) = 'object'),
  decision public.ucat_mock_blueprint_audit_decision NOT NULL,
  attached_at TIMESTAMPTZ,
  attached_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT ucat_mock_blueprint_audit_attachment_consistent CHECK (
    (decision = 'attached' AND attached_at IS NOT NULL AND attached_by IS NOT NULL)
    OR (decision <> 'attached' AND attached_at IS NULL AND attached_by IS NULL)
  )
);

CREATE INDEX idx_ucat_mock_blueprint_audits_mock_checked
  ON public.ucat_mock_blueprint_eligibility_audits(mock_id, checked_at DESC, id DESC);

COMMENT ON TABLE public.ucat_mock_blueprint_eligibility_audits IS
  'Immutable candidate snapshots plus an explicit attached decision. Auditing never retimes, recomposes, recategorises, publishes, or attaches a mock.';

ALTER TABLE public.ucat_mock_blueprint_eligibility_audits ENABLE ROW LEVEL SECURITY;

-- Reuse the canonical ALTI-542 evaluator for an explicitly supplied candidate.
-- The source function is cloned at migration time so every structural,
-- category, presentation, response-contract, timing and SJT gate stays in one
-- canonical implementation.
DO $$
DECLARE
  v_definition TEXT;
BEGIN
  SELECT pg_get_functiondef('public.ucat_mock_blueprint_compliance(uuid)'::regprocedure)
  INTO v_definition;

  v_definition := replace(
    v_definition,
    'public.ucat_mock_blueprint_compliance(p_mock_id uuid)',
    'public.ucat_mock_blueprint_candidate_compliance(p_mock_id uuid, p_blueprint_id uuid)'
  );
  v_definition := replace(
    v_definition,
    'JOIN public.ucat_mock_blueprints blueprint ON blueprint.id = mock.blueprint_id',
    'JOIN public.ucat_mock_blueprints blueprint ON blueprint.id = p_blueprint_id'
  );
  EXECUTE v_definition;
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_mock_blueprint_candidate_compliance(UUID, UUID)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.tutor_ucat_audit_mock_blueprint(
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
  v_missing_iidc_presentation INTEGER;
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

  SELECT
    count(DISTINCT stem.id) FILTER (WHERE section.section_number = 2 AND stem.question_stem_category_id IS NULL)::integer,
    count(DISTINCT stem.id) FILTER (
      WHERE section.section_number = 2
        AND category.name = 'Interpreting Information and Drawing Conclusions'
        AND stem.presentation_format IS NULL
    )::integer
  INTO v_unclassified_dm, v_missing_iidc_presentation
  FROM public.question_sets_ucat_mocks mock_member
  JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_member.question_set_id
  JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
  JOIN public.ucat_sections section ON section.id = stem.section_id
  LEFT JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
  WHERE mock_member.ucat_mock_id = p_mock_id;

  v_provisional := jsonb_build_object(
    'reviewed', coalesce(v_unclassified_dm, 0) = 0 AND coalesce(v_missing_iidc_presentation, 0) = 0,
    'unclassifiedDecisionMakingStemCount', coalesce(v_unclassified_dm, 0),
    'missingIidcPresentationStemCount', coalesce(v_missing_iidc_presentation, 0),
    'reason', CASE WHEN coalesce(v_unclassified_dm, 0) = 0 AND coalesce(v_missing_iidc_presentation, 0) = 0
      THEN 'Required Decision Making category and presentation metadata has been reviewed.'
      ELSE format('%s Decision Making stems need classification and %s IIDC stems need presentation metadata.',
        coalesce(v_unclassified_dm, 0), coalesce(v_missing_iidc_presentation, 0)) END
  );

  SELECT coalesce(bool_and((check_item->>'compliant')::boolean), true)
  INTO v_non_metadata_compliant
  FROM jsonb_array_elements(v_compliance->'sections') section_item
  CROSS JOIN LATERAL jsonb_array_elements(section_item->'checks') check_item
  WHERE check_item->>'code' NOT IN ('CATEGORY_COUNT_OUT_OF_RANGE', 'PRESENTATION_COUNT_OUT_OF_RANGE');

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

REVOKE ALL ON FUNCTION public.tutor_ucat_audit_mock_blueprint(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_audit_mock_blueprint(UUID, UUID) TO authenticated;

CREATE FUNCTION public.tutor_ucat_confirm_mock_blueprint_audit(p_audit_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate public.ucat_mock_blueprint_eligibility_audits%ROWTYPE;
  v_recheck_id UUID;
  v_recheck_decision public.ucat_mock_blueprint_audit_decision;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_candidate FROM public.ucat_mock_blueprint_eligibility_audits
  WHERE id = p_audit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mock_blueprint_audit_not_found'; END IF;
  IF v_candidate.decision <> 'eligible' THEN RAISE EXCEPTION 'mock_blueprint_audit_not_eligible'; END IF;

  -- Re-run every live gate immediately before attachment. The new snapshot
  -- preserves what was actually confirmed if shared content changed meanwhile.
  v_recheck_id := public.tutor_ucat_audit_mock_blueprint(v_candidate.mock_id, v_candidate.blueprint_id);
  SELECT decision INTO v_recheck_decision
  FROM public.ucat_mock_blueprint_eligibility_audits WHERE id = v_recheck_id FOR UPDATE;
  IF v_recheck_decision <> 'eligible' THEN RAISE EXCEPTION 'mock_blueprint_audit_not_eligible'; END IF;

  UPDATE public.ucat_mocks
  SET blueprint_id = v_candidate.blueprint_id, updated_at = now(), updated_by = auth.uid()
  WHERE id = v_candidate.mock_id AND deleted_at IS NULL;

  UPDATE public.ucat_mock_blueprint_eligibility_audits
  SET decision = 'attached', attached_at = clock_timestamp(), attached_by = auth.uid()
  WHERE id = v_recheck_id;
  RETURN v_recheck_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_confirm_mock_blueprint_audit(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_confirm_mock_blueprint_audit(UUID) TO authenticated;

-- The ordinary editor may preserve an existing attachment, but selection and
-- replacement must pass through the audited confirmation RPC above.
ALTER FUNCTION public.tutor_ucat_upsert_mock(
  UUID, TEXT, public.ucat_access_scope, JSONB, JSONB, UUID
) RENAME TO tutor_ucat_upsert_mock_before_eligibility_audit;

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
  v_existing_blueprint_id UUID;
BEGIN
  SELECT blueprint_id INTO v_existing_blueprint_id FROM public.ucat_mocks WHERE id = p_mock_id;
  IF p_blueprint_id IS DISTINCT FROM v_existing_blueprint_id THEN
    RAISE EXCEPTION 'mock_blueprint_requires_eligible_audit';
  END IF;
  RETURN public.tutor_ucat_upsert_mock_before_eligibility_audit(
    p_mock_id, p_name, p_access_scope, p_set_ids, p_instructions_text, p_blueprint_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_mock_before_eligibility_audit(
  UUID, TEXT, public.ucat_access_scope, JSONB, JSONB, UUID
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_mock(
  UUID, TEXT, public.ucat_access_scope, JSONB, JSONB, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_mock(
  UUID, TEXT, public.ucat_access_scope, JSONB, JSONB, UUID
) TO authenticated;

CREATE VIEW public.vtutor_ucat_mock_blueprint_audits AS
SELECT
  audit.id,
  audit.mock_id,
  audit.blueprint_id,
  blueprint.code AS blueprint_code,
  blueprint.test_year,
  blueprint.version,
  audit.checked_at,
  audit.checked_by,
  audit.gate_results,
  audit.decision,
  audit.attached_at,
  audit.attached_by
FROM public.ucat_mock_blueprint_eligibility_audits audit
JOIN public.ucat_mock_blueprints blueprint ON blueprint.id = audit.blueprint_id
WHERE public.is_ucat_tutor();

GRANT SELECT ON public.vtutor_ucat_mock_blueprint_audits TO authenticated;
