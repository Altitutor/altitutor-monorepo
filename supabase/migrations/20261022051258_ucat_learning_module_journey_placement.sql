-- Journey placement describes timing independently of Study-plan priority.
ALTER TABLE public.ucat_learning_modules
  ADD COLUMN study_plan_journey_placement TEXT;
ALTER TABLE public.ucat_learning_modules ADD CONSTRAINT ucat_learning_module_journey_placement_check CHECK (
  study_plan_journey_placement IS NULL OR (
    kind = 'lesson' AND (
      (study_plan_journey_placement = 'section_learning' AND ucat_section_id IS NOT NULL)
      OR (study_plan_journey_placement IN ('orientation', 'later_learning', 'pre_exam') AND ucat_section_id IS NULL)
    )
  )
);
COMMENT ON COLUMN public.ucat_learning_modules.study_plan_journey_placement IS
  'Authored preparation timing independent of priority; NULL sectionless lessons are unclassified and unscheduled.';

UPDATE public.ucat_learning_modules SET study_plan_journey_placement = 'section_learning'
WHERE kind = 'lesson' AND ucat_section_id IS NOT NULL;

-- One-off identities verified read-only in development and production on 2026-10-22.
-- Preserve priorities, authored order and any unrecognised general content.
UPDATE public.ucat_learning_modules module SET study_plan_journey_placement = mapping.placement
FROM (VALUES
  ('1d78fc4e-359c-4a49-9cef-5119e2f952d9'::UUID, 'orientation'),
  ('5ff4b1fb-76ee-4ae3-b6e3-ee467df5763b'::UUID, 'orientation'),
  ('d27b1c8f-6892-4606-9e81-698bd4c6c32e'::UUID, 'later_learning'),
  ('9d85ddc0-e062-4ed8-aed4-9464be570ff1'::UUID, 'later_learning'),
  ('1d6d7247-5c59-4c8b-a078-758d1925fe95'::UUID, 'pre_exam')
) mapping(id, placement)
WHERE module.id = mapping.id AND module.kind = 'lesson'
  AND module.ucat_section_id IS NULL AND module.study_plan_journey_placement IS NULL;

CREATE OR REPLACE VIEW public.vtutor_ucat_learning_modules
WITH (security_invoker = false)
AS
SELECT
  lm.id,
  lm.kind,
  lm.title,
  lm.description,
  lm.ucat_section_id,
  lm.parent_ucat_learning_module_id,
  lm.index,
  lm.status,
  lm.access_scope,
  lm.status_changed_at,
  lm.status_changed_by,
  lm.published_at,
  lm.published_by,
  lm.created_at,
  lm.updated_at,
  lm.created_by,
  lm.updated_by,
  lm.deleted_at,
  lm.deleted_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  s.name AS section_name,
  s.section_number,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.ucat_learning_modules child
    WHERE child.parent_ucat_learning_module_id = lm.id
      AND child.deleted_at IS NULL
  ) AS child_count,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.ucat_learning_module_blocks block
    WHERE block.learning_module_id = lm.id
      AND block.deleted_at IS NULL
  ) AS block_count,
  lm.study_plan_priority,
  lm.icon_key,
  lm.estimated_minutes,
  lm.study_plan_journey_placement
FROM public.ucat_learning_modules lm
LEFT JOIN public.ucat_sections s ON s.id = lm.ucat_section_id
LEFT JOIN public.staff created_staff ON created_staff.id = lm.created_by
WHERE public.is_ucat_tutor();

CREATE OR REPLACE VIEW public.vstudent_ucat_learning_modules
WITH (security_invoker = false)
AS
SELECT
  lm.id,
  lm.kind,
  lm.title,
  lm.description,
  lm.ucat_section_id,
  lm.parent_ucat_learning_module_id,
  lm.index,
  lm.status,
  lm.access_scope,
  s.name AS section_name,
  s.section_number,
  progress.started_at,
  progress.completion_percent,
  progress.completed_at,
  lm.study_plan_priority,
  lm.icon_key,
  lm.estimated_minutes,
  lm.study_plan_journey_placement
FROM public.ucat_learning_modules lm
CROSS JOIN public.vstudent_ucat_access_context context
LEFT JOIN public.ucat_sections s ON s.id = lm.ucat_section_id
LEFT JOIN public.ucat_student_learning_module_progress progress
  ON progress.learning_module_id = lm.id
  AND progress.student_id = context.student_id
LEFT JOIN public.vstudent_ucat_accessible_learning_modules accessible_module
  ON accessible_module.id = lm.id
WHERE lm.deleted_at IS NULL
  AND context.has_online_access
  AND (
    lm.kind = 'folder'
    OR accessible_module.id IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.ucat_learning_modules child
      JOIN public.vstudent_ucat_accessible_learning_modules accessible_child
        ON accessible_child.id = child.id
      WHERE child.parent_ucat_learning_module_id = lm.id
        AND child.deleted_at IS NULL
        AND child.kind = 'lesson'
    )
  );

DROP FUNCTION public.tutor_ucat_upsert_learning_module(UUID, public.ucat_learning_module_kind, TEXT, TEXT, UUID, UUID, INTEGER, public.ucat_access_scope, TEXT, INTEGER);

CREATE FUNCTION public.tutor_ucat_upsert_learning_module(
  p_module_id UUID,
  p_kind public.ucat_learning_module_kind,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_ucat_section_id UUID DEFAULT NULL,
  p_parent_id UUID DEFAULT NULL,
  p_index INTEGER DEFAULT 0,
  p_access_scope public.ucat_access_scope DEFAULT 'public',
  p_icon_key TEXT DEFAULT 'book-open',
  p_estimated_minutes INTEGER DEFAULT NULL,
  p_journey_placement TEXT DEFAULT NULL,
  p_set_journey_placement BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_journey_placement TEXT;
  v_staff_id UUID;
  v_module_id UUID;
  v_index INTEGER;
  v_access public.ucat_access_scope;
  v_status public.ucat_content_status;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_estimated_minutes IS NOT NULL
    AND p_estimated_minutes NOT BETWEEN 1 AND 600 THEN
    RAISE EXCEPTION 'invalid_learning_module_estimated_minutes';
  END IF;

  IF p_set_journey_placement THEN
    v_journey_placement := p_journey_placement;
  ELSE
    -- Older callers preserve placement on ordinary edits. A changed section
    -- returns to the safe section default or unclassified general state.
    SELECT study_plan_journey_placement INTO v_journey_placement
    FROM public.ucat_learning_modules
    WHERE id = p_module_id
      AND ucat_section_id IS NOT DISTINCT FROM p_ucat_section_id;
    IF v_journey_placement IS NULL AND p_kind = 'lesson' AND p_ucat_section_id IS NOT NULL THEN
      v_journey_placement := 'section_learning';
    END IF;
  END IF;
  IF v_journey_placement IS NOT NULL AND (
    p_kind <> 'lesson'
    OR v_journey_placement NOT IN ('section_learning', 'orientation', 'later_learning', 'pre_exam')
    OR (v_journey_placement = 'section_learning') <> (p_ucat_section_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'invalid_learning_module_journey_placement';
  END IF;

  v_staff_id := public.current_tutor_id();
  v_access := COALESCE(p_access_scope, 'public'::public.ucat_access_scope);

  IF p_kind = 'folder' THEN
    v_status := 'published'::public.ucat_content_status;
    v_access := 'public'::public.ucat_access_scope;
  ELSE
    v_status := 'draft'::public.ucat_content_status;
  END IF;

  BEGIN
    IF p_module_id IS NULL THEN
      IF p_parent_id IS NULL THEN
        SELECT COALESCE(MAX(index), -1) + 1 INTO v_index
        FROM public.ucat_learning_modules
        WHERE parent_ucat_learning_module_id IS NULL
          AND deleted_at IS NULL;
      ELSE
        SELECT COALESCE(MAX(index), -1) + 1 INTO v_index
        FROM public.ucat_learning_modules
        WHERE parent_ucat_learning_module_id = p_parent_id
          AND deleted_at IS NULL;
      END IF;

      INSERT INTO public.ucat_learning_modules (
        kind, title, description, ucat_section_id, parent_ucat_learning_module_id,
        index, status, access_scope, icon_key, estimated_minutes,
        status_changed_at, status_changed_by,
        published_at, published_by,
        created_by, updated_by, study_plan_journey_placement
      )
      VALUES (
        p_kind, p_title, p_description, p_ucat_section_id, p_parent_id,
        v_index, v_status, v_access, COALESCE(p_icon_key, 'book-open'), p_estimated_minutes,
        NOW(), v_staff_id,
        CASE WHEN p_kind = 'folder' THEN NOW() ELSE NULL END,
        CASE WHEN p_kind = 'folder' THEN v_staff_id ELSE NULL END,
        v_staff_id, v_staff_id, v_journey_placement
      )
      RETURNING id INTO v_module_id;
    ELSE
      UPDATE public.ucat_learning_modules
      SET
        kind = p_kind,
        title = p_title,
        description = p_description,
        ucat_section_id = p_ucat_section_id,
        parent_ucat_learning_module_id = p_parent_id,
        index = COALESCE(p_index, index),
        access_scope = CASE
          WHEN p_kind = 'folder' THEN 'public'::public.ucat_access_scope
          ELSE v_access
        END,
        status = CASE
          WHEN p_kind = 'folder' THEN 'published'::public.ucat_content_status
          ELSE status
        END,
        icon_key = COALESCE(p_icon_key, icon_key),
        estimated_minutes = p_estimated_minutes,
        study_plan_journey_placement = v_journey_placement,
        updated_by = v_staff_id,
        updated_at = NOW()
      WHERE id = p_module_id AND deleted_at IS NULL
      RETURNING id INTO v_module_id;

      IF v_module_id IS NULL THEN
        RAISE EXCEPTION 'learning_module_not_found';
      END IF;
    END IF;
  EXCEPTION
    WHEN check_violation THEN
      RAISE EXCEPTION 'invalid_learning_module_icon';
  END;

  RETURN v_module_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_learning_module(UUID, public.ucat_learning_module_kind, TEXT, TEXT, UUID, UUID, INTEGER, public.ucat_access_scope, TEXT, INTEGER, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_learning_module(UUID, public.ucat_learning_module_kind, TEXT, TEXT, UUID, UUID, INTEGER, public.ucat_access_scope, TEXT, INTEGER, TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_student_ucat_study_plan_generation_bundle(
  p_student_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_bundle JSONB;
BEGIN
  SELECT student.user_id INTO v_user_id
  FROM public.students student
  WHERE student.id = p_student_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'student_user_not_found';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_user_id, 'role', 'authenticated')::TEXT,
    true
  );

  SELECT jsonb_build_object(
    'vstudent_ucat_section_set_progress', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT progress.section_id, progress.total_completed
        FROM public.vstudent_ucat_section_set_progress progress
      ) item
    ),
    'vstudent_ucat_my_question_progress', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT progress.category_id, progress.correct_score, progress.max_score
        FROM public.vstudent_ucat_my_question_progress progress
      ) item
    ),
    'vstudent_ucat_study_plan_readiness_evidence', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT evidence.section_id, evidence.category_id,
          evidence.readiness_scope, evidence.attempted_question_count,
          evidence.completed_practice_sessions,
          evidence.qualifying_practice_sessions,
          evidence.largest_practice_session_question_count,
          evidence.recent_accuracy, evidence.observed_pace
        FROM public.vstudent_ucat_study_plan_readiness_evidence evidence
      ) item
    ),
    'vstudent_ucat_learning_modules', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT module.id, module.title, module.kind, module.ucat_section_id,
          module.study_plan_priority, module.estimated_minutes, module.study_plan_journey_placement,
          module.completion_percent, module.parent_ucat_learning_module_id,
          module.index
        FROM public.vstudent_ucat_learning_modules module
      ) item
    ),
    'vstudent_ucat_preparation_section_states', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT state.section_id, state.test_year, state.learning_graduated_at,
          state.learning_graduation_route, state.policy_version,
          state.prescribed_pace, state.prescribed_pace_set_at,
          state.pace_policy_version
        FROM public.vstudent_ucat_preparation_section_states state
      ) item
    ),
    'vstudent_ucat_preparation_timing_evidence', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT evidence.evidence_session_id, evidence.source,
          evidence.section_id, evidence.completed_at,
          evidence.prescribed_pace, evidence.observed_pace,
          evidence.accuracy, evidence.section_equivalents,
          evidence.category_ids, evidence.breadth
        FROM public.vstudent_ucat_preparation_timing_evidence evidence
        ORDER BY evidence.completed_at DESC, evidence.evidence_session_id DESC
        LIMIT 800
      ) item
    ),
    'vstudent_ucat_question_sets', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT question_set.id, question_set.name, question_set.sections,
          question_set.speed, question_set.time_limit_at_exam_speed_seconds,
          question_set.is_available_in_sets_library
        FROM public.vstudent_ucat_question_sets question_set
      ) item
    ),
    'vstudent_ucat_completed_set_assets', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT asset.asset_id AS question_set_id,
          asset.last_completed_at AS completed_at,
          NULL::UUID AS student_ucat_mock_attempt_id
        FROM public.student_ucat_completed_benchmark_assets asset
        WHERE asset.student_id = p_student_id
          AND asset.asset_type = 'set'
        ORDER BY asset.last_completed_at DESC, asset.asset_id
        LIMIT 512
      ) item
    ),
    'vstudent_ucat_mocks', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT mock.id, mock.name FROM public.vstudent_ucat_mocks mock
      ) item
    ),
    'vstudent_ucat_completed_mock_assets', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT asset.asset_id AS ucat_mock_id,
          asset.last_completed_at AS completed_at
        FROM public.student_ucat_completed_benchmark_assets asset
        WHERE asset.student_id = p_student_id
          AND asset.asset_type = 'mock'
        ORDER BY asset.last_completed_at DESC, asset.asset_id
        LIMIT 512
      ) item
    ),
    'vstudent_ucat_preparation_snapshots', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT snapshot.generated_at, snapshot.snapshot_date, snapshot.snapshot
        FROM public.vstudent_ucat_preparation_snapshots snapshot
        ORDER BY snapshot.generated_at DESC
        LIMIT 60
      ) item
    )
  ) INTO v_bundle;

  RETURN v_bundle;
END;
$$;
