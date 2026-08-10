-- Immutable full-mock blueprint snapshots. New exam policy is introduced as a
-- new version; historical rows are never edited in place.

CREATE TABLE public.ucat_mock_blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  test_year INTEGER NOT NULL CHECK (test_year >= 2026),
  version INTEGER NOT NULL CHECK (version > 0),
  official_facts_label TEXT NOT NULL,
  altitutor_policy_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (test_year, version)
);

CREATE TABLE public.ucat_mock_blueprint_sections (
  blueprint_id UUID NOT NULL REFERENCES public.ucat_mock_blueprints(id) ON DELETE RESTRICT,
  section_code TEXT NOT NULL CHECK (section_code IN (
    'verbal_reasoning',
    'decision_making',
    'quantitative_reasoning',
    'situational_judgement'
  )),
  section_index INTEGER NOT NULL CHECK (section_index >= 0),
  exact_question_count INTEGER NOT NULL CHECK (exact_question_count > 0),
  answering_time_seconds INTEGER NOT NULL CHECK (answering_time_seconds > 0),
  instruction_time_seconds INTEGER NOT NULL CHECK (instruction_time_seconds > 0),
  altitutor_composition_policy JSONB NOT NULL CHECK (jsonb_typeof(altitutor_composition_policy) = 'object'),
  PRIMARY KEY (blueprint_id, section_code),
  UNIQUE (blueprint_id, section_index)
);

COMMENT ON TABLE public.ucat_mock_blueprints IS
  'Immutable, test-year-specific UCAT full-mock blueprint versions. Add a row for a policy change; never update historical versions.';
COMMENT ON COLUMN public.ucat_mock_blueprints.official_facts_label IS
  'Customer-facing provenance label for exact official section totals and timings.';
COMMENT ON COLUMN public.ucat_mock_blueprints.altitutor_policy_label IS
  'Customer-facing provenance label for Altitutor-authored composition ranges and preferences.';
COMMENT ON COLUMN public.ucat_mock_blueprint_sections.exact_question_count IS
  'Official candidate-visible question total; distinct from stem and placement counts.';
COMMENT ON COLUMN public.ucat_mock_blueprint_sections.answering_time_seconds IS
  'Official candidate answering time, excluding section instructions.';
COMMENT ON COLUMN public.ucat_mock_blueprint_sections.instruction_time_seconds IS
  'Official instruction period, stored separately from answering time.';

INSERT INTO public.ucat_mock_blueprints (
  id,
  code,
  test_year,
  version,
  official_facts_label,
  altitutor_policy_label
) VALUES (
  '54100000-0000-4000-8000-000000000001',
  'ucat-anz-2026-v1',
  2026,
  1,
  'Official UCAT ANZ 2026 exact totals and timings',
  'Altitutor-authored composition policy'
);

INSERT INTO public.ucat_mock_blueprint_sections (
  blueprint_id,
  section_code,
  section_index,
  exact_question_count,
  answering_time_seconds,
  instruction_time_seconds,
  altitutor_composition_policy
) VALUES
  (
    '54100000-0000-4000-8000-000000000001',
    'verbal_reasoning',
    0,
    44,
    1320,
    90,
    '{"exactStemCount":11,"categoryRules":[{"category":"Reading Comprehension","unit":"stems","min":7,"max":9},{"category":"True, False, Can''t Tell","unit":"stems","min":2,"max":4}]}'::jsonb
  ),
  (
    '54100000-0000-4000-8000-000000000001',
    'decision_making',
    1,
    35,
    2220,
    90,
    '{"categoryRules":[{"category":"Syllogisms","unit":"questions","min":5,"max":7},{"category":"Logical Puzzles","unit":"questions","min":5,"max":6},{"category":"Recognising Assumptions","unit":"questions","min":3,"preferred":4,"max":5},{"category":"Interpreting Information and Drawing Conclusions","unit":"questions","min":5,"max":6},{"category":"Venn Diagrams","unit":"questions","min":7,"preferred":8,"max":9},{"category":"Probabilistic and Statistical Reasoning","unit":"questions","min":4,"preferred":5,"max":6}],"presentationRules":[{"category":"Interpreting Information and Drawing Conclusions","formats":["passage"],"unit":"questions","min":3,"max":4},{"category":"Interpreting Information and Drawing Conclusions","formats":["table","graph_or_chart"],"unit":"questions","min":1,"max":2}]}'::jsonb
  ),
  (
    '54100000-0000-4000-8000-000000000001',
    'quantitative_reasoning',
    2,
    36,
    1560,
    120,
    '{"structureRules":[{"kind":"stem_count","label":"Multi-question stems","questionCardinality":"multiple","min":7,"max":8},{"kind":"stem_count","label":"Single-question stems","questionCardinality":"single","min":4,"max":8}]}'::jsonb
  ),
  (
    '54100000-0000-4000-8000-000000000001',
    'situational_judgement',
    3,
    69,
    1560,
    90,
    '{"categoryRules":[{"category":"Most/Least Appropriate","unit":"questions","min":2,"preferred":3,"max":4},{"answerScheme":"situational_judgement_rating","label":"Rating questions","unit":"questions","min":65,"preferred":66,"max":67}],"structureRules":[{"kind":"questions_per_stem","label":"Questions in scenario stem","min":1,"max":6}],"responseContractRules":[{"answerScheme":"situational_judgement_most_least","section":"situational_judgement","questionsPerStem":1,"optionCount":3,"requiredPlacementCount":2}]}'::jsonb
  );

CREATE FUNCTION public.prevent_ucat_mock_blueprint_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'UCAT mock blueprint versions are immutable; create a new version instead';
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_ucat_mock_blueprint_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_ucat_mock_blueprint_mutation() FROM authenticated;

CREATE TRIGGER prevent_ucat_mock_blueprint_mutation
BEFORE UPDATE OR DELETE ON public.ucat_mock_blueprints
FOR EACH ROW EXECUTE FUNCTION public.prevent_ucat_mock_blueprint_mutation();

CREATE TRIGGER prevent_ucat_mock_blueprint_section_mutation
BEFORE UPDATE OR DELETE ON public.ucat_mock_blueprint_sections
FOR EACH ROW EXECUTE FUNCTION public.prevent_ucat_mock_blueprint_mutation();

ALTER TABLE public.ucat_mock_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_mock_blueprint_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMINSTAFF read UCAT mock blueprints"
ON public.ucat_mock_blueprints
FOR SELECT TO authenticated
USING ((SELECT public.is_adminstaff_active()));

CREATE POLICY "ADMINSTAFF read UCAT mock blueprint sections"
ON public.ucat_mock_blueprint_sections
FOR SELECT TO authenticated
USING ((SELECT public.is_adminstaff_active()));

CREATE VIEW public.vtutor_ucat_mock_blueprints AS
SELECT
  blueprint.id,
  blueprint.code,
  blueprint.test_year,
  blueprint.version,
  blueprint.official_facts_label,
  blueprint.altitutor_policy_label,
  blueprint.created_at,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'section', section.section_code,
        'sectionIndex', section.section_index,
        'exactQuestionCount', section.exact_question_count,
        'answeringTimeSeconds', section.answering_time_seconds,
        'instructionTimeSeconds', section.instruction_time_seconds,
        'altitutorCompositionPolicy', section.altitutor_composition_policy
      ) ORDER BY section.section_index
    ) FILTER (WHERE section.blueprint_id IS NOT NULL),
    '[]'::jsonb
  ) AS sections
FROM public.ucat_mock_blueprints blueprint
LEFT JOIN public.ucat_mock_blueprint_sections section ON section.blueprint_id = blueprint.id
WHERE public.is_ucat_tutor()
GROUP BY blueprint.id;

GRANT SELECT ON public.vtutor_ucat_mock_blueprints TO authenticated;
