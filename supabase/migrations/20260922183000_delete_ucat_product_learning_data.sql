-- Product account deletion removes Altitutor UCAT learning data and closes that
-- product relationship. The Student row, invoices, and attendance stay.

CREATE OR REPLACE FUNCTION public.delete_ucat_product_learning_data(
  p_student_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_student_id IS NULL THEN
    RAISE EXCEPTION 'Student is required';
  END IF;

  UPDATE public.ucat_student_study_plan_tasks
  SET source_task_id = NULL
  WHERE student_id = p_student_id;

  DELETE FROM public.ucat_student_study_plan_tasks WHERE student_id = p_student_id;
  DELETE FROM public.ucat_student_study_plan_exposure_debts WHERE student_id = p_student_id;
  DELETE FROM public.ucat_student_study_plan_generations WHERE student_id = p_student_id;
  DELETE FROM public.ucat_student_study_plan_profiles WHERE student_id = p_student_id;
  DELETE FROM public.ucat_student_next_steps WHERE student_id = p_student_id;
  DELETE FROM public.ucat_student_learning_module_block_progress WHERE student_id = p_student_id;
  DELETE FROM public.ucat_student_learning_module_progress WHERE student_id = p_student_id;
  DELETE FROM public.ucat_student_session_resource_progress WHERE student_id = p_student_id;
  DELETE FROM public.ucat_student_preparation_refresh_requests WHERE student_id = p_student_id;
  DELETE FROM public.ucat_student_preparation_section_states WHERE student_id = p_student_id;
  DELETE FROM public.ucat_preparation_snapshots WHERE student_id = p_student_id;
  DELETE FROM public.ucat_score_projection_snapshots WHERE student_id = p_student_id;

  DELETE FROM public.student_question_attempts WHERE student_id = p_student_id;
  DELETE FROM public.student_question_set_attempts WHERE student_id = p_student_id;
  DELETE FROM public.student_ucat_mock_attempts WHERE student_id = p_student_id;
  DELETE FROM public.student_practice_sessions WHERE student_id = p_student_id;
  DELETE FROM public.student_skill_trainer_attempts WHERE student_id = p_student_id;
  DELETE FROM public.student_ucat_attempt_reviews WHERE student_id = p_student_id;
  DELETE FROM public.student_ucat_completed_benchmark_assets WHERE student_id = p_student_id;
  DELETE FROM public.student_ucat_content_ratings WHERE student_id = p_student_id;
  DELETE FROM public.student_ucat_question_progress WHERE student_id = p_student_id;
  DELETE FROM public.student_ucat_score_projection_evidence WHERE student_id = p_student_id;
  DELETE FROM public.ucat_active_exam_attempts WHERE student_id = p_student_id;

  DELETE FROM public.ucat_communication_consent_events WHERE student_id = p_student_id;
  DELETE FROM public.ucat_communication_preferences WHERE student_id = p_student_id;
  DELETE FROM public.ucat_email_program_assignments WHERE student_id = p_student_id;
  DELETE FROM public.ucat_email_delivery_ledger WHERE student_id = p_student_id;
  DELETE FROM public.ucat_transactional_email_outbox WHERE student_id = p_student_id;
  DELETE FROM public.ucat_free_quota_reset_events WHERE student_id = p_student_id;
  DELETE FROM public.ucat_free_quota_reset_entitlements WHERE student_id = p_student_id;
  DELETE FROM public.ucat_checkout_holds WHERE student_id = p_student_id;
  DELETE FROM public.student_product_acquisition_attributions WHERE student_id = p_student_id;
  DELETE FROM public.ucat_subscription_journey_events WHERE student_id = p_student_id;

  UPDATE public.student_online_product_relationships
  SET closed_at = now()
  WHERE student_id = p_student_id
    AND product = 'UCAT_WEB'
    AND closed_at IS NULL;

  UPDATE public.students
  SET
    ucat_signup_completed_at = NULL,
    ucat_onboarding_completed_at = NULL,
    ucat_signup_step = 1,
    ucat_initial_familiarity = NULL,
    updated_at = now()
  WHERE id = p_student_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_ucat_product_learning_data(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_ucat_product_learning_data(uuid)
  TO service_role;

COMMENT ON FUNCTION public.delete_ucat_product_learning_data(uuid) IS
  'Closes Altitutor UCAT and deletes that product''s learning data. Does not delete the Student, invoices, attendance, or billing records.';
