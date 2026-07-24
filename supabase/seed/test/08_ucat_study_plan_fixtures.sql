-- Deterministic UCAT Study plan golden fixtures for local development and the
-- hosted dev project. This file is intentionally not a migration: none of this
-- synthetic curriculum or persona data belongs in production.

-- Four curriculum folders live at high indices so they do not disturb normal
-- authoring order.
WITH folder_seed(id, section_name, title, index) AS (
  VALUES
    ('f1000000-0000-4000-8000-000000000001'::UUID, 'Verbal Reasoning', 'VR foundations', 9000),
    ('f1000000-0000-4000-8000-000000000002'::UUID, 'Decision Making', 'DM foundations', 9001),
    ('f1000000-0000-4000-8000-000000000003'::UUID, 'Quantitative Reasoning', 'QR foundations', 9002),
    ('f1000000-0000-4000-8000-000000000004'::UUID, 'Situational Judgement', 'SJT foundations', 9003)
)
INSERT INTO public.ucat_learning_modules (
  id, kind, title, description, ucat_section_id, parent_ucat_learning_module_id,
  index, status, access_scope, study_plan_priority, deleted_at
)
SELECT
  seed.id,
  'folder'::public.ucat_learning_module_kind,
  seed.title,
  'Golden development fixture for Study plan testing.',
  section.id,
  NULL,
  seed.index,
  'published'::public.ucat_content_status,
  'public'::public.ucat_access_scope,
  'recommended'::public.ucat_learning_module_study_plan_priority,
  NULL
FROM folder_seed seed
JOIN public.ucat_sections section ON section.name = seed.section_name
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  ucat_section_id = EXCLUDED.ucat_section_id,
  index = EXCLUDED.index,
  status = 'published'::public.ucat_content_status,
  access_scope = 'public'::public.ucat_access_scope,
  deleted_at = NULL,
  updated_at = NOW();

WITH lesson_seed(id, section_name, category_name, title, lesson_index, priority) AS (
  VALUES
    ('f2000000-0000-4000-8000-000000000001'::UUID, 'Verbal Reasoning', 'Reading Comprehension', 'Reading comprehension foundations', 0, 'essential'),
    ('f2000000-0000-4000-8000-000000000002'::UUID, 'Verbal Reasoning', 'True, False, Can''t Tell', 'True, false, can’t tell foundations', 1, 'essential'),
    ('f2000000-0000-4000-8000-000000000003'::UUID, 'Decision Making', 'Syllogisms', 'Syllogism foundations', 0, 'essential'),
    ('f2000000-0000-4000-8000-000000000004'::UUID, 'Decision Making', 'Logical Puzzles', 'Logical puzzle foundations', 1, 'essential'),
    ('f2000000-0000-4000-8000-000000000005'::UUID, 'Decision Making', 'Venn Diagrams', 'Venn diagram foundations', 2, 'recommended'),
    ('f2000000-0000-4000-8000-000000000006'::UUID, 'Decision Making', 'Probabilistic and Statistical Reasoning', 'Probability foundations', 3, 'recommended'),
    ('f2000000-0000-4000-8000-000000000007'::UUID, 'Decision Making', 'Recognising Assumptions', 'Recognising assumptions', 4, 'recommended'),
    ('f2000000-0000-4000-8000-000000000008'::UUID, 'Quantitative Reasoning', 'Data Tables', 'Data table foundations', 0, 'essential'),
    ('f2000000-0000-4000-8000-000000000009'::UUID, 'Quantitative Reasoning', 'Graphs and Charts', 'Graphs and charts foundations', 1, 'essential'),
    ('f2000000-0000-4000-8000-000000000010'::UUID, 'Quantitative Reasoning', 'Maps and Diagrams', 'Maps and diagrams foundations', 2, 'recommended'),
    ('f2000000-0000-4000-8000-000000000011'::UUID, 'Quantitative Reasoning', 'Mixed Data Sources', 'Mixed data source foundations', 3, 'recommended'),
    ('f2000000-0000-4000-8000-000000000012'::UUID, 'Quantitative Reasoning', 'Text-Only Scenarios', 'Text-only calculation foundations', 4, 'recommended'),
    ('f2000000-0000-4000-8000-000000000013'::UUID, 'Quantitative Reasoning', 'Timetables and Calendars', 'Timetable foundations', 5, 'recommended'),
    ('f2000000-0000-4000-8000-000000000014'::UUID, 'Situational Judgement', 'How Important', 'Judging importance in SJT', 0, 'essential'),
    ('f2000000-0000-4000-8000-000000000015'::UUID, 'Situational Judgement', 'How Appropriate', 'Judging appropriateness in SJT', 1, 'recommended')
), resolved AS (
  SELECT
    seed.*,
    section.id AS section_id,
    category.id AS category_id,
    CASE section.section_number
      WHEN 1 THEN 'f1000000-0000-4000-8000-000000000001'::UUID
      WHEN 2 THEN 'f1000000-0000-4000-8000-000000000002'::UUID
      WHEN 3 THEN 'f1000000-0000-4000-8000-000000000003'::UUID
      ELSE 'f1000000-0000-4000-8000-000000000004'::UUID
    END AS folder_id
  FROM lesson_seed seed
  JOIN public.ucat_sections section ON section.name = seed.section_name
  JOIN public.question_stem_categories category
    ON category.ucat_section_id = section.id AND category.name = seed.category_name
), inserted AS (
  INSERT INTO public.ucat_learning_modules (
    id, kind, title, description, ucat_section_id, parent_ucat_learning_module_id,
    index, status, access_scope, study_plan_priority, deleted_at
  )
  SELECT
    id,
    'lesson'::public.ucat_learning_module_kind,
    title,
    'Concise development lesson used to verify category-aware Study plan sequencing.',
    section_id,
    folder_id,
    lesson_index,
    'published'::public.ucat_content_status,
    'public'::public.ucat_access_scope,
    priority::public.ucat_learning_module_study_plan_priority,
    NULL
  FROM resolved
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    ucat_section_id = EXCLUDED.ucat_section_id,
    parent_ucat_learning_module_id = EXCLUDED.parent_ucat_learning_module_id,
    index = EXCLUDED.index,
    status = 'published'::public.ucat_content_status,
    access_scope = 'public'::public.ucat_access_scope,
    study_plan_priority = EXCLUDED.study_plan_priority,
    deleted_at = NULL,
    updated_at = NOW()
  RETURNING id
)
INSERT INTO public.ucat_learning_module_question_stem_categories (
  learning_module_id, question_stem_category_id
)
SELECT resolved.id, resolved.category_id
FROM resolved
ON CONFLICT (learning_module_id, question_stem_category_id) DO NOTHING;

-- Every lesson gets a real renderable text block. Where content exists, it
-- also gets an embedded stem and a category-matched skill trainer.
INSERT INTO public.ucat_learning_module_blocks (
  id, learning_module_id, block_type, index,
  require_completion_before_next, content, deleted_at
)
SELECT
  md5(module.id::TEXT || ':text')::UUID,
  module.id,
  'text'::public.ucat_learning_module_block_type,
  0,
  true,
  jsonb_build_object(
    'body', jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(jsonb_build_object(
        'type', 'paragraph',
        'content', jsonb_build_array(jsonb_build_object(
          'type', 'text',
          'text', 'Learn the method, apply it to a short example, then explain why each tempting alternative is wrong.'
        ))
      ))
    )
  ),
  NULL
FROM public.ucat_learning_modules module
WHERE module.id::TEXT LIKE 'f2000000-0000-4000-8000-%'
ON CONFLICT (id) DO UPDATE SET
  content = EXCLUDED.content,
  deleted_at = NULL,
  updated_at = NOW();

-- A compact synthetic bank makes the fixture self-contained. Counts are just
-- large enough for one official-length cognitive benchmark plus short SJT
-- add-ons; hosted dev can additionally use its real authored corpus.
DO $$
DECLARE
  category_record RECORD;
  item_number INTEGER;
  item_count INTEGER;
  option_index INTEGER;
  stem_id UUID;
  question_id UUID;
  option_id UUID;
  tag_id UUID;
  v_rich_document JSONB;
  v_option_document JSONB;
BEGIN
  FOR category_record IN
    SELECT category.id, category.name, category.ucat_section_id, section.section_number,
           COALESCE(section.time_per_question, 60)::INTEGER AS time_per_question
    FROM public.question_stem_categories category
    JOIN public.ucat_sections section ON section.id = category.ucat_section_id
    ORDER BY section.section_number, category.name
  LOOP
    item_count := CASE category_record.section_number
      WHEN 1 THEN 22
      WHEN 2 THEN 7
      WHEN 3 THEN 6
      ELSE 5
    END;
    SELECT id INTO tag_id
    FROM public.question_tags
    WHERE ucat_section_id = category_record.ucat_section_id
    ORDER BY parent_question_tag_id NULLS FIRST, name, id
    LIMIT 1;

    -- Keep one complete category-sized pool discoverable for practice and a
    -- second pool available for benchmark-set assembly. Published set members
    -- are intentionally excluded from ordinary practice by the content model.
    FOR item_number IN 1..(item_count * 2) LOOP
      stem_id := md5('study-plan-fixture-stem:' || category_record.id::TEXT || ':' || item_number::TEXT)::UUID;
      question_id := md5('study-plan-fixture-question:' || category_record.id::TEXT || ':' || item_number::TEXT)::UUID;
      v_rich_document := jsonb_build_object(
        'type', 'doc',
        'content', jsonb_build_array(jsonb_build_object(
          'type', 'paragraph',
          'content', jsonb_build_array(jsonb_build_object(
            'type', 'text',
            'text', format('Development fixture for %s, item %s.', category_record.name, item_number)
          ))
        ))
      );

      INSERT INTO public.question_stems (
        id, section_id, stem_text, question_stem_category_id,
        source_channel, tutor_source_note, status, access_scope,
        status_changed_at, published_at, deleted_at
      ) VALUES (
        stem_id, category_record.ucat_section_id, v_rich_document, category_record.id,
        'individual',
        CASE
          WHEN item_number <= item_count THEN 'Study plan benchmark fixture'
          ELSE 'Study plan practice fixture'
        END,
        'published', 'public',
        NOW(), NOW(), NULL
      )
      ON CONFLICT (id) DO UPDATE SET
        stem_text = EXCLUDED.stem_text,
        question_stem_category_id = EXCLUDED.question_stem_category_id,
        tutor_source_note = EXCLUDED.tutor_source_note,
        status = 'published',
        access_scope = 'public',
        deleted_at = NULL,
        updated_at = NOW();

      INSERT INTO public.ucat_questions (
        id, question_stem_id, question_text, index, difficulty,
        time_burden_seconds, question_type, answer_explanation,
        source_channel, deleted_at
      ) VALUES (
        question_id, stem_id, v_rich_document, 0, 0.5,
        category_record.time_per_question, 'multiple_choice', v_rich_document,
        'individual', NULL
      )
      ON CONFLICT (id) DO UPDATE SET
        question_text = EXCLUDED.question_text,
        answer_explanation = EXCLUDED.answer_explanation,
        deleted_at = NULL,
        updated_at = NOW();

      FOR option_index IN 0..3 LOOP
        option_id := md5(question_id::TEXT || ':option:' || option_index::TEXT)::UUID;
        v_option_document := jsonb_build_object(
          'type', 'doc',
          'content', jsonb_build_array(
            jsonb_build_object(
              'type', 'paragraph',
              'content', jsonb_build_array(
                jsonb_build_object('type', 'text', 'text', 'Option ' || (option_index + 1)::TEXT)
              )
            )
          )
        );
        INSERT INTO public.question_answer_options (
          id, question_id, answer_text, answer_explanation, index, is_answer, deleted_at
        ) VALUES (
          option_id,
          question_id,
          v_option_document,
          v_rich_document,
          option_index,
          option_index = 0,
          NULL
        )
        ON CONFLICT (id) DO UPDATE SET
          answer_text = EXCLUDED.answer_text,
          answer_explanation = EXCLUDED.answer_explanation,
          is_answer = EXCLUDED.is_answer,
          deleted_at = NULL,
          updated_at = NOW();
      END LOOP;

      IF tag_id IS NOT NULL THEN
        INSERT INTO public.questions_question_tags (id, question_id, tag_id)
        VALUES (md5(question_id::TEXT || ':' || tag_id::TEXT)::UUID, question_id, tag_id)
        ON CONFLICT (id) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;

WITH module_category AS (
  SELECT link.learning_module_id, link.question_stem_category_id
  FROM public.ucat_learning_module_question_stem_categories link
  WHERE link.learning_module_id::TEXT LIKE 'f2000000-0000-4000-8000-%'
), chosen_stem AS (
  SELECT DISTINCT ON (module_category.learning_module_id)
    module_category.learning_module_id,
    stem.id AS stem_id
  FROM module_category
  JOIN public.question_stems stem
    ON stem.question_stem_category_id = module_category.question_stem_category_id
  WHERE stem.deleted_at IS NULL
    AND stem.status = 'published'
    AND stem.access_scope = 'public'
  ORDER BY module_category.learning_module_id, stem.id
)
INSERT INTO public.ucat_learning_module_blocks (
  id, learning_module_id, block_type, index,
  require_completion_before_next, content, question_stem_id, deleted_at
)
SELECT
  md5(learning_module_id::TEXT || ':stem')::UUID,
  learning_module_id,
  'question_stem'::public.ucat_learning_module_block_type,
  1,
  true,
  '{}'::JSONB,
  stem_id,
  NULL
FROM chosen_stem
ON CONFLICT (id) DO UPDATE SET
  question_stem_id = EXCLUDED.question_stem_id,
  deleted_at = NULL,
  updated_at = NOW();

WITH chosen_trainer AS (
  SELECT DISTINCT ON (module_category.learning_module_id)
    module_category.learning_module_id,
    trainer.id AS trainer_id,
    trainer.key
  FROM public.ucat_learning_module_question_stem_categories module_category
  JOIN public.ucat_skill_trainer_question_stem_categories trainer_category
    ON trainer_category.question_stem_category_id = module_category.question_stem_category_id
  JOIN public.ucat_skill_trainers trainer ON trainer.id = trainer_category.skill_trainer_id
  WHERE module_category.learning_module_id::TEXT LIKE 'f2000000-0000-4000-8000-%'
    AND trainer.is_enabled
  ORDER BY module_category.learning_module_id, trainer.sort_order, trainer.id
)
INSERT INTO public.ucat_learning_module_blocks (
  id, learning_module_id, block_type, index,
  require_completion_before_next, content, skill_trainer_id, deleted_at
)
SELECT
  md5(learning_module_id::TEXT || ':trainer')::UUID,
  learning_module_id,
  'skill_trainer'::public.ucat_learning_module_block_type,
  2,
  true,
  jsonb_build_object('trainerKey', key),
  trainer_id,
  NULL
FROM chosen_trainer
ON CONFLICT (id) DO UPDATE SET
  content = EXCLUDED.content,
  skill_trainer_id = EXCLUDED.skill_trainer_id,
  deleted_at = NULL,
  updated_at = NOW();

-- Build two deterministic official-length cognitive sets from the available
-- published pool. Stems may differ between environments; fixture IDs do not.
DO $$
DECLARE
  section_record RECORD;
  stem_record RECORD;
  version_number INTEGER;
  set_id UUID;
  target_questions INTEGER;
  running_questions INTEGER;
  stem_index INTEGER;
  set_name TEXT;
BEGIN
  FOR section_record IN
    SELECT id, name, section_number, number_of_questions, time_per_question
    FROM public.ucat_sections
    WHERE section_number <= 3
    ORDER BY section_number
  LOOP
    FOR version_number IN 1..2 LOOP
      set_id := (
        CASE section_record.section_number
          WHEN 1 THEN CASE version_number WHEN 1 THEN 'f3000000-0000-4000-8000-000000000001' ELSE 'f3000000-0000-4000-8000-000000000002' END
          WHEN 2 THEN CASE version_number WHEN 1 THEN 'f3000000-0000-4000-8000-000000000003' ELSE 'f3000000-0000-4000-8000-000000000004' END
          ELSE CASE version_number WHEN 1 THEN 'f3000000-0000-4000-8000-000000000005' ELSE 'f3000000-0000-4000-8000-000000000006' END
        END
      )::UUID;
      target_questions := COALESCE(section_record.number_of_questions, CASE section_record.section_number WHEN 1 THEN 44 WHEN 2 THEN 35 ELSE 36 END);
      set_name := format('Study plan benchmark %s %s', section_record.section_number, version_number);

      INSERT INTO public.question_sets (
        id, name, description, sections, time_limit_seconds,
        time_limit_at_exam_speed_seconds, speed, status, access_scope,
        status_changed_at, published_at, deleted_at
      ) VALUES (
        set_id,
        jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', set_name))))),
        jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Golden development fixture.'))))),
        jsonb_build_array(section_record.id),
        CEIL(target_questions * COALESCE(section_record.time_per_question, 60))::INTEGER,
        target_questions * COALESCE(section_record.time_per_question, 60),
        1,
        'published',
        'public',
        NOW(),
        NOW(),
        NULL
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        sections = EXCLUDED.sections,
        time_limit_seconds = EXCLUDED.time_limit_seconds,
        time_limit_at_exam_speed_seconds = EXCLUDED.time_limit_at_exam_speed_seconds,
        speed = 1,
        status = 'published',
        access_scope = 'public',
        published_at = NOW(),
        deleted_at = NULL,
        updated_at = NOW();

      DELETE FROM public.question_stems_question_sets WHERE question_set_id = set_id;
      running_questions := 0;
      stem_index := 0;
      FOR stem_record IN
        SELECT stem.id, COUNT(question.id)::INTEGER AS question_count
        FROM public.question_stems stem
        JOIN public.ucat_questions question
          ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
        WHERE stem.section_id = section_record.id
          AND stem.deleted_at IS NULL
          AND stem.status = 'published'
          AND stem.access_scope = 'public'
          AND stem.tutor_source_note IS DISTINCT FROM 'Study plan practice fixture'
        GROUP BY stem.id
        ORDER BY md5(stem.id::TEXT || ':' || version_number::TEXT)
      LOOP
        EXIT WHEN running_questions >= target_questions;
        CONTINUE WHEN running_questions + stem_record.question_count > target_questions;
        INSERT INTO public.question_stems_question_sets (
          id, question_stem_id, question_set_id, index
        ) VALUES (
          md5(set_id::TEXT || ':' || stem_record.id::TEXT)::UUID,
          stem_record.id,
          set_id,
          stem_index
        ) ON CONFLICT (id) DO UPDATE SET index = EXCLUDED.index;
        running_questions := running_questions + stem_record.question_count;
        stem_index := stem_index + 1;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

INSERT INTO public.ucat_mocks (
  id, name, status, access_scope, status_changed_at, published_at, deleted_at
)
VALUES
  ('f4000000-0000-4000-8000-000000000001', 'Study plan golden mock 1', 'published', 'public', NOW(), NOW(), NULL),
  ('f4000000-0000-4000-8000-000000000002', 'Study plan golden mock 2', 'published', 'public', NOW(), NOW(), NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  status = 'published',
  access_scope = 'public',
  published_at = NOW(),
  deleted_at = NULL,
  updated_at = NOW();

DELETE FROM public.question_sets_ucat_mocks
WHERE ucat_mock_id IN (
  'f4000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000002'
);

INSERT INTO public.question_sets_ucat_mocks (
  id, question_set_id, ucat_mock_id, index
)
VALUES
  (md5('golden-mock-1-vr')::UUID, 'f3000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 0),
  (md5('golden-mock-1-dm')::UUID, 'f3000000-0000-4000-8000-000000000003', 'f4000000-0000-4000-8000-000000000001', 1),
  (md5('golden-mock-1-qr')::UUID, 'f3000000-0000-4000-8000-000000000005', 'f4000000-0000-4000-8000-000000000001', 2),
  (md5('golden-mock-2-vr')::UUID, 'f3000000-0000-4000-8000-000000000002', 'f4000000-0000-4000-8000-000000000002', 0),
  (md5('golden-mock-2-dm')::UUID, 'f3000000-0000-4000-8000-000000000004', 'f4000000-0000-4000-8000-000000000002', 1),
  (md5('golden-mock-2-qr')::UUID, 'f3000000-0000-4000-8000-000000000006', 'f4000000-0000-4000-8000-000000000002', 2)
ON CONFLICT (id) DO UPDATE SET index = EXCLUDED.index;
