-- A mock's blueprint defines four composition slots, but those slots are not
-- persisted as placeholder sets. Tutors attach or create component sets later.

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_mock_v2(
  p_mock_id UUID,
  p_authoring_note TEXT,
  p_access_scope public.ucat_access_scope,
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
  v_staff_id UUID;
  v_status public.ucat_content_status;
  v_existing_blueprint_id UUID;
  v_next_index INTEGER;
  v_issues JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_blueprint_id IS NULL THEN RAISE EXCEPTION 'mock_blueprint_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ucat_mock_blueprints WHERE id = p_blueprint_id) THEN
    RAISE EXCEPTION 'mock_blueprint_not_found';
  END IF;
  v_staff_id := public.current_tutor_id();

  IF p_mock_id IS NULL THEN
    PERFORM pg_advisory_xact_lock(20875, 1);
    SELECT COALESCE(max(catalog_index), 0) + 1 INTO v_next_index
    FROM public.ucat_mocks WHERE deleted_at IS NULL;

    INSERT INTO public.ucat_mocks (
      name, authoring_note, catalog_index, access_scope, status,
      instructions_text, blueprint_id, created_by, updated_by
    ) VALUES (
      '', NULLIF(BTRIM(p_authoring_note), ''), v_next_index,
      COALESCE(p_access_scope, 'public'), 'draft', p_instructions_text,
      p_blueprint_id, v_staff_id, v_staff_id
    ) RETURNING id, status INTO v_mock_id, v_status;
  ELSE
    SELECT blueprint_id, status INTO v_existing_blueprint_id, v_status
    FROM public.ucat_mocks
    WHERE id = p_mock_id AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'mock_not_found'; END IF;
    IF p_blueprint_id IS DISTINCT FROM v_existing_blueprint_id THEN
      RAISE EXCEPTION 'mock_blueprint_requires_eligible_audit';
    END IF;

    UPDATE public.ucat_mocks
    SET authoring_note = NULLIF(BTRIM(p_authoring_note), ''),
        access_scope = COALESCE(p_access_scope, 'public'),
        instructions_text = p_instructions_text,
        updated_by = v_staff_id
    WHERE id = p_mock_id
    RETURNING id INTO v_mock_id;

    UPDATE public.question_sets
    SET access_scope = COALESCE(p_access_scope, 'public'), updated_by = v_staff_id
    WHERE mock_id = v_mock_id;
  END IF;

  IF v_status = 'published' THEN
    v_issues := public.ucat_content_publication_issues('mock', v_mock_id);
    IF jsonb_array_length(v_issues) > 0 THEN
      RAISE EXCEPTION 'published_content_invalid:%', v_issues::TEXT;
    END IF;
  END IF;
  RETURN v_mock_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_mock_v2(
  UUID, TEXT, public.ucat_access_scope, JSONB, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_mock_v2(
  UUID, TEXT, public.ucat_access_scope, JSONB, UUID
) TO authenticated;

COMMENT ON FUNCTION public.tutor_ucat_upsert_mock_v2(
  UUID, TEXT, public.ucat_access_scope, JSONB, UUID
) IS 'Creates or updates a UCAT mock without materializing blueprint slots as empty component sets.';
