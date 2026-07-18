-- Session-assigned UCAT content is an in-person entitlement, independent of
-- the student's online plan. These server-only helpers keep quota enforcement
-- aligned with the existing session resource access model.

CREATE OR REPLACE FUNCTION public.student_has_in_person_ucat_session_resource(
  p_student_id UUID,
  p_resource_type TEXT,
  p_resource_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_resource_id IS NOT NULL
    AND p_resource_type IN (
      'question',
      'question_stem',
      'question_set',
      'mock',
      'learning_module',
      'skill_trainer'
    )
    AND EXISTS (
      SELECT 1
      FROM public.classes_students enrollment
      JOIN public.classes class ON class.id = enrollment.class_id
      JOIN public.sessions session ON session.class_id = class.id
      JOIN public.ucat_sessions_resources resource
        ON resource.session_id = session.id
      WHERE enrollment.student_id = p_student_id
        AND enrollment.unenrolled_at IS NULL
        AND class.subject_id = public.get_ucat_subject_id()
        AND CASE p_resource_type
          WHEN 'mock' THEN resource.ucat_mock_id = p_resource_id
          WHEN 'question_set' THEN
            resource.question_set_id = p_resource_id
            OR EXISTS (
              SELECT 1
              FROM public.question_sets_ucat_mocks mock_member
              WHERE mock_member.ucat_mock_id = resource.ucat_mock_id
                AND mock_member.question_set_id = p_resource_id
            )
          WHEN 'question_stem' THEN
            resource.question_stem_id = p_resource_id
            OR EXISTS (
              SELECT 1
              FROM public.question_stems_question_sets set_member
              WHERE set_member.question_set_id = resource.question_set_id
                AND set_member.question_stem_id = p_resource_id
            )
            OR EXISTS (
              SELECT 1
              FROM public.question_sets_ucat_mocks mock_member
              JOIN public.question_stems_question_sets set_member
                ON set_member.question_set_id = mock_member.question_set_id
              WHERE mock_member.ucat_mock_id = resource.ucat_mock_id
                AND set_member.question_stem_id = p_resource_id
            )
            OR EXISTS (
              SELECT 1
              FROM public.ucat_learning_module_blocks block
              LEFT JOIN public.ucat_questions question
                ON question.id = block.question_id
              WHERE block.learning_module_id = resource.ucat_learning_module_id
                AND block.deleted_at IS NULL
                AND (
                  block.question_stem_id = p_resource_id
                  OR question.question_stem_id = p_resource_id
                )
            )
          WHEN 'question' THEN EXISTS (
            SELECT 1
            FROM public.ucat_questions question
            WHERE question.id = p_resource_id
              AND question.deleted_at IS NULL
              AND (
                question.question_stem_id = resource.question_stem_id
                OR EXISTS (
                  SELECT 1
                  FROM public.question_stems_question_sets set_member
                  WHERE set_member.question_set_id = resource.question_set_id
                    AND set_member.question_stem_id = question.question_stem_id
                )
                OR EXISTS (
                  SELECT 1
                  FROM public.question_sets_ucat_mocks mock_member
                  JOIN public.question_stems_question_sets set_member
                    ON set_member.question_set_id = mock_member.question_set_id
                  WHERE mock_member.ucat_mock_id = resource.ucat_mock_id
                    AND set_member.question_stem_id = question.question_stem_id
                )
                OR EXISTS (
                  SELECT 1
                  FROM public.ucat_learning_module_blocks block
                  LEFT JOIN public.ucat_questions block_question
                    ON block_question.id = block.question_id
                  WHERE block.learning_module_id = resource.ucat_learning_module_id
                    AND block.deleted_at IS NULL
                    AND (
                      block.question_id = question.id
                      OR block.question_stem_id = question.question_stem_id
                      OR block_question.question_stem_id = question.question_stem_id
                    )
                )
              )
          )
          WHEN 'learning_module' THEN
            resource.ucat_learning_module_id = p_resource_id
          WHEN 'skill_trainer' THEN EXISTS (
            SELECT 1
            FROM public.ucat_learning_module_blocks block
            WHERE block.learning_module_id = resource.ucat_learning_module_id
              AND block.skill_trainer_id = p_resource_id
              AND block.deleted_at IS NULL
          )
          ELSE FALSE
        END
    );
$$;

CREATE OR REPLACE FUNCTION public.student_in_person_ucat_session_resource_ids(
  p_student_id UUID,
  p_resource_type TEXT,
  p_resource_ids UUID[]
)
RETURNS TABLE(resource_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT candidate.resource_id
  FROM unnest(COALESCE(p_resource_ids, ARRAY[]::UUID[])) candidate(resource_id)
  WHERE public.student_has_in_person_ucat_session_resource(
    p_student_id,
    p_resource_type,
    candidate.resource_id
  );
$$;

REVOKE ALL ON FUNCTION public.student_has_in_person_ucat_session_resource(UUID, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.student_in_person_ucat_session_resource_ids(UUID, TEXT, UUID[])
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.student_has_in_person_ucat_session_resource(UUID, TEXT, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.student_in_person_ucat_session_resource_ids(UUID, TEXT, UUID[])
  TO service_role;

COMMENT ON FUNCTION public.student_has_in_person_ucat_session_resource(UUID, TEXT, UUID) IS
  'Server-only entitlement check for content assigned to a current UCAT class session of an in-person student.';
COMMENT ON FUNCTION public.student_in_person_ucat_session_resource_ids(UUID, TEXT, UUID[]) IS
  'Server-only bulk form of the in-person UCAT session resource entitlement check.';
