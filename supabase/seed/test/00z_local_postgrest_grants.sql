-- Reproduce the hosted project's role grants without undoing the production
-- deny-by-default migration. RLS still separates authenticated roles, while
-- anonymous relation/function access remains explicitly allowlisted.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- The blanket hosted-role emulation above runs after migrations during a local
-- reset. Re-apply intentional relation-level denials that production receives
-- from its later migration ordering.
REVOKE ALL ON TABLE public.public_link_revocations
  FROM PUBLIC, anon, authenticated, service_role;

-- Preserve the UCAT runtime boundaries restored by
-- 20260902060000_restore_ucat_runtime_read_privileges.sql. The blanket local
-- grant above intentionally emulates hosted defaults, so production-specific
-- deny rules must be repeated after it.
REVOKE ALL ON public.vstudent_profile
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.vstudent_profile
  TO authenticated, service_role;

REVOKE ALL ON public.vstudent_ucat_my_access
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.vstudent_ucat_my_access
  TO authenticated, service_role;

REVOKE ALL ON public.ucat_public_question_counts_cache
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.ucat_public_question_counts_cache
  TO service_role;

-- Preserve the Study-plan exposure-debt reader boundary restored by
-- 20260902130208_fix_ucat_study_plan_exposure_debt_reader.sql.
REVOKE ALL ON public.ucat_student_study_plan_exposure_debts
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.ucat_student_study_plan_exposure_debts
  TO service_role;

-- Preserve DEV-397's public read boundary after broad fixture grants.
REVOKE ALL ON public.vmarketing_staff_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vmarketing_staff_profiles TO anon, authenticated;

-- Operational schedule facades are read-only, as granted by the lifecycle
-- migration. Preserve that contract after the local hosted-grant emulation.
REVOKE ALL ON public.vtutor_operational_sessions,
  public.vtutor_operational_session_detail, public.vtutor_operational_sessions_students,
  public.vstudent_operational_sessions, public.vstudent_operational_session_detail,
  public.vstudent_operational_session_base FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.vtutor_operational_sessions,
  public.vtutor_operational_session_detail, public.vtutor_operational_sessions_students,
  public.vstudent_operational_sessions, public.vstudent_operational_session_detail,
  public.vstudent_operational_session_base TO authenticated, service_role;

-- Preserve DEV-243 Student retention and private recovery boundaries after the
-- local blanket grant above. Production receives these from the new migration.
REVOKE DELETE ON public.students FROM authenticated,service_role;
REVOKE ALL ON public.student_retired_logins,public.student_login_recovery_limits
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.student_deletion_history FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.student_deletion_history TO authenticated;
REVOKE ALL ON FUNCTION public.retire_student_identity(uuid,uuid),
  public.restore_deleted_student_identity(uuid,uuid),public.normalize_retired_auth_identity(),
  public.require_live_student_for_activity(),public.guard_student_retirement_changes(),
  public.guard_student_identity_admission(),public.guard_retired_contact_identity(),
  public.guard_future_session_students(),public.suppress_retired_student_email(),
  public.guard_resolved_student_booking(),public.guard_retired_student_reservation()
  FROM PUBLIC,anon,authenticated,service_role;

-- Preserve DEV-250's immutable mailbox binding after hosted-grant emulation.
REVOKE ALL ON public.email_mailbox_identity
  FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.email_mailbox_identity TO service_role;

-- Keep short-lived mail Undo receipts private after hosted-grant emulation.
REVOKE ALL ON public.email_command_undos FROM PUBLIC,anon,authenticated;
-- Replay the production conversation-history privilege boundary after broad fixture grants.
REVOKE DELETE, TRUNCATE ON public.messages, public.conversations FROM anon, authenticated;

-- Device tokens, preferences, and delivery state are service-only in production.
REVOKE ALL ON public.mobile_push_devices, public.mobile_push_preferences,
  public.mobile_push_deliveries, public.mobile_push_content_days
  FROM PUBLIC, anon, authenticated;

-- Tutor participant, dashboard and print settings facades remain read-only.
REVOKE ALL ON public.vtutor_session_student_candidates, public.vtutor_session_staff_candidates,
  public.vtutor_dashboard_new_class_students, public.vtutor_office_print_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vtutor_session_student_candidates, public.vtutor_session_staff_candidates,
  public.vtutor_dashboard_new_class_students, public.vtutor_office_print_settings TO authenticated;

-- Preserve DEV-442's read-only portal facades after broad fixture grants.
REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.vstudent_notifications,
  public.vstudent_session_files,
  public.vstudent_slot_reservations,
  public.vstudent_ucat_attempt_reviews,
  public.vstudent_ucat_free_quota_reset_entitlements,
  public.vstudent_ucat_my_activity_start,
  public.vstudent_ucat_next_steps,
  public.vstudent_ucat_question_stem_categories,
  public.vstudent_ucat_score_projection_settings,
  public.vstudent_ucat_sections,
  public.vstudent_ucat_study_plan_generations,
  public.vstudent_ucat_study_plan_tasks,
  public.vtutor_blockouts,
  public.vtutor_files,
  public.vtutor_notes,
  public.vtutor_notifications,
  public.vtutor_session_files,
  public.vtutor_ucat_ai_generation_model_profiles,
  public.vtutor_ucat_ai_generation_prompt_layers,
  public.vtutor_ucat_ai_generation_providers,
  public.vtutor_ucat_ai_generation_runs,
  public.vtutor_ucat_ai_generation_settings,
  public.vtutor_ucat_ai_generation_system_prompts,
  public.vtutor_ucat_ai_question_assessment_cycles,
  public.vtutor_ucat_ai_question_assessment_decisions,
  public.vtutor_ucat_ai_question_assessment_runs,
  public.vtutor_ucat_learning_module_question_stem_categories,
  public.vtutor_ucat_learning_module_question_tags,
  public.vtutor_ucat_mock_detail,
  public.vtutor_ucat_question_stem_categories,
  public.vtutor_ucat_question_tags,
  public.vtutor_ucat_sections,
  public.vtutor_ucat_sessions_resources,
  public.vtutor_ucat_skill_trainer_config,
  public.vtutor_ucat_student_progress_summary
FROM authenticated;

-- Preserve DEV-482's SELECT-only active-round discovery facades after the
-- blanket hosted-role fixture grants above.
REVOKE ALL ON public.vtutor_interview_active_rounds,
  public.vstudent_interview_active_rounds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vtutor_interview_active_rounds,
  public.vstudent_interview_active_rounds TO authenticated;

-- Preserve DEV-487's read-only list/media facades after hosted-role emulation.
REVOKE ALL ON public.vtutor_interview_round_summaries,
  public.vstudent_interview_round_summaries,
  public.vtutor_interview_media_access,
  public.vstudent_interview_media_access FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vtutor_interview_round_summaries,
  public.vstudent_interview_round_summaries,
  public.vtutor_interview_media_access,
  public.vstudent_interview_media_access TO authenticated;

-- Preserve DEV-488's caller-scoped read contracts after broad local grants.
REVOKE ALL ON public.vtutor_interview_round_index,
  public.vstudent_interview_round_index,
  public.vtutor_interview_list_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vtutor_interview_round_index,
  public.vstudent_interview_round_index,
  public.vtutor_interview_list_catalog TO authenticated;
