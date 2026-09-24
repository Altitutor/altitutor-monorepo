-- Soft-deleted parents retain their stored ownership links for restore/history,
-- but those links are inactive in tutor columns and student catalog eligibility.

CREATE OR REPLACE VIEW public.vtutor_ucat_question_sets AS
SELECT
  question_set.id,
  public.safe_text_to_jsonb(public.ucat_question_set_catalog_name(question_set.id)) AS name,
  question_set.description,
  question_set.time_limit_seconds,
  question_set.status,
  question_set.access_scope,
  question_set.status = 'published'
    AND question_set.access_scope = 'public'
    AND (question_set.mock_id IS NULL OR parent.deleted_at IS NOT NULL)
      AS is_available_in_sets_pool,
  question_set.status_changed_at,
  question_set.status_changed_by,
  question_set.sections,
  question_set.time_limit_at_exam_speed_seconds,
  question_set.speed,
  question_set.created_at,
  question_set.updated_at,
  question_set.created_by,
  question_set.updated_by,
  question_set.deleted_at,
  question_set.deleted_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  (SELECT count(*)::INTEGER FROM public.question_stems_question_sets member
    WHERE member.question_set_id = question_set.id) AS stem_count,
  (SELECT count(*)::INTEGER
    FROM public.ucat_questions question
    JOIN public.question_stems_question_sets member
      ON member.question_stem_id = question.question_stem_id
    WHERE member.question_set_id = question_set.id AND question.deleted_at IS NULL) AS question_count,
  CASE WHEN parent.id IS NULL OR parent.deleted_at IS NOT NULL THEN '[]'::JSONB
    ELSE jsonb_build_array(question_set.mock_id) END AS ucat_mock_ids,
  public.ucat_content_publication_issues('set', question_set.id) AS publication_issues,
  CASE WHEN parent.id IS NULL OR parent.deleted_at IS NOT NULL THEN '[]'::JSONB
    ELSE jsonb_build_array(jsonb_build_object(
      'mockId', parent.id,
      'mockName', public.ucat_mock_catalog_name(parent.id),
      'blueprintId', parent.blueprint_id,
      'setIds', COALESCE((
        SELECT jsonb_agg(component.id ORDER BY section_component.section_number, component.id)
        FROM public.question_sets component
        JOIN public.ucat_sections section_component ON section_component.id = component.section_id
        WHERE component.mock_id = parent.id AND component.deleted_at IS NULL
      ), '[]'::JSONB),
      'compliance', public.ucat_mock_blueprint_compliance(parent.id)
    )) END AS linked_mock_blueprint_compliance,
  question_set.section_id,
  section.section_number,
  section.name AS section_name,
  public.ucat_question_set_catalog_name(question_set.id) AS display_name,
  public.ucat_question_set_catalog_name(question_set.id, true) AS compact_display_name,
  question_set.authoring_note,
  question_set.set_format,
  question_set.timing_mode,
  question_set.pace_multiplier,
  question_set.fixed_time_limit_seconds,
  question_set.reference_blueprint_id,
  question_set.mock_id,
  question_set.catalog_index
FROM public.question_sets question_set
LEFT JOIN public.staff created_staff ON created_staff.id = question_set.created_by
LEFT JOIN public.ucat_mocks parent ON parent.id = question_set.mock_id
JOIN public.ucat_sections section ON section.id = question_set.section_id
WHERE public.is_ucat_tutor();

CREATE OR REPLACE VIEW public.vstudent_ucat_question_sets AS
SELECT
  question_set.id,
  public.safe_text_to_jsonb(public.ucat_question_set_catalog_name(question_set.id)) AS name,
  question_set.description,
  question_set.time_limit_seconds,
  question_set.sections,
  question_set.time_limit_at_exam_speed_seconds,
  question_set.speed,
  question_set.created_at,
  question_set.updated_at,
  question_set.status = 'published'
    AND question_set.access_scope = 'public'
    AND (question_set.mock_id IS NULL OR parent.deleted_at IS NOT NULL)
      AS is_available_in_sets_library,
  question_set.section_id,
  section.section_number,
  public.ucat_question_set_catalog_name(question_set.id) AS display_name,
  public.ucat_question_set_catalog_name(question_set.id, true) AS compact_display_name,
  question_set.set_format,
  question_set.timing_mode,
  question_set.pace_multiplier,
  question_set.fixed_time_limit_seconds,
  question_set.reference_blueprint_id,
  question_set.mock_id,
  question_set.catalog_index
FROM public.question_sets question_set
JOIN public.vstudent_ucat_accessible_question_sets accessible ON accessible.id = question_set.id
JOIN public.ucat_sections section ON section.id = question_set.section_id
LEFT JOIN public.ucat_mocks parent ON parent.id = question_set.mock_id;

COMMENT ON VIEW public.vtutor_ucat_question_sets IS
  'Tutor set catalog; soft-deleted mock ownership is retained but omitted from active membership and library eligibility.';

COMMENT ON VIEW public.vstudent_ucat_question_sets IS
  'Student set catalog; sets owned only by a soft-deleted mock remain eligible as standalone library content.';

-- Reconcile memberships deleted before the synchronous projection refresh was
-- introduced, so the Questions page is correct immediately after deployment.
SELECT public.refresh_ucat_question_catalog_set_derived_fields_for_stems(
  ARRAY(SELECT projection.stem_id FROM public.ucat_question_catalog_projection projection)
);
