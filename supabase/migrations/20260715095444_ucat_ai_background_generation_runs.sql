-- Durable, tutor-visible state for background UCAT AI generation.

ALTER TABLE public.ucat_ai_generation_runs
  ADD COLUMN IF NOT EXISTS workflow_run_id text,
  ADD COLUMN IF NOT EXISTS progress_step text,
  ADD COLUMN IF NOT EXISTS progress_message text,
  ADD COLUMN IF NOT EXISTS processed_stem_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS generated_stem_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

ALTER TABLE public.ucat_ai_generation_runs
  DROP CONSTRAINT IF EXISTS ucat_ai_generation_runs_processed_stem_count_check,
  ADD CONSTRAINT ucat_ai_generation_runs_processed_stem_count_check
    CHECK (processed_stem_count >= 0);

CREATE INDEX IF NOT EXISTS idx_ucat_ai_generation_runs_companion
  ON public.ucat_ai_generation_runs(created_by, dismissed_at, created_at DESC);

ALTER TABLE public.question_stems
  ADD COLUMN IF NOT EXISTS ai_generation_run_id uuid
    REFERENCES public.ucat_ai_generation_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_question_stems_ai_generation_run_id
  ON public.question_stems(ai_generation_run_id)
  WHERE ai_generation_run_id IS NOT NULL;

-- Workflow steps execute with the service role and therefore have no tutor JWT.
-- This narrowly-scoped RPC restores the originating tutor's auth context for the
-- existing, validated bundle writer. It is callable by service_role only.
CREATE OR REPLACE FUNCTION public.service_ucat_persist_generated_stem(
  p_run_id uuid,
  p_stem jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
  v_user_id uuid;
  v_section_id uuid;
  v_stem_ids uuid[];
  v_stem_id uuid;
BEGIN
  SELECT run.created_by, run.section_id
  INTO v_staff_id, v_section_id
  FROM public.ucat_ai_generation_runs run
  WHERE run.id = p_run_id
    AND run.status = 'running'
  FOR UPDATE;

  IF v_staff_id IS NULL OR v_section_id IS NULL THEN
    RAISE EXCEPTION 'generation_run_not_running';
  END IF;

  SELECT staff.user_id
  INTO v_user_id
  FROM public.staff
  WHERE staff.id = v_staff_id
    AND staff.status = 'ACTIVE';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'generation_run_actor_invalid';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);

  v_stem_ids := public.tutor_ucat_bulk_upsert_generated_question_stem_bundles(
    v_section_id,
    jsonb_build_array(p_stem)
  );
  v_stem_id := v_stem_ids[1];

  IF v_stem_id IS NULL THEN
    RAISE EXCEPTION 'generated_stem_not_persisted';
  END IF;

  UPDATE public.question_stems
  SET ai_generation_run_id = p_run_id
  WHERE id = v_stem_id;

  UPDATE public.ucat_ai_generation_runs
  SET generated_stem_ids = array_append(generated_stem_ids, v_stem_id),
      accepted_stem_count = accepted_stem_count + 1,
      updated_by = v_staff_id
  WHERE id = p_run_id;

  RETURN v_stem_id;
END;
$$;

REVOKE ALL ON FUNCTION public.service_ucat_persist_generated_stem(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.service_ucat_persist_generated_stem(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.service_ucat_persist_generated_stem(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.service_ucat_persist_generated_stem(uuid, jsonb) TO service_role;
