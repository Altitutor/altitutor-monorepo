-- Bulk import chooses a lifecycle destination independently for each stem.
-- The API verifies the shared UCAT readiness policy before requesting in_review;
-- draft remains available for any structurally storable bundle.

CREATE OR REPLACE FUNCTION public.tutor_ucat_bulk_upsert_question_stem_bundles(
  p_section_id UUID,
  p_stems JSONB
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result_ids UUID[] := ARRAY[]::UUID[];
  v_stem JSONB;
  v_stem_id UUID;
  v_staff_id UUID;
  v_import_status_text TEXT;
  v_import_status public.ucat_content_status;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_stems IS NULL OR jsonb_typeof(p_stems) <> 'array' THEN RAISE EXCEPTION 'invalid_stems_payload'; END IF;
  v_staff_id := public.current_tutor_id();

  FOR v_stem IN SELECT * FROM jsonb_array_elements(p_stems)
  LOOP
    v_import_status_text := COALESCE(NULLIF(v_stem->>'importStatus', ''), 'in_review');
    IF v_import_status_text NOT IN ('draft', 'in_review') THEN
      RAISE EXCEPTION 'invalid_bulk_import_status';
    END IF;
    v_import_status := v_import_status_text::public.ucat_content_status;

    v_stem_id := public.tutor_ucat_upsert_question_stem_bundle(
      NULLIF(v_stem->>'stemId', '')::UUID,
      COALESCE(NULLIF(v_stem->>'sectionId', '')::UUID, p_section_id),
      NULLIF(v_stem->>'categoryId', '')::UUID,
      COALESCE(v_stem->'stemText', '{}'::jsonb),
      COALESCE(NULLIF(v_stem->>'accessScope', '')::public.ucat_access_scope, 'public'),
      COALESCE(v_stem->'questions', '[]'::jsonb),
      COALESCE(NULLIF(v_stem->>'sourceChannel', '')::public.ucat_question_source_channel, 'bulk_import'),
      v_stem->>'tutorSourceNote'
    );

    UPDATE public.question_stems
    SET status = v_import_status,
        status_changed_at = NOW(),
        status_changed_by = v_staff_id,
        updated_by = v_staff_id
    WHERE id = v_stem_id;

    v_result_ids := array_append(v_result_ids, v_stem_id);
  END LOOP;
  RETURN v_result_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_bulk_upsert_question_stem_bundles(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_bulk_upsert_question_stem_bundles(UUID, JSONB) TO authenticated;

-- Background assessment workers have no interactive auth.uid(), so they need a
-- narrowly scoped service-role entry point. It verifies the current assessment
-- run and exact stem revision, attributes the write to the originating staff
-- member, preserves lifecycle state, and records the same recoverable content
-- change used by interactive UCAT maintenance.
CREATE OR REPLACE FUNCTION public.service_ucat_apply_verified_assessment_repair(
  p_run_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_base_snapshot JSONB,
  p_proposed_snapshot JSONB,
  p_operations JSONB,
  p_summary TEXT,
  p_rationale TEXT,
  p_finding_refs JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run RECORD;
  v_stem RECORD;
  v_actor_staff_id UUID;
  v_actor_user_id UUID;
  v_after_updated_at TIMESTAMPTZ;
  v_after_status public.ucat_content_status;
  v_change_id UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  SELECT
    run.id,
    run.stem_id,
    run.status AS run_status,
    run.requested_by,
    cycle.started_by,
    cycle.is_current
  INTO v_run
  FROM public.ucat_ai_question_assessment_runs run
  JOIN public.ucat_ai_question_assessment_cycles cycle ON cycle.id = run.cycle_id
  WHERE run.id = p_run_id;

  IF NOT FOUND
    OR v_run.run_status IS DISTINCT FROM 'running'
    OR v_run.is_current IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'assessment_repair_run_not_current';
  END IF;

  SELECT id, status, updated_at, updated_by, created_by
  INTO v_stem
  FROM public.question_stems
  WHERE id = v_run.stem_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'question_stem_not_found'; END IF;
  IF v_stem.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'assessment_repair_stale_revision';
  END IF;

  v_actor_staff_id := COALESCE(
    v_run.requested_by,
    v_run.started_by,
    v_stem.updated_by,
    v_stem.created_by
  );
  SELECT user_id INTO v_actor_user_id
  FROM public.staff
  WHERE id = v_actor_staff_id AND status = 'ACTIVE';
  IF v_actor_user_id IS NULL THEN RAISE EXCEPTION 'assessment_repair_actor_unavailable'; END IF;

  PERFORM set_config('request.jwt.claim.sub', v_actor_user_id::TEXT, TRUE);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_actor_user_id::TEXT, 'role', 'authenticated')::TEXT,
    TRUE
  );
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'assessment_repair_actor_forbidden'; END IF;

  PERFORM public.tutor_ucat_upsert_question_stem_bundle(
    v_run.stem_id,
    (p_proposed_snapshot->>'sectionId')::UUID,
    NULLIF(p_proposed_snapshot->>'categoryId', '')::UUID,
    COALESCE(p_proposed_snapshot->'stemText', '{}'::JSONB),
    COALESCE((p_proposed_snapshot->>'accessScope')::public.ucat_access_scope, 'public'),
    COALESCE(p_proposed_snapshot->'questions', '[]'::JSONB),
    'ai_generation',
    p_proposed_snapshot->>'tutorSourceNote'
  );

  SELECT status, updated_at INTO v_after_status, v_after_updated_at
  FROM public.question_stems WHERE id = v_run.stem_id;
  IF v_after_status IS DISTINCT FROM v_stem.status THEN
    RAISE EXCEPTION 'assessment_repair_changed_lifecycle';
  END IF;

  INSERT INTO public.ucat_mcp_content_changes (
    target_type,
    target_id,
    status,
    source,
    base_revision,
    resulting_revision,
    base_snapshot,
    proposed_snapshot,
    operations,
    summary,
    rationale,
    finding_refs,
    created_by,
    applied_by,
    applied_at
  ) VALUES (
    'stem',
    v_run.stem_id,
    'applied',
    'assessment',
    public.ucat_mcp_authoring_revision(v_run.stem_id, p_expected_updated_at),
    public.ucat_mcp_authoring_revision(v_run.stem_id, v_after_updated_at),
    p_base_snapshot,
    p_proposed_snapshot,
    COALESCE(p_operations, '[]'::JSONB),
    BTRIM(p_summary),
    NULLIF(BTRIM(COALESCE(p_rationale, '')), ''),
    COALESCE(p_finding_refs, '[]'::JSONB),
    v_actor_staff_id,
    v_actor_staff_id,
    NOW()
  ) RETURNING id INTO v_change_id;

  PERFORM public.ucat_mcp_record_activity(
    'question_stems',
    v_run.stem_id,
    'UPDATED',
    'apply_verified_question_ai_assessment_repair',
    p_expected_updated_at,
    v_after_updated_at,
    COALESCE(p_operations, '[]'::JSONB)
  );

  RETURN jsonb_build_object(
    'id', v_run.stem_id,
    'changeId', v_change_id,
    'status', v_after_status,
    'updatedAt', v_after_updated_at,
    'revision', public.ucat_mcp_authoring_revision(v_run.stem_id, v_after_updated_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.service_ucat_apply_verified_assessment_repair(
  UUID, TIMESTAMPTZ, JSONB, JSONB, JSONB, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_ucat_apply_verified_assessment_repair(
  UUID, TIMESTAMPTZ, JSONB, JSONB, JSONB, TEXT, TEXT, JSONB
) TO service_role;

-- Exact-revision variant used by long-lived editor forms so a background repair
-- cannot be silently overwritten by a form opened on an older revision.
CREATE OR REPLACE FUNCTION public.tutor_ucat_update_question_stem_bundle_revisioned(
  p_stem_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_section_id UUID,
  p_question_stem_category_id UUID,
  p_stem_text JSONB,
  p_access_scope public.ucat_access_scope,
  p_questions JSONB,
  p_source_channel public.ucat_question_source_channel,
  p_tutor_source_note TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_updated_at TIMESTAMPTZ;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT updated_at INTO v_current_updated_at
  FROM public.question_stems
  WHERE id = p_stem_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'question_stem_not_found'; END IF;
  IF p_expected_updated_at IS NULL
    OR v_current_updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'question_stem_stale_revision';
  END IF;
  RETURN public.tutor_ucat_upsert_question_stem_bundle(
    p_stem_id,
    p_section_id,
    p_question_stem_category_id,
    p_stem_text,
    p_access_scope,
    p_questions,
    p_source_channel,
    p_tutor_source_note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_update_question_stem_bundle_revisioned(
  UUID, TIMESTAMPTZ, UUID, UUID, JSONB, public.ucat_access_scope, JSONB,
  public.ucat_question_source_channel, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_update_question_stem_bundle_revisioned(
  UUID, TIMESTAMPTZ, UUID, UUID, JSONB, public.ucat_access_scope, JSONB,
  public.ucat_question_source_channel, TEXT
) TO authenticated;
