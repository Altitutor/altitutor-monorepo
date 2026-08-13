CREATE TABLE public.ucat_preparation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  engine_version TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  score_model_version TEXT NOT NULL,
  trajectory_model_version TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ucat_preparation_snapshots_snapshot_check
    CHECK (jsonb_typeof(snapshot) = 'object'),
  CONSTRAINT ucat_preparation_snapshots_versions_check CHECK (
    length(trim(engine_version)) > 0
    AND length(trim(policy_version)) > 0
    AND length(trim(score_model_version)) > 0
    AND length(trim(trajectory_model_version)) > 0
  ),
  CONSTRAINT ucat_preparation_snapshots_student_date_versions_key UNIQUE (
    student_id,
    snapshot_date,
    engine_version,
    policy_version,
    score_model_version,
    trajectory_model_version
  )
);

CREATE INDEX ucat_preparation_snapshots_student_history_idx
  ON public.ucat_preparation_snapshots (
    student_id,
    trajectory_model_version,
    snapshot_date DESC
  );

COMMENT ON TABLE public.ucat_preparation_snapshots IS
  'Versioned daily outputs from the canonical Preparation engine. This lifecycle is independent of optional Study-plan calendar generations.';

COMMENT ON COLUMN public.ucat_preparation_snapshots.snapshot IS
  'Canonical Preparation versions, current-score estimate and trajectory captured for dashboard, progress and no-plan guidance.';

ALTER TABLE public.ucat_preparation_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ucat_preparation_snapshots FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.ucat_preparation_snapshots TO service_role;

CREATE TRIGGER update_ucat_preparation_snapshots_updated_at
  BEFORE UPDATE ON public.ucat_preparation_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE VIEW public.vstudent_ucat_preparation_snapshots
WITH (security_invoker = false)
AS
SELECT
  snapshot.snapshot_date,
  snapshot.engine_version,
  snapshot.policy_version,
  snapshot.score_model_version,
  snapshot.trajectory_model_version,
  snapshot.snapshot,
  snapshot.generated_at
FROM public.ucat_preparation_snapshots snapshot
WHERE (SELECT public.is_student())
  AND snapshot.student_id = (SELECT public.current_student_id());

REVOKE ALL ON public.vstudent_ucat_preparation_snapshots
  FROM anon, authenticated;
GRANT SELECT ON public.vstudent_ucat_preparation_snapshots TO authenticated;

COMMENT ON VIEW public.vstudent_ucat_preparation_snapshots IS
  'Current-Student read facade for version-compatible canonical Preparation snapshots.';
