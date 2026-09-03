-- Soft-deleting a stem also soft-deletes its questions and options. The tutor
-- detail view previously hid those nested rows, so opening a deleted stem loaded
-- questions=null and the editor crashed on missing options. Keep live stems
-- filtered to live children, but include the nested snapshot when the stem itself
-- is deleted.

CREATE OR REPLACE VIEW public.vtutor_ucat_question_stem_detail AS
SELECT stem.id, stem.section_id, section.section_number, section.name AS section_name,
  section.display_columns, stem.question_stem_category_id, category.name AS category_name,
  stem.status, stem.access_scope, stem.status_changed_at, stem.status_changed_by,
  stem.ai_generation_metadata, stem.source_channel, stem.tutor_source_note,
  stem.stem_text, stem.created_at, stem.updated_at, stem.created_by, stem.updated_by,
  stem.deleted_at, stem.deleted_by,
  public.ucat_content_publication_issues('stem', stem.id) AS publication_issues,
  COALESCE((SELECT json_agg(json_build_object(
    'id', question.id, 'question_text', question.question_text,
    'answer_explanation', question.answer_explanation, 'index', question.index,
    'difficulty', question.difficulty, 'time_burden_seconds', question.time_burden_seconds,
    'response_type', question.response_type, 'answer_scheme', question.answer_scheme,
    'source_channel', question.source_channel,
    'ai_generation_metadata', question.ai_generation_metadata,
    'tags', (SELECT COALESCE(json_agg(json_build_object('id', tag.id, 'name', tag.name) ORDER BY tag.name), '[]'::json)
      FROM public.questions_question_tags question_tag
      JOIN public.question_tags tag ON tag.id = question_tag.tag_id
      WHERE question_tag.question_id = question.id),
    'answer_options', (SELECT COALESCE(json_agg(json_build_object(
      'id', option.id, 'answer_text', option.answer_text,
      'answer_explanation', option.answer_explanation, 'index', option.index,
      'answer_key_value', option.answer_key_value
    ) ORDER BY option.index, option.id), '[]'::json)
    FROM public.question_answer_options option
    WHERE option.question_id = question.id
      AND (option.deleted_at IS NULL OR stem.deleted_at IS NOT NULL))
  ) ORDER BY question.index, question.id)
  FROM public.ucat_questions question
  WHERE question.question_stem_id = stem.id
    AND (question.deleted_at IS NULL OR stem.deleted_at IS NOT NULL)), '[]'::json) AS questions
FROM public.question_stems stem
JOIN public.ucat_sections section ON section.id = stem.section_id
LEFT JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
WHERE public.is_ucat_tutor();

ALTER VIEW public.vtutor_ucat_question_stem_detail SET (security_invoker = false);
GRANT SELECT ON public.vtutor_ucat_question_stem_detail TO authenticated, service_role;
