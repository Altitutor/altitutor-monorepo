-- Admin scheduling is deliberate: availability and participant conventions are
-- advisory. Keep the six manual meeting types separate from recurring offerings.
CREATE FUNCTION public.create_admin_meeting(
  p_type public.session_type,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_student_ids uuid[] DEFAULT '{}',
  p_parent_ids uuid[] DEFAULT '{}',
  p_staff_ids uuid[] DEFAULT '{}',
  p_subject_id uuid DEFAULT NULL,
  p_original_session_id uuid DEFAULT NULL,
  p_receiver_staff_ids uuid[] DEFAULT '{}'
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_id uuid;
  v_actor uuid;
BEGIN
  IF NOT (SELECT public.is_adminstaff_active()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Active AdminStaff access required';
  END IF;
  SELECT id INTO STRICT v_actor FROM public.staff WHERE user_id = (SELECT auth.uid());
  IF p_type IS NULL OR p_type NOT IN ('DRAFTING','TRIAL_SESSION','SUBSIDY_INTERVIEW','STAFF_INTERVIEW','CHECK_IN','ADMIN_MEETING') THEN
    RAISE EXCEPTION 'Unsupported manual meeting type';
  END IF;
  IF p_start_at IS NULL OR p_end_at IS NULL OR NOT isfinite(p_start_at) OR NOT isfinite(p_end_at) OR p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'Choose a valid start time and positive duration';
  END IF;
  IF p_original_session_id IS NULL THEN
    INSERT INTO public.sessions (id,type,start_at,end_at,subject_id,status)
    VALUES (gen_random_uuid(),p_type,p_start_at,p_end_at,p_subject_id,'ACTIVE') RETURNING id INTO v_id;
  ELSE
    -- Preserve identity, attendance history and durable booking links on reschedule.
    SELECT id INTO v_id FROM public.sessions
    WHERE id=p_original_session_id AND type=p_type AND class_id IS NULL AND admin_shift_id IS NULL
    FOR UPDATE;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Manual meeting not found'; END IF;
    UPDATE public.sessions SET start_at=p_start_at,end_at=p_end_at,subject_id=p_subject_id WHERE id=v_id;
  END IF;
  IF p_original_session_id IS NOT NULL THEN
    -- Retain attendance/billing history through the existing planned-absence model.
    IF EXISTS (SELECT 1 FROM public.sessions_students WHERE session_id=v_id AND NOT planned_absence AND NOT (student_id=ANY(COALESCE(p_student_ids,'{}')))) THEN
      RAISE EXCEPTION 'Remove existing students through Log absence before rescheduling';
    END IF;
    UPDATE public.sessions_staff SET planned_absence=true, planned_absence_logged_at=now(), planned_absence_logged_by=v_actor
    WHERE session_id=v_id AND NOT (staff_id=ANY(COALESCE(p_staff_ids,'{}'))) AND NOT planned_absence;
    DELETE FROM public.sessions_parents WHERE session_id=v_id AND NOT (parent_id=ANY(COALESCE(p_parent_ids,'{}')));
  END IF;
  INSERT INTO public.sessions_students(id,session_id,student_id,created_by)
  SELECT gen_random_uuid(),v_id,person_id,v_actor FROM (SELECT DISTINCT unnest(p_student_ids) person_id) people
  ON CONFLICT (session_id,student_id) DO UPDATE SET planned_absence=false, planned_absence_logged_at=NULL, planned_absence_logged_by=NULL;
  INSERT INTO public.sessions_parents(session_id,parent_id,created_by)
  SELECT v_id,person_id,v_actor FROM (SELECT DISTINCT unnest(p_parent_ids) person_id) people
  WHERE NOT EXISTS (SELECT 1 FROM public.sessions_parents x WHERE x.session_id=v_id AND x.parent_id=person_id);
  INSERT INTO public.sessions_staff(id,session_id,staff_id,type,created_by)
  SELECT gen_random_uuid(),v_id,person_id,
    CASE WHEN p_type='CHECK_IN' AND person_id=ANY(p_receiver_staff_ids) THEN 'CHECK_IN_RECEIVER'
         WHEN p_type='TRIAL_SESSION' OR (p_type='STAFF_INTERVIEW' AND person_id=ANY(p_receiver_staff_ids)) THEN 'TRIAL_TUTOR'
         WHEN p_type='CHECK_IN' THEN 'CHECK_IN_HOST'
         ELSE 'MAIN_TUTOR' END,v_actor
  FROM (SELECT DISTINCT unnest(p_staff_ids) person_id) people
  ON CONFLICT (session_id,staff_id) DO UPDATE SET planned_absence=false, planned_absence_logged_at=NULL, planned_absence_logged_by=NULL, type=EXCLUDED.type;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_admin_meeting(public.session_type,timestamptz,timestamptz,uuid[],uuid[],uuid[],uuid,uuid,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_admin_meeting(public.session_type,timestamptz,timestamptz,uuid[],uuid[],uuid[],uuid,uuid,uuid[]) TO authenticated;

CREATE FUNCTION public.admin_meeting_warnings(
  p_type public.session_type, p_start_at timestamptz, p_end_at timestamptz,
  p_staff_ids uuid[], p_subject_id uuid DEFAULT NULL, p_original_session_id uuid DEFAULT NULL
) RETURNS TABLE(staff_id uuid, reason text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT (SELECT public.is_adminstaff_active()) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Active AdminStaff access required';
  END IF;
  IF p_start_at IS NULL OR p_end_at IS NULL OR p_end_at<=p_start_at THEN RETURN; END IF;
  RETURN QUERY
  WITH selected AS (SELECT s.* FROM public.staff s WHERE s.id=ANY(p_staff_ids)),
  local_time AS (SELECT p_start_at AT TIME ZONE 'Australia/Adelaide' a, p_end_at AT TIME ZONE 'Australia/Adelaide' b),
  settings AS (SELECT COALESCE(max(setting_value::integer) FILTER (WHERE setting_key='booking_buffer_minutes'),0) buffer FROM public.booking_settings WHERE setting_key='booking_buffer_minutes')
  SELECT s.id, 'Staff is not active' FROM selected s WHERE s.status<>'ACTIVE'
  UNION ALL
  SELECT s.id, 'Outside declared availability' FROM selected s CROSS JOIN local_time t
  WHERE NOT COALESCE(CASE extract(isodow FROM t.a)::integer
    WHEN 1 THEN s.availability_monday WHEN 2 THEN s.availability_tuesday
    WHEN 3 THEN s.availability_wednesday WHEN 4 THEN s.availability_thursday WHEN 5 THEN s.availability_friday
    WHEN 6 THEN (CASE WHEN t.a::time<'12:00' THEN s.availability_saturday_am ELSE s.availability_saturday_pm END)
      AND (CASE WHEN t.b::time>'12:00' THEN s.availability_saturday_pm ELSE s.availability_saturday_am END)
    WHEN 7 THEN (CASE WHEN t.a::time<'12:00' THEN s.availability_sunday_am ELSE s.availability_sunday_pm END)
      AND (CASE WHEN t.b::time>'12:00' THEN s.availability_sunday_pm ELSE s.availability_sunday_am END) END,false)
  AND NOT EXISTS (SELECT 1 FROM public.sessions x JOIN public.sessions_staff ss ON ss.session_id=x.id WHERE ss.staff_id=s.id AND NOT ss.planned_absence AND x.status='ACTIVE' AND x.type='ADMIN_SHIFT' AND x.start_at<=p_start_at AND x.end_at>=p_end_at)
  UNION ALL
  SELECT s.id, 'Outside opening hours' FROM selected s CROSS JOIN local_time t
  WHERE NOT EXISTS (SELECT 1 FROM public.opening_hours h WHERE h.is_active AND h.day_of_week=extract(dow FROM t.a)::integer AND h.start_time<=t.a::time AND h.end_time>=t.b::time AND t.a::date=t.b::date)
  UNION ALL
  SELECT s.id, 'Staff has a blockout' FROM selected s WHERE EXISTS (SELECT 1 FROM public.booking_staff_unavailability b WHERE b.staff_id=s.id AND b.start_at<p_end_at AND b.end_at>p_start_at)
  UNION ALL
  SELECT s.id, 'Overlaps another session or its booking buffer' FROM selected s CROSS JOIN settings cfg
  WHERE EXISTS (SELECT 1 FROM public.sessions x JOIN public.sessions_staff ss ON ss.session_id=x.id WHERE ss.staff_id=s.id AND NOT ss.planned_absence AND x.status='ACTIVE' AND x.type<>'ADMIN_SHIFT' AND x.id IS DISTINCT FROM p_original_session_id AND x.start_at<p_end_at+make_interval(mins=>cfg.buffer) AND x.end_at>p_start_at-make_interval(mins=>cfg.buffer))
  UNION ALL
  SELECT s.id, 'Overlaps an active reservation' FROM selected s WHERE EXISTS (SELECT 1 FROM public.slot_reservations r WHERE (r.staff_id=s.id OR r.staff_id IS NULL) AND r.expires_at>now() AND r.start_at<p_end_at AND r.end_at>p_start_at)
  UNION ALL
  SELECT s.id, 'Not marked available for this meeting type' FROM selected s WHERE
    (p_type='DRAFTING' AND NOT COALESCE(s.drafting_availability,false)) OR
    (p_type='TRIAL_SESSION' AND NOT COALESCE(s.trial_session_availability,false)) OR
    (p_type='SUBSIDY_INTERVIEW' AND NOT COALESCE(s.subsidy_interview_availability,false))
  UNION ALL
  SELECT s.id, 'Not assigned to this subject' FROM selected s WHERE p_type='DRAFTING' AND p_subject_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.staff_subjects ss WHERE ss.staff_id=s.id AND ss.subject_id=p_subject_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_meeting_warnings(public.session_type,timestamptz,timestamptz,uuid[],uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_meeting_warnings(public.session_type,timestamptz,timestamptz,uuid[],uuid,uuid) TO authenticated;
