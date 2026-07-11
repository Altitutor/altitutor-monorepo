-- Seed Situational Judgement question tags for practical scenarios and ethics principles.
-- Practical tags describe the situation tested; ethics tags are cross-cutting principles.
-- IDs are deterministic so this migration can run safely in dev and prod.

DO $$
DECLARE
  v_sj_section_id UUID;
BEGIN
  SELECT id INTO v_sj_section_id
  FROM public.ucat_sections
  WHERE name = 'Situational Judgement'
  LIMIT 1;

  IF v_sj_section_id IS NULL THEN
    RAISE EXCEPTION 'Situational Judgement section not found';
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
    ('7a1d2c2a-a11a-5269-8f19-468ceaa36cb9', 'Patient welfare and safety', NULL, NULL, v_sj_section_id, NULL, NULL),
    ('5ec21d13-a21e-5ea3-8f81-b26dddf84896', 'Patient safety', NULL, '7a1d2c2a-a11a-5269-8f19-468ceaa36cb9', NULL, NULL, NULL),
    ('e30eb988-e06e-595e-97e6-a109b8ccb59d', 'Infection risk', NULL, '7a1d2c2a-a11a-5269-8f19-468ceaa36cb9', NULL, NULL, NULL),
    ('69bbc05f-3111-5901-9bfc-e7b5b9742536', 'Scope of competence', NULL, '7a1d2c2a-a11a-5269-8f19-468ceaa36cb9', NULL, NULL, NULL),
    ('330314ad-83ff-5b93-81bf-394e8cbea562', 'Escalating concerns', NULL, '7a1d2c2a-a11a-5269-8f19-468ceaa36cb9', NULL, NULL, NULL),

    ('0c5335cb-ec32-55c5-9f18-23024edae5ba', 'Professional conduct', NULL, NULL, v_sj_section_id, NULL, NULL),
    ('c408e48a-2821-59da-8ead-4c1c343a683c', 'Professionalism', NULL, '0c5335cb-ec32-55c5-9f18-23024edae5ba', NULL, NULL, NULL),
    ('b23022d6-a0aa-5063-bd3d-d05249911832', 'Honesty and accountability', NULL, '0c5335cb-ec32-55c5-9f18-23024edae5ba', NULL, NULL, NULL),
    ('39ccae51-ca01-5d93-8f40-8f4303873c91', 'Confidentiality', NULL, '0c5335cb-ec32-55c5-9f18-23024edae5ba', NULL, NULL, NULL),
    ('b2651ddd-1c79-55b9-9115-c6c1d55ba34f', 'Respect and dignity', NULL, '0c5335cb-ec32-55c5-9f18-23024edae5ba', NULL, NULL, NULL),
    ('206d8715-5bb5-5fcc-a952-4823035ebf28', 'Following protocol', NULL, '0c5335cb-ec32-55c5-9f18-23024edae5ba', NULL, NULL, NULL),

    ('c3f9171a-83a9-55d1-8352-05768493a0e2', 'Teamwork and communication', NULL, NULL, v_sj_section_id, NULL, NULL),
    ('9ecad79c-26b2-5ea3-a7c9-687c4d04b00a', 'Speaking up', NULL, 'c3f9171a-83a9-55d1-8352-05768493a0e2', NULL, NULL, NULL),
    ('2fba64c2-affb-5932-b0e4-e27364095981', 'Peer concern', NULL, 'c3f9171a-83a9-55d1-8352-05768493a0e2', NULL, NULL, NULL),
    ('416fbb74-d7d2-5932-b525-26a1ded71501', 'Conflict with colleague', NULL, 'c3f9171a-83a9-55d1-8352-05768493a0e2', NULL, NULL, NULL),
    ('df789084-4247-5ac6-b517-eb9c46fd2760', 'Seeking senior support', NULL, 'c3f9171a-83a9-55d1-8352-05768493a0e2', NULL, NULL, NULL),
    ('85ff0f43-12fe-54d9-9e8d-e480b7087b2c', 'Patient interaction', NULL, 'c3f9171a-83a9-55d1-8352-05768493a0e2', NULL, NULL, NULL),

    ('76febcbb-4336-58d9-862f-c46fd1317245', 'Personal judgement', NULL, NULL, v_sj_section_id, NULL, NULL),
    ('aa608db1-6596-5140-811d-1c38232286bc', 'Workload and prioritisation', NULL, '76febcbb-4336-58d9-862f-c46fd1317245', NULL, NULL, NULL),
    ('45d4d023-aac4-5b42-a45a-0c20601713c1', 'Wellbeing and mental health', NULL, '76febcbb-4336-58d9-862f-c46fd1317245', NULL, NULL, NULL),
    ('81ea05f4-33a1-5996-97e0-a1eb39fe3434', 'Managing commitments', NULL, '76febcbb-4336-58d9-862f-c46fd1317245', NULL, NULL, NULL),
    ('943a11fe-c597-5d9e-87c6-c00d78964088', 'Career opportunity vs responsibility', NULL, '76febcbb-4336-58d9-862f-c46fd1317245', NULL, NULL, NULL),
    ('e026b42b-78ce-59b3-bf5d-37f79de17359', 'Peer pressure', NULL, '76febcbb-4336-58d9-862f-c46fd1317245', NULL, NULL, NULL),

    ('f680ed5a-872e-5b85-bbb1-c384da48ed76', 'Ethical principles', NULL, NULL, v_sj_section_id, NULL, NULL),
    ('9b6573f3-8d3c-5fd9-b6d4-929e90d90a99', 'Beneficence', NULL, 'f680ed5a-872e-5b85-bbb1-c384da48ed76', NULL, NULL, NULL),
    ('ee390fbf-7fd7-5419-a6df-1104923b3e36', 'Non-maleficence', NULL, 'f680ed5a-872e-5b85-bbb1-c384da48ed76', NULL, NULL, NULL),
    ('3f5c26fb-976d-5b14-8b0f-6b7e0a07db38', 'Autonomy', NULL, 'f680ed5a-872e-5b85-bbb1-c384da48ed76', NULL, NULL, NULL),
    ('d8737787-18ae-577f-9a28-205b26b8f45b', 'Justice', NULL, 'f680ed5a-872e-5b85-bbb1-c384da48ed76', NULL, NULL, NULL),
    ('1e5605fa-2e40-50b6-bffd-31203ea48fc2', 'Consent', NULL, 'f680ed5a-872e-5b85-bbb1-c384da48ed76', NULL, NULL, NULL),
    ('15bdab0d-5e7c-5ce6-be1a-62021c8f4899', 'Confidentiality', NULL, 'f680ed5a-872e-5b85-bbb1-c384da48ed76', NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    parent_question_tag_id = EXCLUDED.parent_question_tag_id,
    ucat_section_id = EXCLUDED.ucat_section_id,
    updated_at = NOW();
END $$;
