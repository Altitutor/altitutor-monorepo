-- Enforce the repository's data-access boundary:
--   * ADMINSTAFF may access base tables through RLS.
--   * Students and tutors read through caller-scoped SECURITY DEFINER views.
--   * Student/tutor writes go through authenticated API routes using service_role.
--   * Anonymous access is opt-in, not inherited from Supabase defaults.

-- ---------------------------------------------------------------------------
-- 1. Close the six unfiltered reconciliation views.
-- ---------------------------------------------------------------------------

ALTER VIEW public.vadmin_reconciliation_students_without_payment_method
  SET (security_invoker = true);
ALTER VIEW public.vadmin_reconciliation_unassigned_classes
  SET (security_invoker = true);
ALTER VIEW public.vadmin_reconciliation_uninvoiced_sessions
  SET (security_invoker = true);
ALTER VIEW public.vadmin_reconciliation_unlogged_sessions
  SET (security_invoker = true);
ALTER VIEW public.vadmin_reconciliation_unreplied_messages
  SET (security_invoker = true);
ALTER VIEW public.vadmin_reconciliation_void_invoice_sessions
  SET (security_invoker = true);

-- ---------------------------------------------------------------------------
-- 2. Remove student/tutor base-table policies.
--    ADMINSTAFF policies on these tables remain in place.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff create profile image file records" ON public.files;
DROP POLICY IF EXISTS "Staff read profile image file records" ON public.files;
DROP POLICY IF EXISTS "UCAT tutors manage ucat-images files" ON public.files;

DROP POLICY IF EXISTS "Tutors can read tutor documentation documents" ON public.notes_documents;
DROP POLICY IF EXISTS "Tutors can read tutor documentation folders" ON public.notes_folders;

DROP POLICY IF EXISTS "Students can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Tutors can read own notifications" ON public.notifications;

DROP POLICY IF EXISTS "Students can access files for their sessions" ON public.sessions_files;
DROP POLICY IF EXISTS "Tutors can access files for their sessions" ON public.sessions_files;

DROP POLICY IF EXISTS "Users can create reservations" ON public.slot_reservations;
DROP POLICY IF EXISTS "Users can delete own reservations" ON public.slot_reservations;
DROP POLICY IF EXISTS "Users can read own reservations" ON public.slot_reservations;

DROP POLICY IF EXISTS "Students read own student_subscriptions" ON public.student_subscriptions;
DROP POLICY IF EXISTS "Students read own UCAT attempt reviews" ON public.student_ucat_attempt_reviews;
DROP POLICY IF EXISTS "Students start own UCAT attempt reviews" ON public.student_ucat_attempt_reviews;
DROP POLICY IF EXISTS "Students update own UCAT attempt reviews" ON public.student_ucat_attempt_reviews;

DROP POLICY IF EXISTS "Tutors can access parent attendance for their logs"
  ON public.tutor_logs_parent_attendance;

DROP POLICY IF EXISTS "UCAT tutors read ucat_ai_generation_model_profiles"
  ON public.ucat_ai_generation_model_profiles;
DROP POLICY IF EXISTS "UCAT tutors read ucat_ai_generation_prompt_layers"
  ON public.ucat_ai_generation_prompt_layers;
DROP POLICY IF EXISTS "UCAT tutors read ucat_ai_generation_providers"
  ON public.ucat_ai_generation_providers;
DROP POLICY IF EXISTS "UCAT tutors insert own ucat_ai_generation_runs"
  ON public.ucat_ai_generation_runs;
DROP POLICY IF EXISTS "UCAT tutors read own ucat_ai_generation_runs"
  ON public.ucat_ai_generation_runs;
DROP POLICY IF EXISTS "UCAT tutors update own ucat_ai_generation_runs"
  ON public.ucat_ai_generation_runs;
DROP POLICY IF EXISTS "UCAT tutors read ucat_ai_generation_settings"
  ON public.ucat_ai_generation_settings;
DROP POLICY IF EXISTS "UCAT tutors read ucat_ai_generation_system_prompts"
  ON public.ucat_ai_generation_system_prompts;
DROP POLICY IF EXISTS "UCAT tutors insert ucat_ai_generation_usage"
  ON public.ucat_ai_generation_usage;
DROP POLICY IF EXISTS "UCAT tutors read AI assessment cycles"
  ON public.ucat_ai_question_assessment_cycles;
DROP POLICY IF EXISTS "UCAT tutors read AI assessment decisions"
  ON public.ucat_ai_question_assessment_decisions;
DROP POLICY IF EXISTS "UCAT tutors read AI assessment runs"
  ON public.ucat_ai_question_assessment_runs;

DROP POLICY IF EXISTS "Students can read own ucat free quota reset entitlements"
  ON public.ucat_free_quota_reset_entitlements;
DROP POLICY IF EXISTS "Tutors manage learning module study categories"
  ON public.ucat_learning_module_question_stem_categories;
DROP POLICY IF EXISTS "Tutors manage learning module study tags"
  ON public.ucat_learning_module_question_tags;
DROP POLICY IF EXISTS "Students read own UCAT referral access gifts"
  ON public.ucat_referral_access_gifts;
DROP POLICY IF EXISTS "Students read own UCAT referral bill rewards"
  ON public.ucat_referral_bill_rewards;
DROP POLICY IF EXISTS "Students read own UCAT referral code"
  ON public.ucat_referral_codes;
DROP POLICY IF EXISTS "Students read participating UCAT referrals"
  ON public.ucat_referrals;
DROP POLICY IF EXISTS "Students read own UCAT next steps"
  ON public.ucat_student_next_steps;
DROP POLICY IF EXISTS "Students read own Study plan generations"
  ON public.ucat_student_study_plan_generations;
DROP POLICY IF EXISTS "Students read own Study plan profile"
  ON public.ucat_student_study_plan_profiles;
DROP POLICY IF EXISTS "Students read own Study plan tasks"
  ON public.ucat_student_study_plan_tasks;

DROP POLICY IF EXISTS "Authenticated read ucat_plan_prices"
  ON public.ucat_plan_prices;
DROP POLICY IF EXISTS "Authenticated read ucat_practice_day_discount_config"
  ON public.ucat_practice_day_discount_config;
DROP POLICY IF EXISTS "Authenticated read ucat_score_projection_settings"
  ON public.ucat_score_projection_settings;
DROP POLICY IF EXISTS "Authenticated read UCAT Study plan test windows"
  ON public.ucat_study_plan_test_windows;
DROP POLICY IF EXISTS "Authenticated read ucat_subscription_config"
  ON public.ucat_subscription_config;

-- ---------------------------------------------------------------------------
-- 3. Add the missing, caller-scoped read façades.
--    These deliberately remain SECURITY DEFINER so base-table RLS can stay
--    ADMINSTAFF-only. Every view contains its own role and row predicate.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.vstudent_ucat_attempt_reviews
WITH (security_invoker = false) AS
SELECT review.*
FROM public.student_ucat_attempt_reviews review
WHERE (SELECT public.is_student())
  AND review.student_id = (SELECT public.current_student_id());

CREATE OR REPLACE VIEW public.vstudent_ucat_free_quota_reset_entitlements
WITH (security_invoker = false) AS
SELECT entitlement.*
FROM public.ucat_free_quota_reset_entitlements entitlement
WHERE (SELECT public.is_student())
  AND entitlement.student_id = (SELECT public.current_student_id());

CREATE OR REPLACE VIEW public.vstudent_ucat_referral_access_gifts
WITH (security_invoker = false) AS
SELECT gift.*
FROM public.ucat_referral_access_gifts gift
WHERE (SELECT public.is_student())
  AND gift.student_id = (SELECT public.current_student_id());

CREATE OR REPLACE VIEW public.vstudent_ucat_referral_bill_rewards
WITH (security_invoker = false) AS
SELECT reward.*
FROM public.ucat_referral_bill_rewards reward
WHERE (SELECT public.is_student())
  AND reward.student_id = (SELECT public.current_student_id());

CREATE OR REPLACE VIEW public.vstudent_ucat_referral_codes
WITH (security_invoker = false) AS
SELECT code.*
FROM public.ucat_referral_codes code
WHERE (SELECT public.is_student())
  AND code.student_id = (SELECT public.current_student_id());

CREATE OR REPLACE VIEW public.vstudent_ucat_referrals
WITH (security_invoker = false) AS
SELECT referral.*
FROM public.ucat_referrals referral
WHERE (SELECT public.is_student())
  AND (
    referral.referrer_student_id = (SELECT public.current_student_id())
    OR referral.referred_student_id = (SELECT public.current_student_id())
  );

CREATE OR REPLACE VIEW public.vstudent_ucat_next_steps
WITH (security_invoker = false) AS
SELECT next_step.*
FROM public.ucat_student_next_steps next_step
WHERE (SELECT public.is_student())
  AND next_step.student_id = (SELECT public.current_student_id());

CREATE OR REPLACE VIEW public.vstudent_ucat_study_plan_generations
WITH (security_invoker = false) AS
SELECT generation.*
FROM public.ucat_student_study_plan_generations generation
WHERE (SELECT public.is_student())
  AND generation.student_id = (SELECT public.current_student_id());

CREATE OR REPLACE VIEW public.vstudent_ucat_study_plan_profiles
WITH (security_invoker = false) AS
SELECT profile.*
FROM public.ucat_student_study_plan_profiles profile
WHERE (SELECT public.is_student())
  AND profile.student_id = (SELECT public.current_student_id());

CREATE OR REPLACE VIEW public.vstudent_ucat_study_plan_tasks
WITH (security_invoker = false) AS
SELECT task.*
FROM public.ucat_student_study_plan_tasks task
WHERE (SELECT public.is_student())
  AND task.student_id = (SELECT public.current_student_id());

CREATE OR REPLACE VIEW public.vstudent_ucat_score_projection_settings
WITH (security_invoker = false) AS
SELECT setting.*
FROM public.ucat_score_projection_settings setting
WHERE (SELECT public.is_student());

CREATE OR REPLACE VIEW public.vstudent_session_files
WITH (security_invoker = false) AS
SELECT session_file.*
FROM public.sessions_files session_file
WHERE (SELECT public.is_student())
  AND EXISTS (
    SELECT 1
    FROM public.sessions_students student_session
    WHERE student_session.session_id = session_file.session_id
      AND student_session.student_id = (SELECT public.current_student_id())
  );

CREATE OR REPLACE VIEW public.vtutor_documentation_folders
WITH (security_invoker = false) AS
SELECT folder.*
FROM public.notes_folders folder
WHERE (SELECT public.is_tutor())
  AND public.is_notes_folder_tutor_documentation_ancestor(folder.id);

CREATE OR REPLACE VIEW public.vtutor_documentation_documents
WITH (security_invoker = false) AS
SELECT document.*
FROM public.notes_documents document
WHERE (SELECT public.is_tutor())
  AND document.is_tutor_documentation = true;

CREATE OR REPLACE VIEW public.vtutor_session_files
WITH (security_invoker = false) AS
SELECT session_file.*
FROM public.sessions_files session_file
WHERE (SELECT public.is_tutor())
  AND EXISTS (
    SELECT 1
    FROM public.sessions_staff tutor_session
    WHERE tutor_session.session_id = session_file.session_id
      AND tutor_session.staff_id = (SELECT public.current_tutor_id())
  );

CREATE OR REPLACE VIEW public.vtutor_files
WITH (security_invoker = false) AS
SELECT file.*
FROM public.files file
WHERE (SELECT public.is_tutor())
  AND file.deleted_at IS NULL
  AND public.can_tutor_read_file(file.storage_path);

CREATE OR REPLACE VIEW public.vtutor_ucat_ai_generation_model_profiles
WITH (security_invoker = false) AS
SELECT row.* FROM public.ucat_ai_generation_model_profiles row
WHERE (SELECT public.is_ucat_tutor());

CREATE OR REPLACE VIEW public.vtutor_ucat_ai_generation_prompt_layers
WITH (security_invoker = false) AS
SELECT row.* FROM public.ucat_ai_generation_prompt_layers row
WHERE (SELECT public.is_ucat_tutor());

CREATE OR REPLACE VIEW public.vtutor_ucat_ai_generation_providers
WITH (security_invoker = false) AS
SELECT row.* FROM public.ucat_ai_generation_providers row
WHERE (SELECT public.is_ucat_tutor());

CREATE OR REPLACE VIEW public.vtutor_ucat_ai_generation_runs
WITH (security_invoker = false) AS
SELECT run.*
FROM public.ucat_ai_generation_runs run
WHERE (SELECT public.is_ucat_tutor())
  AND run.created_by = (SELECT public.current_tutor_id());

CREATE OR REPLACE VIEW public.vtutor_ucat_ai_generation_settings
WITH (security_invoker = false) AS
SELECT row.* FROM public.ucat_ai_generation_settings row
WHERE (SELECT public.is_ucat_tutor());

CREATE OR REPLACE VIEW public.vtutor_ucat_ai_generation_system_prompts
WITH (security_invoker = false) AS
SELECT row.* FROM public.ucat_ai_generation_system_prompts row
WHERE (SELECT public.is_ucat_tutor());

CREATE OR REPLACE VIEW public.vtutor_ucat_ai_question_assessment_cycles
WITH (security_invoker = false) AS
SELECT row.* FROM public.ucat_ai_question_assessment_cycles row
WHERE (SELECT public.is_ucat_tutor());

CREATE OR REPLACE VIEW public.vtutor_ucat_ai_question_assessment_decisions
WITH (security_invoker = false) AS
SELECT row.* FROM public.ucat_ai_question_assessment_decisions row
WHERE (SELECT public.is_ucat_tutor());

CREATE OR REPLACE VIEW public.vtutor_ucat_ai_question_assessment_runs
WITH (security_invoker = false) AS
SELECT row.* FROM public.ucat_ai_question_assessment_runs row
WHERE (SELECT public.is_ucat_tutor());

CREATE OR REPLACE VIEW public.vtutor_ucat_learning_module_question_stem_categories
WITH (security_invoker = false) AS
SELECT row.* FROM public.ucat_learning_module_question_stem_categories row
WHERE (SELECT public.is_ucat_tutor());

CREATE OR REPLACE VIEW public.vtutor_ucat_learning_module_question_tags
WITH (security_invoker = false) AS
SELECT row.* FROM public.ucat_learning_module_question_tags row
WHERE (SELECT public.is_ucat_tutor());

GRANT SELECT ON
  public.vstudent_ucat_attempt_reviews,
  public.vstudent_ucat_free_quota_reset_entitlements,
  public.vstudent_ucat_referral_access_gifts,
  public.vstudent_ucat_referral_bill_rewards,
  public.vstudent_ucat_referral_codes,
  public.vstudent_ucat_referrals,
  public.vstudent_ucat_next_steps,
  public.vstudent_ucat_study_plan_generations,
  public.vstudent_ucat_study_plan_profiles,
  public.vstudent_ucat_study_plan_tasks,
  public.vstudent_ucat_score_projection_settings,
  public.vstudent_session_files,
  public.vtutor_documentation_folders,
  public.vtutor_documentation_documents,
  public.vtutor_session_files,
  public.vtutor_files,
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
  public.vtutor_ucat_learning_module_question_tags
TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Anonymous access is explicitly allowlisted.
-- ---------------------------------------------------------------------------

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- This view is intentionally public and contains only the marketing fields
-- selected by its definition. No other public-schema relation is anonymous.
GRANT SELECT ON public.vmarketing_staff_profiles TO anon;

-- ---------------------------------------------------------------------------
-- 5. Harden SECURITY DEFINER execution privileges.
-- ---------------------------------------------------------------------------

-- Preserve the existing availability implementation behind a non-executable
-- internal name, then expose a wrapper that prevents a caller from asserting
-- the admin-only bypass flag.
ALTER FUNCTION public.get_available_slots(
  date, date, public.session_type, uuid, integer, boolean
) RENAME TO get_available_slots_internal;

CREATE FUNCTION public.get_available_slots(
  p_start_date date,
  p_end_date date,
  p_session_type public.session_type,
  p_subject_id uuid DEFAULT NULL,
  p_duration_minutes integer DEFAULT 60,
  p_bypass_date_restrictions boolean DEFAULT NULL
)
RETURNS TABLE (
  start_at timestamptz,
  end_at timestamptz,
  available_staff_ids uuid[],
  is_available boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := (SELECT public.is_adminstaff_active());
  v_bypass boolean;
BEGIN
  IF p_bypass_date_restrictions IS TRUE AND NOT v_is_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_bypass := CASE
    WHEN p_bypass_date_restrictions IS NULL THEN v_is_admin
    ELSE p_bypass_date_restrictions AND v_is_admin
  END;

  RETURN QUERY
  SELECT slot.start_at, slot.end_at, slot.available_staff_ids, slot.is_available
  FROM public.get_available_slots_internal(
    p_start_date,
    p_end_date,
    p_session_type,
    p_subject_id,
    p_duration_minutes,
    v_bypass
  ) slot;
END;
$$;

COMMENT ON FUNCTION public.get_available_slots(
  date, date, public.session_type, uuid, integer, boolean
) IS 'Caller-facing availability API. Only active ADMINSTAFF may enable date-restriction bypass.';

DO $$
DECLARE
  function_record record;
  authenticated_allowlist text[] := ARRAY[
    -- Identity / RLS helpers used by authenticated clients and scoped views.
    'current_staff_id', 'current_student_id', 'current_tutor_id',
    'is_adminstaff', 'is_adminstaff_active', 'is_staff', 'is_student',
    'is_tutor', 'is_ucat_in_person_student', 'is_ucat_online_student',
    'is_ucat_student', 'is_ucat_tutor', 'is_ucat_online_quota_exempt',
    'user_role', 'can_current_tutor_view_ucat_student',
    'can_student_access_flashcard_image', 'can_student_access_session_file',
    'can_student_access_ucat_image', 'can_student_access_ucat_learning_module',
    'can_student_access_ucat_mock', 'can_student_access_ucat_question_set',
    'can_student_access_ucat_question_stem', 'can_student_read_file',
    'can_tutor_access_session_file', 'can_tutor_access_subject',
    'can_tutor_create_file', 'can_tutor_read_file',
    'is_notes_folder_tutor_documentation_ancestor',
    'student_has_in_person_ucat_session_resource',
    'student_has_ucat_pro_subscription',
    'student_in_person_ucat_session_resource_ids',

    -- Authenticated application RPC entry points. Each RPC performs its own
    -- role/ownership check; internal helpers and triggers are not allowlisted.
    'batch_update_topic_file_indices', 'batch_update_topic_indices',
    'compute_staff_tier_metrics', 'create_admin_trial_booking',
    'create_booking_session', 'create_tutor_log', 'discontinue_student',
    'enroll_student_in_class', 'get_available_reschedule_sessions',
    'get_available_slots', 'get_my_billing_subsidies',
    'get_student_ucat_online_tier', 'get_unread_contact_conversation_count',
    'log_staff_absences', 'log_student_absences',
    'log_student_absences_self', 're_enroll_student', 'reschedule_session',
    'search_classes_admin', 'search_files_admin', 'search_invoices_admin',
    'search_parents_admin', 'search_sessions_admin', 'search_staff_admin',
    'search_students_admin', 'search_subjects_admin', 'search_topics_admin',
    'search_tutor_logs_admin', 'student_complete_onboarding_tour',
    'student_reset_onboarding_progress', 'student_reset_onboarding_tour',
    'tutor_ucat_assign_mock_sessions', 'tutor_ucat_assign_set_sessions',
    'tutor_ucat_assign_stem_sessions', 'tutor_ucat_bulk_delete_mocks',
    'tutor_ucat_bulk_update_question_stem_metadata',
    'tutor_ucat_bulk_upsert_generated_question_stem_bundles',
    'tutor_ucat_bulk_upsert_question_stem_bundles',
    'tutor_ucat_content_status_blockers', 'tutor_ucat_delete_mock',
    'tutor_ucat_delete_question_set', 'tutor_ucat_delete_question_stem',
    'tutor_ucat_merge_question_stems', 'tutor_ucat_reorder_learning_modules',
    'tutor_ucat_replace_learning_module_blocks',
    'tutor_ucat_replace_sessions_resources',
    'tutor_ucat_restore_content_status_bulk', 'tutor_ucat_restore_mock',
    'tutor_ucat_restore_question_set', 'tutor_ucat_restore_question_stem',
    'tutor_ucat_set_content_status_bulk',
    'tutor_ucat_set_skill_trainer_item_approval',
    'tutor_ucat_soft_delete_learning_module',
    'tutor_ucat_soft_delete_skill_trainer_item',
    'tutor_ucat_upsert_learning_module', 'tutor_ucat_upsert_mock',
    'tutor_ucat_upsert_question_set',
    'tutor_ucat_upsert_question_stem_bundle',
    'tutor_ucat_upsert_skill_trainer_item', 'undo_staff_absences',
    'undo_student_absences'
  ];
BEGIN
  FOR function_record IN
    SELECT p.oid::regprocedure AS signature, p.proname
    FROM pg_proc p
    JOIN pg_namespace namespace ON namespace.oid = p.pronamespace
    WHERE namespace.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', function_record.signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', function_record.signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', function_record.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', function_record.signature);

    IF function_record.proname = ANY(authenticated_allowlist) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', function_record.signature);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Deny-by-default privileges for objects created by future migrations.
-- ---------------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON VIEW public.vmarketing_staff_profiles IS
  'Anonymous allowlisted marketing profile projection. All other public-schema views require authentication.';
