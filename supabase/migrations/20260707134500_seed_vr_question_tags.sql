-- Seed Verbal Reasoning question tags for reading-skill diagnostics.
-- Stem categories remain answer-mode level; question tags capture the skill tested.
-- IDs are deterministic so this migration can run safely in dev and prod.

DO $$
DECLARE
  v_vr_section_id UUID;
BEGIN
  SELECT id INTO v_vr_section_id
  FROM public.ucat_sections
  WHERE name = 'Verbal Reasoning'
  LIMIT 1;

  IF v_vr_section_id IS NULL THEN
    RAISE EXCEPTION 'Verbal Reasoning section not found';
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
    ('c2495ef2-b8fe-510c-b774-b962dfbb15db', 'Evidence handling', NULL, NULL, v_vr_section_id, NULL, NULL),
    ('794bf665-ecd0-5916-a228-18cb84dbcef4', 'Detail retrieval', NULL, 'c2495ef2-b8fe-510c-b774-b962dfbb15db', NULL, NULL, NULL),
    ('58c6205e-5ea6-5af7-ba49-e705ce769d61', 'Paraphrasing', NULL, 'c2495ef2-b8fe-510c-b774-b962dfbb15db', NULL, NULL, NULL),
    ('9288573e-66f9-50ec-b484-d68bf9b9bbca', 'Inference', NULL, 'c2495ef2-b8fe-510c-b774-b962dfbb15db', NULL, NULL, NULL),
    ('9905d717-138d-561b-987a-cb246a5408ac', 'Insufficient information / Can''t tell', NULL, 'c2495ef2-b8fe-510c-b774-b962dfbb15db', NULL, NULL, NULL),
    ('15064c3a-8f6a-53a9-b861-660a72d843be', 'Word or phrase reference', NULL, 'c2495ef2-b8fe-510c-b774-b962dfbb15db', NULL, NULL, NULL),
    ('9d58284f-e76b-5638-95f8-edecec55eab9', 'Cross-paragraph evidence', NULL, 'c2495ef2-b8fe-510c-b774-b962dfbb15db', NULL, NULL, NULL),

    ('48d77158-8d62-57ba-87ee-dcbcc5f4cd4e', 'Author and passage meaning', NULL, NULL, v_vr_section_id, NULL, NULL),
    ('f1350fc0-8961-5ed5-b6e6-ac0be2c0f359', 'Main idea / summary', NULL, '48d77158-8d62-57ba-87ee-dcbcc5f4cd4e', NULL, NULL, NULL),
    ('42eefc90-c9e5-5199-9000-2c0828a8a197', 'Author purpose or attitude', NULL, '48d77158-8d62-57ba-87ee-dcbcc5f4cd4e', NULL, NULL, NULL),
    ('2c6019fa-ff95-5b05-b306-cf1d7ded3745', 'Opinion vs fact', NULL, '48d77158-8d62-57ba-87ee-dcbcc5f4cd4e', NULL, NULL, NULL),
    ('abbced16-6b16-544c-84de-ed7c509c9b35', 'Argument support', NULL, '48d77158-8d62-57ba-87ee-dcbcc5f4cd4e', NULL, NULL, NULL),

    ('48925a89-5fc1-5aa0-8a7c-695117ff809e', 'Question wording traps', NULL, NULL, v_vr_section_id, NULL, NULL),
    ('328e3fdf-468f-53ca-ac52-6e520e64598c', 'Qualifiers', NULL, '48925a89-5fc1-5aa0-8a7c-695117ff809e', NULL, NULL, NULL),
    ('2fc01e00-5852-51b6-8eba-6b3f5232387c', 'Negatives', NULL, '48925a89-5fc1-5aa0-8a7c-695117ff809e', NULL, NULL, NULL),
    ('6faebe1a-557a-5dad-9480-840759fd0229', 'Long statement', NULL, '48925a89-5fc1-5aa0-8a7c-695117ff809e', NULL, NULL, NULL),
    ('37675fa6-c775-5cb3-be8d-fe52fee08898', 'No clear keyword', NULL, '48925a89-5fc1-5aa0-8a7c-695117ff809e', NULL, NULL, NULL),

    ('4e9dfc60-d00a-5eb8-ab2f-6f7de91da612', 'Application', NULL, NULL, v_vr_section_id, NULL, NULL),
    ('2b60837c-05b6-53c4-ba3d-405c8207e4e5', 'New information', NULL, '4e9dfc60-d00a-5eb8-ab2f-6f7de91da612', NULL, NULL, NULL),
    ('6053555a-9ba6-550a-bfb1-e375e583c842', 'Hypothetical application', NULL, '4e9dfc60-d00a-5eb8-ab2f-6f7de91da612', NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    parent_question_tag_id = EXCLUDED.parent_question_tag_id,
    ucat_section_id = EXCLUDED.ucat_section_id,
    updated_at = NOW();
END $$;
