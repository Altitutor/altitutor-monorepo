-- Persist tutor-visible UCAT AI generation run debug payloads.

CREATE TABLE IF NOT EXISTS public.ucat_ai_generation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES public.ucat_sections(id) ON DELETE SET NULL,
  question_stem_category_id UUID REFERENCES public.question_stem_categories(id) ON DELETE SET NULL,
  model_profile_id UUID REFERENCES public.ucat_ai_generation_model_profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  requested_stem_count INTEGER NOT NULL CHECK (requested_stem_count > 0),
  accepted_stem_count INTEGER NOT NULL DEFAULT 0 CHECK (accepted_stem_count >= 0),
  discarded_stem_count INTEGER NOT NULL DEFAULT 0 CHECK (discarded_stem_count >= 0),
  error_message TEXT,
  debug_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id)
);

CREATE INDEX IF NOT EXISTS idx_ucat_ai_generation_runs_created_at
  ON public.ucat_ai_generation_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ucat_ai_generation_runs_created_by
  ON public.ucat_ai_generation_runs(created_by);

ALTER TABLE public.ucat_ai_generation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_ai_generation_runs"
  ON public.ucat_ai_generation_runs;
CREATE POLICY "ADMINSTAFF full access to ucat_ai_generation_runs"
  ON public.ucat_ai_generation_runs
  FOR ALL USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "UCAT tutors read own ucat_ai_generation_runs"
  ON public.ucat_ai_generation_runs;
CREATE POLICY "UCAT tutors read own ucat_ai_generation_runs"
  ON public.ucat_ai_generation_runs
  FOR SELECT USING (
    (SELECT public.is_ucat_tutor())
    AND created_by = (SELECT public.current_tutor_id())
  );

DROP POLICY IF EXISTS "UCAT tutors insert own ucat_ai_generation_runs"
  ON public.ucat_ai_generation_runs;
CREATE POLICY "UCAT tutors insert own ucat_ai_generation_runs"
  ON public.ucat_ai_generation_runs
  FOR INSERT WITH CHECK (
    (SELECT public.is_ucat_tutor())
    AND created_by = (SELECT public.current_tutor_id())
  );

DROP POLICY IF EXISTS "UCAT tutors update own ucat_ai_generation_runs"
  ON public.ucat_ai_generation_runs;
CREATE POLICY "UCAT tutors update own ucat_ai_generation_runs"
  ON public.ucat_ai_generation_runs
  FOR UPDATE USING (
    (SELECT public.is_ucat_tutor())
    AND created_by = (SELECT public.current_tutor_id())
  )
  WITH CHECK (
    (SELECT public.is_ucat_tutor())
    AND created_by = (SELECT public.current_tutor_id())
  );

DROP TRIGGER IF EXISTS update_ucat_ai_generation_runs_updated_at
  ON public.ucat_ai_generation_runs;
CREATE TRIGGER update_ucat_ai_generation_runs_updated_at
  BEFORE UPDATE ON public.ucat_ai_generation_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
