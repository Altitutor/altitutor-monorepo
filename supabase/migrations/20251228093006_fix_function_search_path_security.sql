-- Migration: Fix function search_path security issues
-- Description:
--   Add SET search_path = public to all functions that don't have it set.
--   This prevents schema injection attacks by ensuring functions always use
--   a fixed search_path instead of inheriting from the caller.
--   
--   Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- ========================
-- HELPER FUNCTION TO SAFELY SET SEARCH_PATH
-- ========================
-- This function safely alters a function's search_path only if it exists
CREATE OR REPLACE FUNCTION public._set_function_search_path(
  p_function_name TEXT,
  p_arguments TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_function_oid OID;
  v_has_search_path BOOLEAN;
BEGIN
  -- Find function by name and arguments
  SELECT p.oid INTO v_function_oid
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname = p_function_name
    AND (
      p_arguments IS NULL OR
      pg_get_function_identity_arguments(p.oid) = p_arguments
    )
  LIMIT 1;
  
  -- Only alter if function exists
  IF v_function_oid IS NOT NULL THEN
    -- Check if search_path is already set
    SELECT EXISTS (
      SELECT 1 FROM pg_proc
      WHERE oid = v_function_oid
        AND proconfig IS NOT NULL
        AND array_to_string(proconfig, ', ') LIKE '%search_path%'
    ) INTO v_has_search_path;
    
    -- Only alter if search_path is not already set
    IF NOT v_has_search_path THEN
      IF p_arguments IS NULL THEN
        EXECUTE format('ALTER FUNCTION public.%I() SET search_path = public', p_function_name);
      ELSE
        EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', p_function_name, p_arguments);
      END IF;
    END IF;
  END IF;
END;
$$;

-- ========================
-- SET SEARCH_PATH FOR ALL FUNCTIONS
-- ========================

-- Helper functions (SECURITY DEFINER)
SELECT public._set_function_search_path('is_tutor');
SELECT public._set_function_search_path('current_tutor_id');
SELECT public._set_function_search_path('is_student');
SELECT public._set_function_search_path('current_student_id');
SELECT public._set_function_search_path('is_adminstaff');
SELECT public._set_function_search_path('is_adminstaff_active');
SELECT public._set_function_search_path('is_staff');
SELECT public._set_function_search_path('current_staff_id');
SELECT public._set_function_search_path('user_role');

-- Utility functions
SELECT public._set_function_search_path('build_fuzzy_like', 'p_text text');
SELECT public._set_function_search_path('standardize_au_phone', 'phone text');
SELECT public._set_function_search_path('validate_phone_e164', 'phone text');
SELECT public._set_function_search_path('standardize_student_phone');
SELECT public._set_function_search_path('standardize_staff_phone');
SELECT public._set_function_search_path('standardize_parent_phone');
SELECT public._set_function_search_path('validate_topic_parent_subject');
SELECT public._set_function_search_path('sync_student_contact');
SELECT public._set_function_search_path('sync_staff_contact');
SELECT public._set_function_search_path('sync_parent_contact');
SELECT public._set_function_search_path('orphan_contact_on_student_delete');
SELECT public._set_function_search_path('orphan_contact_on_staff_delete');
SELECT public._set_function_search_path('orphan_contact_on_parent_delete');

-- Payment functions
SELECT public._set_function_search_path('get_latest_payment_attempts_by_student', 'p_student_id uuid');

-- Session sync functions
SELECT public._set_function_search_path('sync_sessions_on_class_property_change');
SELECT public._set_function_search_path('sync_staff_sessions_on_assignment');
SELECT public._set_function_search_path('sync_staff_sessions_on_unassignment');
SELECT public._set_function_search_path('sync_staff_sessions_on_assignment_update');
SELECT public._set_function_search_path('sync_student_sessions_on_enrollment');
SELECT public._set_function_search_path('sync_student_sessions_on_unenrollment');
SELECT public._set_function_search_path('sync_student_sessions_on_enrollment_update');
SELECT public._set_function_search_path('precreate_sessions', 'start_date date, end_date date, p_created_by uuid, p_class_id uuid');

-- Session attendance functions
SELECT public._set_function_search_path('set_sessions_students_planned_absence_logged_at');
SELECT public._set_function_search_path('set_sessions_students_rescheduled_at');
SELECT public._set_function_search_path('set_sessions_students_credited_at');
SELECT public._set_function_search_path('set_sessions_staff_planned_absence_logged_at');
SELECT public._set_function_search_path('set_sessions_staff_swapped_at');

-- Utility trigger functions
SELECT public._set_function_search_path('update_updated_at');
SELECT public._set_function_search_path('update_conversation_last_message');
SELECT public._set_function_search_path('update_message_templates_updated_at');

-- Auth functions
SELECT public._set_function_search_path('handle_new_user');
SELECT public._set_function_search_path('link_precreated_user');
SELECT public._set_function_search_path('prevent_dual_active_roles');
SELECT public._set_function_search_path('resend_confirmation_email', 'email_address text');
SELECT public._set_function_search_path('verify_email', 'user_email text');
SELECT public._set_function_search_path('set_claim', 'uid uuid, claim text, value jsonb');

-- Student subject functions
SELECT public._set_function_search_path('has_student_selected_subjects', 'student_id uuid');
SELECT public._set_function_search_path('get_subjects_for_student', 'p_curriculum text, p_year_level integer');
SELECT public._set_function_search_path('get_student_subjects', 'student_id uuid');

-- Formatting functions
SELECT public._set_function_search_path('staff_full_name_lower', 'p_first_name text, p_last_name text');
SELECT public._set_function_search_path('student_full_name_lower', 'p_first_name text, p_last_name text');
SELECT public._set_function_search_path('format_subject_short_name', 'p_curriculum text, p_year_level integer, p_name text');
SELECT public._set_function_search_path('format_class_short_name', 'p_day_of_week integer, p_start_time time without time zone, p_curriculum text, p_year_level integer, p_name text');
SELECT public._set_function_search_path('format_class_short_name', 'p_day_of_week integer, p_start_time time without time zone, p_curriculum subject_curriculum, p_year_level integer, p_name text');
SELECT public._set_function_search_path('format_class_short_name', 'p_day_of_week integer, p_start_time text, p_curriculum subject_curriculum, p_year_level integer, p_name text');
SELECT public._set_function_search_path('format_class_full_name', 'p_day_of_week integer, p_start_time time without time zone, p_end_time time without time zone, p_curriculum text, p_year_level integer, p_name text');
SELECT public._set_function_search_path('format_class_full_name', 'p_day_of_week integer, p_start_time time without time zone, p_end_time time without time zone, p_curriculum subject_curriculum, p_year_level integer, p_name text');
SELECT public._set_function_search_path('format_class_full_name', 'p_day_of_week integer, p_start_time text, p_end_time text, p_curriculum subject_curriculum, p_year_level integer, p_name text');

-- Mapping functions
SELECT public._set_function_search_path('map_tutor_to_id', 'first_name text, last_name text');
SELECT public._set_function_search_path('map_subject_to_id', 'subject_code text');

-- Utility functions
SELECT public._set_function_search_path('map_day_to_number', 'day_string text');
SELECT public._set_function_search_path('batch_update_topic_indices', 'updates jsonb');
SELECT public._set_function_search_path('log_student_absences', 'operations jsonb, logged_by_staff_id uuid');
SELECT public._set_function_search_path('add_enum_value', 'enum_type text, new_value text');

-- ========================
-- CLEANUP HELPER FUNCTION
-- ========================
DROP FUNCTION IF EXISTS public._set_function_search_path(TEXT, TEXT);

-- ========================
-- COMMENTS
-- ========================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_tutor' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    COMMENT ON FUNCTION public.is_tutor() IS 'Returns true if the current authenticated user is an active tutor or admin staff. Fixed search_path for security.';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_tutor_id' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    COMMENT ON FUNCTION public.current_tutor_id() IS 'Returns the staff ID for the current authenticated tutor or admin staff. Fixed search_path for security.';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_student' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    COMMENT ON FUNCTION public.is_student() IS 'Returns true if the current authenticated user is a student. Fixed search_path for security.';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_student_id' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    COMMENT ON FUNCTION public.current_student_id() IS 'Returns the student ID for the current authenticated user. Fixed search_path for security.';
  END IF;
END $$;
