-- Durable, advisory AI assessments for UCAT question stems.
-- Assessment work is dispatched by tutor-web after lifecycle/content writes;
-- this migration only persists configuration, immutable review cycles, runs,
-- and tutor decisions. It intentionally performs no historical backfill.

ALTER TABLE public.ucat_ai_generation_settings
  ADD COLUMN IF NOT EXISTS automatic_review_blind_solver_model_profile_id UUID
    REFERENCES public.ucat_ai_generation_model_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS automatic_review_assessment_model_profile_id UUID
    REFERENCES public.ucat_ai_generation_model_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS automatic_review_use_solver_for_assessment BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.ucat_ai_generation_settings AS settings
SET automatic_review_blind_solver_model_profile_id = profile.id
FROM LATERAL (
  SELECT id
  FROM public.ucat_ai_generation_model_profiles
  WHERE is_enabled = TRUE
  ORDER BY is_default DESC, name, id
  LIMIT 1
) AS profile
WHERE settings.automatic_review_blind_solver_model_profile_id IS NULL;

CREATE TABLE IF NOT EXISTS public.ucat_ai_question_assessment_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stem_id UUID NOT NULL REFERENCES public.question_stems(id) ON DELETE CASCADE,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  started_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ucat_ai_question_assessment_cycles_current
  ON public.ucat_ai_question_assessment_cycles(stem_id)
  WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_ucat_ai_question_assessment_cycles_stem_history
  ON public.ucat_ai_question_assessment_cycles(stem_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.ucat_ai_question_assessment_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.ucat_ai_question_assessment_cycles(id) ON DELETE CASCADE,
  stem_id UUID NOT NULL REFERENCES public.question_stems(id) ON DELETE CASCADE,
  trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('review_submission', 'content_change', 'retry')),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('full', 'questions')),
  target_question_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
  dedupe_key TEXT NOT NULL UNIQUE,
  content_fingerprint TEXT NOT NULL,
  shared_fingerprint TEXT NOT NULL,
  question_fingerprints JSONB NOT NULL DEFAULT '{}'::JSONB,
  content_snapshot JSONB NOT NULL,
  format_checks JSONB NOT NULL DEFAULT '[]'::JSONB,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'deferred', 'completed', 'failed', 'superseded', 'format_blocked')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  queue_message_id TEXT,
  blind_solver_model_profile_id UUID REFERENCES public.ucat_ai_generation_model_profiles(id) ON DELETE SET NULL,
  assessment_model_profile_id UUID REFERENCES public.ucat_ai_generation_model_profiles(id) ON DELETE SET NULL,
  blind_solver_provider_id UUID REFERENCES public.ucat_ai_generation_providers(id) ON DELETE SET NULL,
  assessment_provider_id UUID REFERENCES public.ucat_ai_generation_providers(id) ON DELETE SET NULL,
  blind_solver_model TEXT,
  assessment_model TEXT,
  prompt_version INTEGER NOT NULL DEFAULT 1,
  blind_solution JSONB,
  assessment_result JSONB,
  error_message TEXT,
  requested_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  deferred_until TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ucat_ai_question_assessment_runs_cycle
  ON public.ucat_ai_question_assessment_runs(cycle_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_ucat_ai_question_assessment_runs_stem
  ON public.ucat_ai_question_assessment_runs(stem_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_ucat_ai_question_assessment_runs_dispatch
  ON public.ucat_ai_question_assessment_runs(status, deferred_until, requested_at)
  WHERE status IN ('queued', 'deferred');

CREATE TABLE IF NOT EXISTS public.ucat_ai_question_assessment_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.ucat_ai_question_assessment_runs(id) ON DELETE CASCADE,
  stem_id UUID NOT NULL REFERENCES public.question_stems(id) ON DELETE CASCADE,
  finding_key TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('dismissed', 'suggestion_accepted', 'suggestion_rejected')),
  reason TEXT,
  reviewed_content_fingerprint TEXT NOT NULL,
  patch JSONB,
  decided_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ucat_ai_question_assessment_decisions_run
  ON public.ucat_ai_question_assessment_decisions(run_id, decided_at DESC);

ALTER TABLE public.ucat_ai_question_assessment_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_ai_question_assessment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_ai_question_assessment_decisions ENABLE ROW LEVEL SECURITY;

-- Supabase projects created after April 2026 no longer expose new public tables
-- through the Data API automatically. Tutors only need read access; all writes
-- continue to happen through authenticated server routes/service-role workers.
GRANT SELECT ON public.ucat_ai_question_assessment_cycles TO authenticated;
GRANT SELECT ON public.ucat_ai_question_assessment_runs TO authenticated;
GRANT SELECT ON public.ucat_ai_question_assessment_decisions TO authenticated;

DROP POLICY IF EXISTS "ADMINSTAFF full access to UCAT AI assessment cycles"
  ON public.ucat_ai_question_assessment_cycles;
CREATE POLICY "ADMINSTAFF full access to UCAT AI assessment cycles"
  ON public.ucat_ai_question_assessment_cycles
  FOR ALL TO authenticated USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "UCAT tutors read AI assessment cycles"
  ON public.ucat_ai_question_assessment_cycles;
CREATE POLICY "UCAT tutors read AI assessment cycles"
  ON public.ucat_ai_question_assessment_cycles
  FOR SELECT TO authenticated USING ((SELECT public.is_ucat_tutor()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to UCAT AI assessment runs"
  ON public.ucat_ai_question_assessment_runs;
CREATE POLICY "ADMINSTAFF full access to UCAT AI assessment runs"
  ON public.ucat_ai_question_assessment_runs
  FOR ALL TO authenticated USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "UCAT tutors read AI assessment runs"
  ON public.ucat_ai_question_assessment_runs;
CREATE POLICY "UCAT tutors read AI assessment runs"
  ON public.ucat_ai_question_assessment_runs
  FOR SELECT TO authenticated USING ((SELECT public.is_ucat_tutor()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to UCAT AI assessment decisions"
  ON public.ucat_ai_question_assessment_decisions;
CREATE POLICY "ADMINSTAFF full access to UCAT AI assessment decisions"
  ON public.ucat_ai_question_assessment_decisions
  FOR ALL TO authenticated USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "UCAT tutors read AI assessment decisions"
  ON public.ucat_ai_question_assessment_decisions;
CREATE POLICY "UCAT tutors read AI assessment decisions"
  ON public.ucat_ai_question_assessment_decisions
  FOR SELECT TO authenticated USING ((SELECT public.is_ucat_tutor()));

DROP TRIGGER IF EXISTS update_ucat_ai_question_assessment_runs_updated_at
  ON public.ucat_ai_question_assessment_runs;
CREATE TRIGGER update_ucat_ai_question_assessment_runs_updated_at
  BEFORE UPDATE ON public.ucat_ai_question_assessment_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.service_ucat_start_ai_assessment_cycle(
  p_stem_id UUID,
  p_started_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle_id UUID;
BEGIN
  -- Serialize cycle transitions for the same stem so concurrent lifecycle
  -- requests cannot race the partial unique current-cycle index.
  PERFORM 1
  FROM public.question_stems
  WHERE id = p_stem_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'question_stem_not_found';
  END IF;

  UPDATE public.ucat_ai_question_assessment_cycles
  SET is_current = FALSE
  WHERE stem_id = p_stem_id AND is_current = TRUE;

  INSERT INTO public.ucat_ai_question_assessment_cycles (stem_id, started_by)
  VALUES (p_stem_id, p_started_by)
  RETURNING id INTO v_cycle_id;

  RETURN v_cycle_id;
END;
$$;

REVOKE ALL ON FUNCTION public.service_ucat_start_ai_assessment_cycle(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.service_ucat_start_ai_assessment_cycle(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.service_ucat_start_ai_assessment_cycle(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.service_ucat_start_ai_assessment_cycle(UUID, UUID) TO service_role;

COMMENT ON TABLE public.ucat_ai_question_assessment_cycles IS
  'Immutable review-cycle boundaries for supplementary UCAT AI question assessments; no launch backfill is performed.';
COMMENT ON TABLE public.ucat_ai_question_assessment_runs IS
  'Durable, versioned blind-solve and assessment work for exact UCAT stem content snapshots.';
COMMENT ON TABLE public.ucat_ai_question_assessment_decisions IS
  'Tutor audit history for dismissing findings and accepting or rejecting bounded assessment suggestions.';
