-- Harden security/performance advisor findings:
-- 1) Auth-guard discontinue_student / re_enroll_student; drop unused add_enum_value
-- 2) Revoke anon EXECUTE on SECURITY DEFINER RPCs (keep public booking allowlist)
-- 3) Drop billing_duplicates_work
-- 4) Tighten note_document_edit_locks RLS to ADMINSTAFF
-- 5) Drop staff_notepad
-- 6) Fix auth_rls_initplan on slot_reservations + tutor_logs_parent_attendance
-- 7) Drop duplicate indexes

-- =============================================================================
-- 1) Auth-guard student status RPCs; drop unused add_enum_value
-- =============================================================================

CREATE OR REPLACE FUNCTION public.discontinue_student(
  p_student_id UUID,
  p_discontinued_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_status TEXT;
  v_active_enrollments_count INTEGER;
  v_future_non_class_sessions_count INTEGER;
  v_future_sessions JSONB;
  v_jwt_role TEXT := coalesce((SELECT auth.jwt() ->> 'role'), '');
  v_request_role TEXT := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '');
  -- service_role API calls, or internal SQL/triggers/cron (no PostgREST JWT role claim)
  v_is_elevated BOOLEAN :=
    v_jwt_role = 'service_role'
    OR v_request_role = 'service_role'
    OR (
      nullif(current_setting('request.jwt.claim.role', true), '') IS NULL
      AND nullif(current_setting('request.jwt.claims', true), '') IS NULL
    );
BEGIN
  IF NOT (
    v_is_elevated
    OR (SELECT public.is_adminstaff_active())
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Admins must discontinue as themselves (elevated callers may set requested_by).
  IF NOT v_is_elevated
     AND p_discontinued_by IS DISTINCT FROM (SELECT public.current_staff_id()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT status INTO v_student_status
  FROM students
  WHERE id = p_student_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student not found'
    );
  END IF;

  IF v_student_status = 'DISCONTINUED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student is already discontinued'
    );
  END IF;

  SELECT COUNT(*) INTO v_active_enrollments_count
  FROM classes_students
  WHERE student_id = p_student_id
    AND unenrolled_at IS NULL;

  IF v_active_enrollments_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unenroll student from classes first'
    );
  END IF;

  SELECT COUNT(*) INTO v_future_non_class_sessions_count
  FROM sessions_students ss
  JOIN sessions s ON s.id = ss.session_id
  LEFT JOIN classes_students cs ON cs.class_id = s.class_id
    AND cs.student_id = ss.student_id
    AND cs.enrolled_at <= s.start_at
    AND cs.unenrolled_at IS NOT NULL
    AND cs.unenrolled_at > s.start_at
  WHERE ss.student_id = p_student_id
    AND s.start_at > NOW()
    AND NOT (
      s.type = 'CLASS'
      AND cs.id IS NOT NULL
    );

  IF v_future_non_class_sessions_count > 0 THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'type', s.type,
        'start_at', s.start_at,
        'subject_id', s.subject_id
      )
    ) INTO v_future_sessions
    FROM sessions_students ss
    JOIN sessions s ON s.id = ss.session_id
    LEFT JOIN classes_students cs ON cs.class_id = s.class_id
      AND cs.student_id = ss.student_id
      AND cs.enrolled_at <= s.start_at
      AND cs.unenrolled_at IS NOT NULL
      AND cs.unenrolled_at > s.start_at
    WHERE ss.student_id = p_student_id
      AND s.start_at > NOW()
      AND NOT (
        s.type = 'CLASS'
        AND cs.id IS NOT NULL
      );

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student has future sessions',
      'sessions', COALESCE(v_future_sessions, '[]'::jsonb)
    );
  END IF;

  UPDATE students
  SET status = 'DISCONTINUED',
      discontinued_by = p_discontinued_by,
      updated_at = NOW()
  WHERE id = p_student_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Student discontinued successfully'
  );
END;
$$;

COMMENT ON FUNCTION public.discontinue_student IS
  'Discontinue a student. Requires ADMINSTAFF or service_role. Blocks if student has active class enrollments or future non-class sessions.';

CREATE OR REPLACE FUNCTION public.re_enroll_student(
  p_student_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_status TEXT;
BEGIN
  IF NOT (SELECT public.is_adminstaff_active()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT status INTO v_student_status
  FROM students
  WHERE id = p_student_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student not found'
    );
  END IF;

  IF v_student_status != 'DISCONTINUED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Student is not discontinued'
    );
  END IF;

  UPDATE students
  SET status = 'ACTIVE',
      updated_at = NOW()
  WHERE id = p_student_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Student re-enrolled successfully'
  );
END;
$$;

COMMENT ON FUNCTION public.re_enroll_student IS
  'Re-enroll a discontinued student. Requires ADMINSTAFF.';

DROP FUNCTION IF EXISTS public.add_enum_value(text, text);

-- =============================================================================
-- 2) Revoke anon (and default PUBLIC) EXECUTE on SECURITY DEFINER functions
-- =============================================================================

DO $$
DECLARE
  r RECORD;
  service_only text[] := ARRAY[
    'auth_user_exists_by_email',
    'get_service_role_key',
    'get_supabase_url',
    'get_billing_cron_secret',
    'try_acquire_billing_runner_lock',
    'release_billing_runner_lock',
    'complete_student_exit_request',
    'apply_scheduled_student_discontinuations',
    'require_student_exit_request_dates',
    'get_ucat_free_quota_reset_boundary',
    'use_ucat_free_quota_reset_entitlement',
    'count_submitted_attempts_today',
    'maybe_qualify_ucat_free_referral',
    'qualify_ucat_paid_referral'
  ];
BEGIN
  FOR r IN
    SELECT
      p.oid::regprocedure AS sig,
      p.proname,
      p.prorettype::regtype::text AS rettype
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);

    -- Trigger functions are not called via PostgREST.
    IF r.rettype = 'trigger' THEN
      CONTINUE;
    END IF;

    IF r.proname = ANY (service_only) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
  END LOOP;
END $$;

-- Intentional public booking / subject search RPCs (+ helpers used by them)
GRANT EXECUTE ON FUNCTION public.create_public_trial_booking(
  text, text, text, text, text, timestamptz, timestamptz, text, integer, uuid[], text, text, text, text
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_available_slots(
  date, date, public.session_type, uuid, integer, boolean
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.search_subjects_public(
  text, integer[], text[], text[], text[], integer, integer, text, boolean
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.format_subject_long_name(text, integer, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.format_subject_short_name(text, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_fuzzy_like(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.discontinue_student(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discontinue_student(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.re_enroll_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.re_enroll_student(uuid) TO authenticated;

-- =============================================================================
-- 3) Drop billing_duplicates_work scratch table
-- =============================================================================

DROP TABLE IF EXISTS public.billing_duplicates_work;

-- =============================================================================
-- 4) Tighten note_document_edit_locks RLS
-- =============================================================================

DROP POLICY IF EXISTS "Authenticated users can read note document edit locks"
  ON public.note_document_edit_locks;
DROP POLICY IF EXISTS "Authenticated users can create note document edit locks"
  ON public.note_document_edit_locks;
DROP POLICY IF EXISTS "Authenticated users can update note document edit locks"
  ON public.note_document_edit_locks;
DROP POLICY IF EXISTS "Authenticated users can delete note document edit locks"
  ON public.note_document_edit_locks;

CREATE POLICY "Admin staff can read note document edit locks"
  ON public.note_document_edit_locks
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_adminstaff_active()));

CREATE POLICY "Admin staff can create note document edit locks"
  ON public.note_document_edit_locks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.is_adminstaff_active())
    AND locked_by = (SELECT public.current_staff_id())
    AND EXISTS (
      SELECT 1
      FROM public.notes_documents nd
      WHERE nd.id = note_id
    )
  );

-- Allow takeover: any admin may update a lock row, but must set locked_by to self.
CREATE POLICY "Admin staff can update note document edit locks"
  ON public.note_document_edit_locks
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.is_adminstaff_active())
    AND EXISTS (
      SELECT 1
      FROM public.notes_documents nd
      WHERE nd.id = note_id
    )
  )
  WITH CHECK (
    locked_by = (SELECT public.current_staff_id())
  );

CREATE POLICY "Admin staff can delete own note document edit locks"
  ON public.note_document_edit_locks
  FOR DELETE
  TO authenticated
  USING (
    (SELECT public.is_adminstaff_active())
    AND locked_by = (SELECT public.current_staff_id())
  );

-- =============================================================================
-- 5) Drop staff_notepad
-- =============================================================================

DROP TABLE IF EXISTS public.staff_notepad CASCADE;

-- =============================================================================
-- 6) Fix auth_rls_initplan policies
-- =============================================================================

DROP POLICY IF EXISTS "Users can create reservations" ON public.slot_reservations;
CREATE POLICY "Users can create reservations"
  ON public.slot_reservations
  FOR INSERT
  TO authenticated
  WITH CHECK (reserved_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can read own reservations" ON public.slot_reservations;
CREATE POLICY "Users can read own reservations"
  ON public.slot_reservations
  FOR SELECT
  TO authenticated
  USING (reserved_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own reservations" ON public.slot_reservations;
CREATE POLICY "Users can delete own reservations"
  ON public.slot_reservations
  FOR DELETE
  TO authenticated
  USING (reserved_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to slot_reservations"
  ON public.slot_reservations;
CREATE POLICY "ADMINSTAFF full access to slot_reservations"
  ON public.slot_reservations
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "Tutors can access parent attendance for their logs"
  ON public.tutor_logs_parent_attendance;
CREATE POLICY "Tutors can access parent attendance for their logs"
  ON public.tutor_logs_parent_attendance
  FOR ALL
  TO authenticated
  USING (
    tutor_log_id IN (
      SELECT tutor_logs.id
      FROM tutor_logs
      WHERE tutor_logs.created_by IN (
        SELECT staff.id
        FROM staff
        WHERE staff.user_id = (SELECT auth.uid())
          AND staff.role = 'TUTOR'
          AND staff.status = 'ACTIVE'
      )
    )
  )
  WITH CHECK (
    tutor_log_id IN (
      SELECT tutor_logs.id
      FROM tutor_logs
      WHERE tutor_logs.created_by IN (
        SELECT staff.id
        FROM staff
        WHERE staff.user_id = (SELECT auth.uid())
          AND staff.role = 'TUTOR'
          AND staff.status = 'ACTIVE'
      )
    )
  );

DROP POLICY IF EXISTS "ADMINSTAFF full access to tutor_logs_parent_attendance"
  ON public.tutor_logs_parent_attendance;
CREATE POLICY "ADMINSTAFF full access to tutor_logs_parent_attendance"
  ON public.tutor_logs_parent_attendance
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- =============================================================================
-- 7) Drop duplicate indexes
-- =============================================================================

DROP INDEX IF EXISTS public.idx_staff_subjects_staff_subject;
DROP INDEX IF EXISTS public.idx_students_subjects_student_subject;
DROP INDEX IF EXISTS public.idx_tutor_logs_topics_files_students_student_id;
DROP INDEX IF EXISTS public.idx_tutor_logs_topics_students_student_id;
