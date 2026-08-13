-- Permanent Learning graduation is explicit per Student preparation cycle.
-- Performance evidence may later deteriorate, but a completed transition must
-- not disappear until the Student starts preparing for a different test year.

CREATE TABLE public.ucat_student_preparation_section_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  test_year INTEGER NOT NULL CHECK (test_year BETWEEN 2020 AND 2100),
  section_id UUID NOT NULL REFERENCES public.ucat_sections(id) ON DELETE CASCADE,
  learning_graduated_at TIMESTAMPTZ NOT NULL,
  learning_graduation_route TEXT NOT NULL CHECK (
    learning_graduation_route IN ('accuracy', 'experience')
  ),
  policy_version TEXT NOT NULL CHECK (length(trim(policy_version)) > 0),
  evidence_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (
    jsonb_typeof(evidence_snapshot) = 'object'
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, test_year, section_id)
);

CREATE INDEX idx_ucat_preparation_section_states_section
  ON public.ucat_student_preparation_section_states (section_id);

CREATE TRIGGER update_ucat_preparation_section_states_updated_at
  BEFORE UPDATE ON public.ucat_student_preparation_section_states
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.ucat_student_preparation_section_states IS
  'Permanent section-level Learning graduation within one UCAT preparation cycle. New test years own independent state.';

ALTER TABLE public.ucat_student_preparation_section_states ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ucat_student_preparation_section_states
  FROM anon, authenticated;
GRANT ALL ON public.ucat_student_preparation_section_states TO service_role;

CREATE VIEW public.vstudent_ucat_preparation_section_states
WITH (security_invoker = false)
AS
SELECT
  state.id,
  state.student_id,
  state.test_year,
  state.section_id,
  state.learning_graduated_at,
  state.learning_graduation_route,
  state.policy_version,
  state.evidence_snapshot,
  state.created_at,
  state.updated_at
FROM public.ucat_student_preparation_section_states state
WHERE state.student_id = (SELECT public.current_student_id());

REVOKE ALL ON public.vstudent_ucat_preparation_section_states
  FROM anon, authenticated;
GRANT SELECT ON public.vstudent_ucat_preparation_section_states
  TO authenticated;

COMMENT ON VIEW public.vstudent_ucat_preparation_section_states IS
  'Current Student role facade for permanent section graduation in each UCAT preparation cycle.';

