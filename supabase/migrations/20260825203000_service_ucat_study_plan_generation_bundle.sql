-- Benchmark selection needs only whether an asset has been completed and its
-- most recent completion. Project that fact once instead of regrouping or
-- transferring a Student's lifetime Set and Mock histories on every plan build.

CREATE TABLE public.student_ucat_completed_benchmark_assets (
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('set', 'mock')),
  asset_id UUID NOT NULL,
  last_completed_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (student_id, asset_type, asset_id)
);

CREATE INDEX student_ucat_completed_benchmark_assets_recent_idx
  ON public.student_ucat_completed_benchmark_assets
  (student_id, asset_type, last_completed_at DESC, asset_id);

CREATE INDEX student_question_set_attempts_benchmark_asset_projection_idx
  ON public.student_question_set_attempts
  (student_id, question_set_id, completed_at DESC)
  WHERE completed_at IS NOT NULL
    AND discarded_at IS NULL
    AND expired_at IS NULL
    AND student_ucat_mock_attempt_id IS NULL;

CREATE INDEX student_ucat_mock_attempts_benchmark_asset_projection_idx
  ON public.student_ucat_mock_attempts
  (student_id, ucat_mock_id, completed_at DESC)
  WHERE completed_at IS NOT NULL
    AND discarded_at IS NULL
    AND expired_at IS NULL;

ALTER TABLE public.student_ucat_completed_benchmark_assets ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.project_completed_ucat_benchmark_asset()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_asset_type TEXT;
  v_asset_id UUID;
  v_was_eligible BOOLEAN;
  v_is_eligible BOOLEAN;
  v_latest_completed_at TIMESTAMPTZ;
BEGIN
  IF TG_TABLE_NAME = 'student_question_set_attempts' THEN
    v_asset_type := 'set';
    v_asset_id := NEW.question_set_id;
    v_was_eligible := OLD.completed_at IS NOT NULL
      AND OLD.discarded_at IS NULL
      AND OLD.expired_at IS NULL
      AND OLD.student_ucat_mock_attempt_id IS NULL;
    v_is_eligible := NEW.completed_at IS NOT NULL
      AND NEW.discarded_at IS NULL
      AND NEW.expired_at IS NULL
      AND NEW.student_ucat_mock_attempt_id IS NULL;
  ELSE
    v_asset_type := 'mock';
    v_asset_id := NEW.ucat_mock_id;
    v_was_eligible := OLD.completed_at IS NOT NULL
      AND OLD.discarded_at IS NULL
      AND OLD.expired_at IS NULL;
    v_is_eligible := NEW.completed_at IS NOT NULL
      AND NEW.discarded_at IS NULL
      AND NEW.expired_at IS NULL;
  END IF;

  IF NOT v_was_eligible AND NOT v_is_eligible THEN
    RETURN NEW;
  END IF;

  IF v_asset_type = 'set' THEN
    SELECT max(attempt.completed_at) INTO v_latest_completed_at
    FROM public.student_question_set_attempts attempt
    WHERE attempt.student_id = NEW.student_id
      AND attempt.question_set_id = v_asset_id
      AND attempt.completed_at IS NOT NULL
      AND attempt.discarded_at IS NULL
      AND attempt.expired_at IS NULL
      AND attempt.student_ucat_mock_attempt_id IS NULL;
  ELSE
    SELECT max(attempt.completed_at) INTO v_latest_completed_at
    FROM public.student_ucat_mock_attempts attempt
    WHERE attempt.student_id = NEW.student_id
      AND attempt.ucat_mock_id = v_asset_id
      AND attempt.completed_at IS NOT NULL
      AND attempt.discarded_at IS NULL
      AND attempt.expired_at IS NULL;
  END IF;

  IF v_latest_completed_at IS NULL THEN
    DELETE FROM public.student_ucat_completed_benchmark_assets asset
    WHERE asset.student_id = NEW.student_id
      AND asset.asset_type = v_asset_type
      AND asset.asset_id = v_asset_id;
  ELSE
    INSERT INTO public.student_ucat_completed_benchmark_assets (
      student_id, asset_type, asset_id, last_completed_at
    ) VALUES (
      NEW.student_id, v_asset_type, v_asset_id, v_latest_completed_at
    )
    ON CONFLICT (student_id, asset_type, asset_id) DO UPDATE
    SET last_completed_at = excluded.last_completed_at;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.project_completed_ucat_benchmark_asset()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER project_completed_ucat_set_benchmark_asset
AFTER UPDATE OF completed_at, discarded_at, expired_at,
  student_ucat_mock_attempt_id
ON public.student_question_set_attempts
FOR EACH ROW EXECUTE FUNCTION public.project_completed_ucat_benchmark_asset();

CREATE TRIGGER project_completed_ucat_mock_benchmark_asset
AFTER UPDATE OF completed_at, discarded_at, expired_at
ON public.student_ucat_mock_attempts
FOR EACH ROW EXECUTE FUNCTION public.project_completed_ucat_benchmark_asset();

INSERT INTO public.student_ucat_completed_benchmark_assets (
  student_id, asset_type, asset_id, last_completed_at
)
SELECT attempt.student_id, 'set', attempt.question_set_id,
  max(attempt.completed_at)
FROM public.student_question_set_attempts attempt
WHERE attempt.completed_at IS NOT NULL
  AND attempt.discarded_at IS NULL
  AND attempt.expired_at IS NULL
  AND attempt.student_ucat_mock_attempt_id IS NULL
GROUP BY attempt.student_id, attempt.question_set_id
ON CONFLICT (student_id, asset_type, asset_id) DO UPDATE
SET last_completed_at = excluded.last_completed_at;

INSERT INTO public.student_ucat_completed_benchmark_assets (
  student_id, asset_type, asset_id, last_completed_at
)
SELECT attempt.student_id, 'mock', attempt.ucat_mock_id,
  max(attempt.completed_at)
FROM public.student_ucat_mock_attempts attempt
WHERE attempt.completed_at IS NOT NULL
  AND attempt.discarded_at IS NULL
  AND attempt.expired_at IS NULL
GROUP BY attempt.student_id, attempt.ucat_mock_id
ON CONFLICT (student_id, asset_type, asset_id) DO UPDATE
SET last_completed_at = excluded.last_completed_at;

CREATE VIEW public.vstudent_ucat_completed_set_assets AS
SELECT asset.asset_id AS question_set_id,
  asset.last_completed_at AS completed_at,
  NULL::UUID AS student_ucat_mock_attempt_id
FROM public.student_ucat_completed_benchmark_assets asset
JOIN public.students student ON student.id = asset.student_id
WHERE asset.asset_type = 'set'
  AND student.user_id = (SELECT auth.uid());

CREATE VIEW public.vstudent_ucat_completed_mock_assets AS
SELECT asset.asset_id AS ucat_mock_id,
  asset.last_completed_at AS completed_at
FROM public.student_ucat_completed_benchmark_assets asset
JOIN public.students student ON student.id = asset.student_id
WHERE asset.asset_type = 'mock'
  AND student.user_id = (SELECT auth.uid());

GRANT SELECT ON public.vstudent_ucat_completed_set_assets TO authenticated;
GRANT SELECT ON public.vstudent_ucat_completed_mock_assets TO authenticated;

-- Scheduled canonical Study-plan generation has no Student request JWT. Build
-- the Student-scoped read bundle in one privileged statement while preserving
-- the same authenticated view semantics used by interactive generation.

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
    jsonb_build_object(
      'sub', v_user_id,
      'role', 'authenticated'
    )::TEXT,
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
          module.study_plan_priority, module.estimated_minutes,
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
    'vstudent_ucat_practice_stem_index', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT ranked.id, ranked.section_id,
          ranked.question_stem_category_id, ranked.question_ids,
          ranked.question_tag_ids
        FROM (
          SELECT stem.*,
            row_number() OVER (
              PARTITION BY stem.section_id, stem.question_stem_category_id
              ORDER BY stem.id
            ) AS category_rank
          FROM public.vstudent_ucat_practice_stem_index stem
        ) ranked
        WHERE ranked.category_rank <= 128
      ) item
    ),
    'vstudent_ucat_my_question_attempts', (
      SELECT coalesce(jsonb_agg(to_jsonb(item)), '[]'::JSONB)
      FROM (
        SELECT attempt.id, attempt.question_id, attempt.score,
          attempt.is_submitted, attempt.student_practice_session_id,
          attempt.student_question_set_attempt_id, attempt.attempted_at
        FROM public.vstudent_ucat_my_question_attempts attempt
        ORDER BY attempt.attempted_at DESC, attempt.id DESC
        LIMIT 5000
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

REVOKE ALL ON FUNCTION
  public.get_student_ucat_study_plan_generation_bundle(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.get_student_ucat_study_plan_generation_bundle(UUID)
  TO service_role;

COMMENT ON FUNCTION
  public.get_student_ucat_study_plan_generation_bundle(UUID) IS
  'Returns one Student-scoped canonical Study-plan read bundle for scheduled service-role generation; ordinary page reads never call it.';

COMMENT ON TABLE public.student_ucat_completed_benchmark_assets IS
  'One projected latest-completion fact per Student and standalone Set or Mock asset; Study-plan generation never scans lifetime attempt history.';
