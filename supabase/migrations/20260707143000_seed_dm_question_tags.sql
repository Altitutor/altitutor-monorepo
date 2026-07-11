-- Seed Decision Making question tags for subskills and wording traps.
-- DM categories already describe broad formats; these tags describe reusable reasoning moves.
-- IDs are deterministic so this migration can run safely in dev and prod.

DO $$
DECLARE
  v_dm_section_id UUID;
BEGIN
  SELECT id INTO v_dm_section_id
  FROM public.ucat_sections
  WHERE name = 'Decision Making'
  LIMIT 1;

  IF v_dm_section_id IS NULL THEN
    RAISE EXCEPTION 'Decision Making section not found';
  END IF;

  INSERT INTO public.question_tags (
    id,
    name,
    description,
    parent_question_tag_id,
    ucat_section_id,
    created_by,
    updated_by
  )
  VALUES
    ('dd857d5b-ef30-5d00-8a53-3840ff389006', 'Deductive logic', NULL, NULL, v_dm_section_id, NULL, NULL),
    ('321dd438-3dbe-59ed-8cce-feec1d7756b9', 'Quantifiers: all / some / none', NULL, 'dd857d5b-ef30-5d00-8a53-3840ff389006', NULL, NULL, NULL),
    ('daaebec6-4052-5bbb-8fa7-d4be34985032', 'Conditional reasoning', NULL, 'dd857d5b-ef30-5d00-8a53-3840ff389006', NULL, NULL, NULL),
    ('c40cbd57-53d0-55db-a26c-3318f4333fd9', 'Negation and complements', NULL, 'dd857d5b-ef30-5d00-8a53-3840ff389006', NULL, NULL, NULL),
    ('2d020a57-f772-5534-a4d7-f5f269db53bf', 'Must be true / necessarily follows', NULL, 'dd857d5b-ef30-5d00-8a53-3840ff389006', NULL, NULL, NULL),
    ('7afac837-60d4-5625-a20d-65f0205d114b', 'Cannot be concluded', NULL, 'dd857d5b-ef30-5d00-8a53-3840ff389006', NULL, NULL, NULL),

    ('83bdabc1-72f6-5f4d-8466-e8d790954a55', 'Rule-based problem solving', NULL, NULL, v_dm_section_id, NULL, NULL),
    ('1433e07c-3924-50fb-ba14-436171b3b918', 'Ordering and ranking', NULL, '83bdabc1-72f6-5f4d-8466-e8d790954a55', NULL, NULL, NULL),
    ('e344f0de-f26c-5053-847f-26831bee6415', 'Matching and assignment', NULL, '83bdabc1-72f6-5f4d-8466-e8d790954a55', NULL, NULL, NULL),
    ('bc5d7a16-17e3-5935-b67a-f538f92eed7b', 'Seating or spatial arrangement', NULL, '83bdabc1-72f6-5f4d-8466-e8d790954a55', NULL, NULL, NULL),
    ('9a3b6765-10b2-5857-b9ff-9c5ca1019d5d', 'Scheduling and selection', NULL, '83bdabc1-72f6-5f4d-8466-e8d790954a55', NULL, NULL, NULL),
    ('229d662b-ff87-52e5-8769-ea3272e9c03a', 'Multi-constraint deduction', NULL, '83bdabc1-72f6-5f4d-8466-e8d790954a55', NULL, NULL, NULL),

    ('e47d6d32-9cc1-5652-bf17-368a71746021', 'Set and Venn reasoning', NULL, NULL, v_dm_section_id, NULL, NULL),
    ('32bdd1af-2daa-5614-b310-c1cd91d4aeb3', 'Diagram selection', NULL, 'e47d6d32-9cc1-5652-bf17-368a71746021', NULL, NULL, NULL),
    ('6f944925-117f-5f89-a010-5f3939092b38', 'Region counting', NULL, 'e47d6d32-9cc1-5652-bf17-368a71746021', NULL, NULL, NULL),
    ('a729a921-e22c-59ff-8ad4-e43e55a1bda4', 'Intersections and unions', NULL, 'e47d6d32-9cc1-5652-bf17-368a71746021', NULL, NULL, NULL),
    ('a6b617f0-dfb5-5846-a11e-633d5e453c00', 'Only / neither / complements', NULL, 'e47d6d32-9cc1-5652-bf17-368a71746021', NULL, NULL, NULL),
    ('49366ba2-4bce-5ea5-8035-c11a55d48499', 'Three-plus sets', NULL, 'e47d6d32-9cc1-5652-bf17-368a71746021', NULL, NULL, NULL),

    ('c2fcfeca-23db-577b-aa06-384eefef0b44', 'Probability and data reasoning', NULL, NULL, v_dm_section_id, NULL, NULL),
    ('407379f7-7bfd-58c9-9990-755f908a2a28', 'Basic probability', NULL, 'c2fcfeca-23db-577b-aa06-384eefef0b44', NULL, NULL, NULL),
    ('239eed54-8a30-5137-9523-a7ed9329d91d', 'Conditional probability', NULL, 'c2fcfeca-23db-577b-aa06-384eefef0b44', NULL, NULL, NULL),
    ('3f80fd63-dc32-51aa-b257-f96927854eee', 'Without replacement / combinations', NULL, 'c2fcfeca-23db-577b-aa06-384eefef0b44', NULL, NULL, NULL),
    ('17839c20-88ce-5b0d-a114-4265d4aa0ebd', 'Expected value or risk comparison', NULL, 'c2fcfeca-23db-577b-aa06-384eefef0b44', NULL, NULL, NULL),
    ('774a82a5-fcf3-5407-a74c-8270135f7023', 'Table interpretation', NULL, 'c2fcfeca-23db-577b-aa06-384eefef0b44', NULL, NULL, NULL),
    ('ce8d18df-dee8-577a-ac4c-5f54ae02bb26', 'Fraction / percentage comparison', NULL, 'c2fcfeca-23db-577b-aa06-384eefef0b44', NULL, NULL, NULL),

    ('b6f2e94f-5f2f-5dba-80ce-a4e1cb465308', 'Argument evaluation', NULL, NULL, v_dm_section_id, NULL, NULL),
    ('ba34a35b-a84d-5d7f-b5c6-2cb491f0eb0c', 'Strongest argument', NULL, 'b6f2e94f-5f2f-5dba-80ce-a4e1cb465308', NULL, NULL, NULL),
    ('50681b90-33fa-5646-ae3e-ef4fa64e3181', 'Causal assumption', NULL, 'b6f2e94f-5f2f-5dba-80ce-a4e1cb465308', NULL, NULL, NULL),
    ('b846977e-2d8b-51b6-888e-0d14ba381b6b', 'Relevance and scope', NULL, 'b6f2e94f-5f2f-5dba-80ce-a4e1cb465308', NULL, NULL, NULL),
    ('5f55f630-24d3-5c9f-a66f-7018d1df117e', 'Evidence strength', NULL, 'b6f2e94f-5f2f-5dba-80ce-a4e1cb465308', NULL, NULL, NULL),
    ('c4e48330-8ff3-5170-8647-c2fe885a6222', 'Practical feasibility', NULL, 'b6f2e94f-5f2f-5dba-80ce-a4e1cb465308', NULL, NULL, NULL),
    ('56129894-23e7-5689-9c44-f844e05143b1', 'Policy or public benefit', NULL, 'b6f2e94f-5f2f-5dba-80ce-a4e1cb465308', NULL, NULL, NULL),

    ('bd480a16-d7c3-5313-b73c-6a9c0b76223a', 'Decision wording traps', NULL, NULL, v_dm_section_id, NULL, NULL),
    ('3c0290fe-ec87-54dd-94e2-ce906d6947b0', 'Considering only stated factors', NULL, 'bd480a16-d7c3-5313-b73c-6a9c0b76223a', NULL, NULL, NULL),
    ('2933cdc1-e21a-581c-9e34-8bb9127197e4', 'Yes/no sufficiency', NULL, 'bd480a16-d7c3-5313-b73c-6a9c0b76223a', NULL, NULL, NULL),
    ('ef0ca408-0502-54d7-8786-2b85c253d991', 'False statement', NULL, 'bd480a16-d7c3-5313-b73c-6a9c0b76223a', NULL, NULL, NULL),
    ('2e4f620c-7591-54f3-a2d5-9ddeab840610', 'Greater than / less than comparison', NULL, 'bd480a16-d7c3-5313-b73c-6a9c0b76223a', NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    parent_question_tag_id = EXCLUDED.parent_question_tag_id,
    ucat_section_id = EXCLUDED.ucat_section_id,
    updated_at = NOW();
END $$;
