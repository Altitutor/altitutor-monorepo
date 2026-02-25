-- ========================
-- UCAT: RPC to replace session resources in one go (for Edit Class Sessions)
-- Tutor can set resources for multiple sessions; all must belong to their UCAT classes.
-- ========================

-- p_assignments: JSONB array of { "session_id": "uuid", "resources": [ { "resource_type": "set"|"mock", "resource_id": "uuid", "index": 0 } ] }
CREATE OR REPLACE FUNCTION public.tutor_ucat_replace_sessions_resources(p_assignments JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
  v_ucat_subject_id UUID;
  v_assignments_elem JSONB;
  v_session_id UUID;
  v_resources JSONB;
  v_resource JSONB;
  v_idx INT;
  v_question_set_id UUID;
  v_ucat_mock_id UUID;
  v_allowed_sessions UUID[];
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_staff_id := public.current_tutor_id();
  SELECT id INTO v_ucat_subject_id FROM public.subjects WHERE name = 'UCAT' LIMIT 1;

  -- Allowed session IDs: sessions whose class is a UCAT class the tutor is assigned to
  SELECT ARRAY_AGG(s.id)
  INTO v_allowed_sessions
  FROM public.sessions s
  JOIN public.classes c ON c.id = s.class_id
  JOIN public.classes_staff cs ON cs.class_id = c.id AND cs.unassigned_at IS NULL
  WHERE c.subject_id = v_ucat_subject_id
    AND cs.staff_id = v_staff_id;

  IF v_allowed_sessions IS NULL THEN
    v_allowed_sessions := ARRAY[]::UUID[];
  END IF;

  FOR v_assignments_elem IN SELECT * FROM jsonb_array_elements(COALESCE(p_assignments, '[]'::jsonb))
  LOOP
    v_session_id := (v_assignments_elem->>'session_id')::UUID;
    IF v_session_id IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT (v_session_id = ANY(v_allowed_sessions)) THEN
      RAISE EXCEPTION 'forbidden: session not in your UCAT classes';
    END IF;

    DELETE FROM public.ucat_sessions_resources WHERE session_id = v_session_id;

    v_resources := v_assignments_elem->'resources';
    IF jsonb_typeof(v_resources) = 'array' THEN
      v_idx := 0;
      FOR v_resource IN SELECT * FROM jsonb_array_elements(v_resources)
      LOOP
        v_question_set_id := NULL;
        v_ucat_mock_id := NULL;
        IF (v_resource->>'resource_type') = 'set' AND (v_resource->>'resource_id') IS NOT NULL THEN
          v_question_set_id := (v_resource->>'resource_id')::UUID;
        ELSIF (v_resource->>'resource_type') = 'mock' AND (v_resource->>'resource_id') IS NOT NULL THEN
          v_ucat_mock_id := (v_resource->>'resource_id')::UUID;
        END IF;
        IF v_question_set_id IS NOT NULL OR v_ucat_mock_id IS NOT NULL THEN
          INSERT INTO public.ucat_sessions_resources (session_id, question_set_id, ucat_mock_id, index, created_by)
          VALUES (v_session_id, v_question_set_id, v_ucat_mock_id, COALESCE((v_resource->>'index')::INT, v_idx), v_staff_id);
        END IF;
        v_idx := v_idx + 1;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tutor_ucat_replace_sessions_resources(JSONB) TO authenticated;

COMMENT ON FUNCTION public.tutor_ucat_replace_sessions_resources(JSONB) IS 'Replace all UCAT session resources for given sessions. Each session must belong to a UCAT class the current tutor is assigned to. Used by Edit Class Sessions save.';
