ALTER TABLE public.onboarding_journeys
  ADD COLUMN enquiry_parent_id uuid REFERENCES public.parents(id);
ALTER TABLE public.onboarding_journeys DROP CONSTRAINT onboarding_identity;
ALTER TABLE public.onboarding_journeys ADD CONSTRAINT onboarding_identity CHECK (
  student_id IS NOT NULL OR contact_id IS NOT NULL OR enquiry_parent_id IS NOT NULL
  OR nullif(btrim(enquiry_email),'') IS NOT NULL
);

CREATE TABLE public.onboarding_enquiry_messages (
  journey_id uuid NOT NULL REFERENCES public.onboarding_journeys(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  PRIMARY KEY (journey_id,message_id)
);
CREATE INDEX onboarding_enquiry_messages_source ON public.onboarding_enquiry_messages(message_id);
ALTER TABLE public.onboarding_enquiry_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.onboarding_enquiry_messages FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.onboarding_enquiry_messages TO authenticated;
CREATE POLICY "Active admins read enquiry messages" ON public.onboarding_enquiry_messages
  FOR SELECT TO authenticated USING ((SELECT public.is_adminstaff_active()));
CREATE POLICY "Active admins link enquiry messages" ON public.onboarding_enquiry_messages
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_adminstaff_active()));

-- The receipt commits with the journeys and bookings. A retried request or a
-- second submission from the same inbound message cannot duplicate the family.
CREATE TABLE public.onboarding_enquiry_submissions (
  id uuid PRIMARY KEY,
  request_hash text NOT NULL,
  source_kind text CHECK (source_kind IN ('email','message')),
  source_id text,
  result jsonb NOT NULL,
  CHECK ((source_kind IS NULL) = (source_id IS NULL)),
  UNIQUE (source_kind,source_id)
);
ALTER TABLE public.onboarding_enquiry_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.onboarding_enquiry_submissions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.onboarding_enquiry_submissions TO authenticated;
CREATE POLICY "Active admins read enquiry submissions" ON public.onboarding_enquiry_submissions
  FOR SELECT TO authenticated USING ((SELECT public.is_adminstaff_active()));
CREATE POLICY "Active admins record enquiry submissions" ON public.onboarding_enquiry_submissions
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_adminstaff_active()));

CREATE FUNCTION public.onboarding_enquiry_source(p_kind text,p_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE
  v_handle text;
  v_received timestamptz;
  v_parent uuid;
  v_contact uuid;
  v_kind text;
  v_label text;
  v_matches integer;
BEGIN
  IF NOT coalesce((SELECT public.is_adminstaff_active()),false) THEN
    RAISE EXCEPTION 'Active AdminStaff access required' USING ERRCODE='42501';
  END IF;
  IF p_kind='email' THEN
    SELECT lower(btrim(e.sender)),e.occurred_at INTO v_handle,v_received
    FROM public.onboarding_emails e JOIN public.email_messages m ON m.id=e.id
    WHERE e.id=p_id AND e.direction='inbound' AND NOT m.removed
      AND NOT coalesce((m.data->>'draft')::boolean,false);
    IF NOT FOUND OR nullif(v_handle,'') IS NULL THEN RETURN NULL; END IF;

    SELECT count(*), min(p.record_type), min(p.record_id::text)::uuid
    INTO v_matches,v_kind,v_parent FROM public.email_people_for_address(v_handle) p;
    IF v_matches>1 OR (v_matches=1 AND v_kind<>'parent') THEN RETURN NULL; END IF;
    SELECT nullif(concat_ws(' ',first_name,last_name),'') INTO v_label
    FROM public.parents WHERE id=v_parent;
  ELSIF p_kind='message' THEN
    SELECT lower(btrim(m.from_number_e164)),coalesce(m.received_at,m.created_at)
    INTO v_handle,v_received
    FROM public.messages m
    WHERE m.id=p_id::uuid AND m.direction='INBOUND' AND NOT coalesce(m.is_reaction,false);
    IF NOT FOUND OR nullif(v_handle,'') IS NULL THEN RETURN NULL; END IF;

    -- In a group use the message sender, never another participant or a
    -- contact inferred from the rest of the conversation.
    SELECT count(*),min(c.id::text)::uuid,min(c.contact_type),min(c.parent_id::text)::uuid
    INTO v_matches,v_contact,v_kind,v_parent FROM public.contacts c
    WHERE c.retired_at IS NULL AND (c.phone_e164=v_handle OR lower(btrim(c.email))=v_handle);
    IF v_matches>1 OR (v_matches=1 AND v_kind NOT IN ('LEAD','PARENT')) THEN RETURN NULL; END IF;
    SELECT nullif(concat_ws(' ',first_name,last_name),'') INTO v_label
    FROM public.parents WHERE id=v_parent;
  ELSE
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object('handle',v_handle,'receivedAt',v_received,
    'contactId',v_contact,'parentId',v_parent,'label',coalesce(v_label,v_handle));
END;
$$;
REVOKE ALL ON FUNCTION public.onboarding_enquiry_source(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.onboarding_enquiry_source(text,text) TO authenticated;

CREATE FUNCTION public.create_onboarding_enquiry(p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  v_request_id uuid := (p_request->>'requestId')::uuid;
  v_request_hash text := encode(sha256(convert_to(p_request::text,'UTF8')),'hex');
  v_saved_hash text;
  v_source_kind text := p_request->'source'->>'kind';
  v_source_id text := p_request->'source'->>'id';
  v_children jsonb := coalesce(p_request->'children','[]'::jsonb);
  v_trials jsonb := coalesce(p_request->'trials','[]'::jsonb);
  v_assignee uuid := (p_request->>'assigneeId')::uuid;
  v_family_id uuid := (p_request->>'familyJourneyId')::uuid;
  v_family public.onboarding_journeys%ROWTYPE;
  v_source jsonb;
  v_received timestamptz := now();
  v_contact uuid;
  v_parent uuid;
  v_email text;
  v_phone text;
  v_label text;
  v_person jsonb;
  v_trial jsonb;
  v_student uuid;
  v_journey uuid;
  v_session uuid;
  v_action text;
  v_evidence jsonb;
  v_journey_row public.onboarding_journeys%ROWTYPE;
  v_students uuid[] := '{}';
  v_scheduled uuid[] := '{}';
  v_roster uuid[];
  v_journeys uuid[] := '{}';
  v_sessions uuid[] := '{}';
  v_result jsonb;
BEGIN
  IF NOT coalesce((SELECT public.is_adminstaff_active()),false) THEN
    RAISE EXCEPTION 'Active AdminStaff access required' USING ERRCODE='42501';
  END IF;
  IF v_request_id IS NULL OR (v_source_kind IS NULL) <> (v_source_id IS NULL)
    OR (v_source_kind IS NOT NULL AND v_family_id IS NOT NULL)
    OR jsonb_typeof(v_children)<>'array' OR jsonb_array_length(v_children)>20
    OR jsonb_typeof(v_trials)<>'array' OR jsonb_array_length(v_trials)>20 THEN
    RAISE EXCEPTION 'Invalid enquiry details';
  END IF;

  PERFORM pg_advisory_xact_lock(279,hashtext(v_request_id::text));
  SELECT result,request_hash INTO v_result,v_saved_hash
  FROM public.onboarding_enquiry_submissions WHERE id=v_request_id;
  IF FOUND THEN
    IF v_saved_hash<>v_request_hash THEN
      RAISE EXCEPTION 'This enquiry was already saved with different details. Check the Trial queue before trying again';
    END IF;
    RETURN v_result;
  END IF;
  IF v_source_kind IS NOT NULL THEN
    IF v_source_kind='message' THEN v_source_id := (v_source_id::uuid)::text; END IF;
    PERFORM pg_advisory_xact_lock(280,hashtext(v_source_kind || ':' || v_source_id));
    SELECT result INTO v_result FROM public.onboarding_enquiry_submissions
    WHERE source_kind=v_source_kind AND source_id=v_source_id;
    IF FOUND THEN RAISE EXCEPTION 'An enquiry has already been created from this message'; END IF;
    v_source := public.onboarding_enquiry_source(v_source_kind,v_source_id);
    IF v_source IS NULL THEN RAISE EXCEPTION 'Choose an eligible incoming message'; END IF;
    v_received := (v_source->>'receivedAt')::timestamptz;
    v_contact := (v_source->>'contactId')::uuid;
    IF (v_source->>'handle') LIKE '%@%' THEN v_email := v_source->>'handle';
    ELSE v_phone := v_source->>'handle';
    END IF;
  ELSIF v_family_id IS NOT NULL THEN
    SELECT * INTO v_family FROM public.onboarding_journeys
    WHERE id=v_family_id AND student_id IS NULL AND closed_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Open family enquiry not found'; END IF;
    IF jsonb_array_length(v_children)=0 THEN RAISE EXCEPTION 'Add a child to this family enquiry'; END IF;
    v_contact := v_family.contact_id;
    v_email := v_family.enquiry_email;
    v_received := v_family.enquiry_at;
    v_assignee := coalesce(v_assignee, (
      SELECT assignee_id FROM public.onboarding_action_preferences
      WHERE journey_id=v_family_id AND action_key='book_trial'
    ));
  ELSE
    v_email := nullif(lower(btrim(p_request->>'email')),'');
    v_phone := nullif(btrim(p_request->>'phone'),'');
  END IF;
  IF v_assignee IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.staff WHERE id=v_assignee AND deleted_at IS NULL AND status='ACTIVE'
  ) THEN RAISE EXCEPTION 'Choose an active staff member'; END IF;

  v_person := p_request->'parent';
  IF v_person IS NULL THEN
    v_parent := v_family.enquiry_parent_id;
  ELSIF v_person->>'kind'='existing' THEN
    SELECT id INTO v_parent FROM public.parents
    WHERE id=(v_person->>'id')::uuid AND deleted_at IS NULL FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Parent not found'; END IF;
  ELSIF v_person->>'kind'='new' THEN
    IF nullif(btrim(v_person->>'firstName'),'') IS NULL THEN RAISE EXCEPTION 'Enter the Parent name'; END IF;
    INSERT INTO public.parents (id,first_name,last_name,email,phone)
    VALUES ((v_person->>'id')::uuid,btrim(v_person->>'firstName'),coalesce(btrim(v_person->>'lastName'),''),
      nullif(lower(btrim(v_person->>'email')),''),nullif(btrim(v_person->>'phone'),''))
    RETURNING id INTO v_parent;
  ELSIF v_person IS NOT NULL AND v_person<>'null'::jsonb THEN
    RAISE EXCEPTION 'Choose a valid Parent';
  END IF;

  IF v_contact IS NULL AND v_phone IS NOT NULL THEN
    IF v_phone !~ '^\+[1-9][0-9]{7,14}$' THEN RAISE EXCEPTION 'Use an international phone number'; END IF;
    INSERT INTO public.contacts(phone_e164,contact_type) VALUES(v_phone,'LEAD')
    ON CONFLICT (phone_e164) DO NOTHING;
    SELECT id INTO v_contact FROM public.contacts WHERE phone_e164=v_phone AND retired_at IS NULL;
  END IF;

  -- Lock existing Students in a consistent order before finding or creating
  -- their open journeys. A new child gets one ID even across request retries.
  FOR v_person IN SELECT value FROM jsonb_array_elements(v_children) ORDER BY value->>'id' LOOP
    v_student := (v_person->>'id')::uuid;
    IF v_student IS NULL OR v_student=ANY(v_students) THEN RAISE EXCEPTION 'Choose each child once'; END IF;
    IF v_person->>'kind'='new' THEN
      IF nullif(btrim(v_person->>'firstName'),'') IS NULL THEN RAISE EXCEPTION 'Enter each child’s name'; END IF;
      INSERT INTO public.students (id,first_name,last_name,status)
      VALUES (v_student,btrim(v_person->>'firstName'),coalesce(btrim(v_person->>'lastName'),''),NULL);
    ELSIF v_person->>'kind'<>'existing' OR v_person->>'kind' IS NULL THEN
      RAISE EXCEPTION 'Choose a valid Student';
    END IF;
    SELECT btrim(concat_ws(' ',first_name,last_name)) INTO v_label
    FROM public.students WHERE id=v_student AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;

    IF v_parent IS NOT NULL AND v_person->>'kind'='new' THEN
      INSERT INTO public.parents_students (parent_id,student_id) VALUES(v_parent,v_student)
      ON CONFLICT (parent_id,student_id) DO NOTHING;
    END IF;
    SELECT id INTO v_journey FROM public.onboarding_journeys
    WHERE student_id=v_student AND closed_at IS NULL FOR UPDATE;
    IF v_journey IS NULL THEN
      INSERT INTO public.onboarding_journeys (student_id,contact_id,enquiry_parent_id,label,enquiry_email,enquiry_at,historical,is_returning)
      VALUES(v_student,v_contact,v_parent,v_label,v_email,v_received,coalesce(v_family.historical,false),
        EXISTS(SELECT 1 FROM public.onboarding_journeys WHERE student_id=v_student AND closed_at IS NOT NULL))
      RETURNING id INTO v_journey;
    ELSE
      UPDATE public.onboarding_journeys
      SET enquiry_at=CASE WHEN NOT historical AND enquiry_at>v_received THEN v_received ELSE enquiry_at END,
          enquiry_parent_id=coalesce(v_parent,enquiry_parent_id)
      WHERE id=v_journey AND (
        (NOT historical AND enquiry_at>v_received)
        OR (v_parent IS NOT NULL AND enquiry_parent_id IS DISTINCT FROM v_parent)
      );
    END IF;
    v_students := array_append(v_students,v_student);
    v_journeys := array_append(v_journeys,v_journey);
  END LOOP;

  IF cardinality(v_students)=0 THEN
    v_label := coalesce(nullif(btrim(p_request->>'label'),''),v_source->>'label',
      (SELECT btrim(concat_ws(' ',first_name,last_name)) FROM public.parents WHERE id=v_parent),v_email,v_phone);
    IF nullif(v_label,'') IS NULL OR (v_contact IS NULL AND v_parent IS NULL AND v_email IS NULL) THEN
      RAISE EXCEPTION 'Link a Student, Parent, phone number or email address';
    END IF;
    INSERT INTO public.onboarding_journeys (contact_id,enquiry_parent_id,label,enquiry_email,enquiry_at)
    VALUES(v_contact,v_parent,v_label,v_email,v_received) RETURNING id INTO v_journey;
    v_journeys := ARRAY[v_journey];
  END IF;

  FOR v_trial IN SELECT value FROM jsonb_array_elements(v_trials) LOOP
    v_roster := ARRAY(SELECT DISTINCT value::uuid FROM jsonb_array_elements_text(v_trial->'studentIds'));
    IF cardinality(v_roster)=0 OR NOT (v_roster<@v_students) OR v_roster&&v_scheduled THEN
      RAISE EXCEPTION 'Choose unbooked children from this enquiry for each trial';
    END IF;
    v_session := public.create_admin_meeting(
      'TRIAL_SESSION',(v_trial->>'startAt')::timestamptz,(v_trial->>'endAt')::timestamptz,v_roster,
      ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(v_trial->'parentIds')),
      ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(v_trial->'staffIds'))
    );
    v_sessions := array_append(v_sessions,v_session);
    v_scheduled := v_scheduled||v_roster;
  END LOOP;

  FOREACH v_journey IN ARRAY v_journeys LOOP
    IF v_source_kind='message' THEN
      INSERT INTO public.onboarding_enquiry_messages (journey_id,message_id)
      VALUES(v_journey,v_source_id::uuid) ON CONFLICT DO NOTHING;
    ELSIF v_source_kind='email' THEN
      INSERT INTO public.onboarding_email_links (journey_id,email_id)
      VALUES(v_journey,v_source_id) ON CONFLICT DO NOTHING;
    ELSIF v_family_id IS NOT NULL THEN
      INSERT INTO public.onboarding_enquiry_messages (journey_id,message_id)
      SELECT v_journey,message_id FROM public.onboarding_enquiry_messages WHERE journey_id=v_family_id
      ON CONFLICT DO NOTHING;
      INSERT INTO public.onboarding_email_links (journey_id,email_id,purpose)
      SELECT v_journey,email_id,purpose FROM public.onboarding_email_links WHERE journey_id=v_family_id
      ON CONFLICT DO NOTHING;
    END IF;
    IF v_assignee IS NOT NULL THEN
      SELECT * INTO v_journey_row FROM public.onboarding_journeys WHERE id=v_journey;
      v_evidence := public.onboarding_evidence(v_journey);
      v_action := CASE
        WHEN v_evidence->>'registered_at' IS NULL AND v_evidence->>'trial_attended_at' IS NULL
          THEN CASE WHEN v_evidence->>'trial_booked_at' IS NULL THEN 'book_trial' ELSE 'trial_attendance' END
        WHEN v_evidence->>'trial_attended_at' IS NOT NULL AND v_evidence->>'trial_form_at' IS NULL
          AND NOT (v_journey_row.is_returning AND v_journey_row.enquiry_at IS NOT NULL
            AND (v_evidence->>'trial_attended_at')::timestamptz<v_journey_row.enquiry_at) THEN 'trial_form'
        WHEN v_evidence->>'registered_at' IS NULL AND v_evidence->>'registration_link_at' IS NULL THEN 'registration_link'
        WHEN v_evidence->>'registered_at' IS NULL THEN 'registration'
        WHEN jsonb_array_length(v_evidence->'subjects')=0 OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_evidence->'subjects') s
          WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_evidence->'classes') c WHERE c->>'subject_id'=s->>'id')
        ) THEN 'enrol'
        WHEN jsonb_array_length(v_evidence->'classes')>0 AND v_evidence->>'converted_at' IS NULL THEN 'paid_attendance'
        WHEN jsonb_array_length(v_evidence->'classes')>0 AND v_evidence->>'checkin_at' IS NULL THEN 'checkin'
      END;
      IF v_action IS NOT NULL THEN
        INSERT INTO public.onboarding_action_preferences (journey_id,action_key,assignee_id)
        VALUES(v_journey,v_action,v_assignee)
        ON CONFLICT (journey_id,action_key) DO UPDATE SET assignee_id=EXCLUDED.assignee_id;
      END IF;
    END IF;
  END LOOP;

  IF v_family_id IS NOT NULL THEN
    UPDATE public.onboarding_journeys SET closed_at=now(),closure_reason='completed',
      closure_detail='Continued in individual children’s journeys'
    WHERE id=v_family_id;
  END IF;
  v_result := jsonb_build_object('journeyIds',v_journeys,'sessionIds',v_sessions);
  INSERT INTO public.onboarding_enquiry_submissions (id,request_hash,source_kind,source_id,result)
  VALUES(v_request_id,v_request_hash,v_source_kind,v_source_id,v_result);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.create_onboarding_enquiry(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_onboarding_enquiry(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_admin_meeting(
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
  -- An enquiry can already have a Student identity before the first trial.
  IF p_type='TRIAL_SESSION' THEN
    UPDATE public.students SET status='TRIAL'
    WHERE id=ANY(p_student_ids) AND status IS NULL AND deleted_at IS NULL;
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

-- A returning enquiry stays visible without reactivating the Student.
CREATE OR REPLACE FUNCTION public.search_student_directory_admin(p_request jsonb DEFAULT '{}'::jsonb, p_journeys jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RAISE EXCEPTION 'Active AdminStaff access required' USING ERRCODE = '42501';
  END IF;
  WITH journey_index AS (
    SELECT * FROM jsonb_to_recordset(p_journeys) AS j(
      id uuid, student_id uuid, stage text, open boolean,
      ours boolean, waiting boolean, overdue boolean, subject_ids jsonb
    )
  ), base AS (
    SELECT s.id, 'student'::text AS kind, to_jsonb(s) AS student,
      concat_ws(' ', s.first_name, s.last_name) AS label,
      s.first_name, s.last_name, s.email, s.phone, s.created_at,
      s.status, s.curriculum, s.year_level, s.account_class,
      j.id AS journey_id, j.stage, j.open, j.ours, j.waiting, j.overdue,
      products.products, products.online_since,
      CASE WHEN s.ucat_online_tier_override = 'force_unlimited' OR EXISTS (
        SELECT 1 FROM public.student_subscriptions sub WHERE sub.student_id = s.id AND sub.status IN ('active','trialing','past_due')
      ) THEN 'PAID' ELSE 'FREE' END AS entitlement,
      EXISTS (SELECT 1 FROM public.classes_students cs JOIN public.classes c ON c.id = cs.class_id
        WHERE cs.student_id = s.id AND cs.unenrolled_at IS NULL AND c.deleted_at IS NULL) AS has_class,
      j.subject_ids
    FROM public.students s
    LEFT JOIN LATERAL (SELECT ji.* FROM journey_index ji WHERE ji.student_id = s.id
      ORDER BY ji.open DESC, (SELECT oj.created_at FROM public.onboarding_journeys oj WHERE oj.id = ji.id) DESC, ji.id LIMIT 1) j ON true
    LEFT JOIN LATERAL (
      SELECT min(r.started_at) AS online_since, coalesce(jsonb_agg(jsonb_build_object(
        'product', r.product, 'started_at', r.started_at, 'closed_at', r.closed_at,
        'tier', CASE WHEN r.product = 'UCAT_WEB' AND s.ucat_online_tier_override = 'force_free' THEN 'FREE'
          WHEN (r.product = 'UCAT_WEB' AND s.ucat_online_tier_override = 'force_unlimited') OR EXISTS (
            SELECT 1 FROM public.student_subscriptions sub WHERE sub.student_id = s.id AND sub.status IN ('active','trialing','past_due')
          ) THEN 'UNLIMITED' ELSE 'FREE' END
      ) ORDER BY r.started_at, r.product), '[]'::jsonb) AS products
      FROM public.student_online_product_relationships r WHERE r.student_id = s.id AND r.closed_at IS NULL
    ) products ON true
    WHERE s.deleted_at IS NULL
    UNION ALL
    SELECT oj.id, 'enquiry', NULL::jsonb, oj.label, oj.label, NULL, NULL, NULL, oj.created_at,
      NULL, NULL, NULL, NULL, j.id, j.stage, j.open, j.ours, j.waiting, j.overdue,
      '[]'::jsonb, NULL, NULL, false, j.subject_ids
    FROM public.onboarding_journeys oj JOIN journey_index j ON j.id = oj.id
    WHERE oj.student_id IS NULL
  ), filtered AS (
    SELECT b.* FROM base b WHERE
      (coalesce(p_request->>'search','') = '' OR (
        (coalesce(p_request->'searchFields','["name","email","phone"]'::jsonb) ? 'name' AND b.label ILIKE '%' || (p_request->>'search') || '%') OR
        (coalesce(p_request->'searchFields','["name","email","phone"]'::jsonb) ? 'email' AND b.email ILIKE '%' || (p_request->>'search') || '%') OR
        (coalesce(p_request->'searchFields','["name","email","phone"]'::jsonb) ? 'phone' AND b.phone ILIKE '%' || (p_request->>'search') || '%')
      ))
      AND (coalesce(p_request->'filters'->'relationship', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'relationship') f(value) WHERE ((f.value = 'in_person' AND b.status IS NOT NULL) OR (f.value = 'online' AND b.online_since IS NOT NULL) OR (f.value = 'trial' AND (coalesce(b.status,'') <> 'DISCONTINUED' OR b.open) AND (b.status = 'TRIAL' OR b.journey_id IS NOT NULL)))))
      AND (coalesce(p_request->'filters'->'status', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'status') f(value) WHERE f.value = b.status))
      AND (coalesce(p_request->'filters'->'curriculum', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'curriculum') f(value) WHERE f.value = b.curriculum))
      AND (coalesce(p_request->'filters'->'yearLevel', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'yearLevel') f(value) WHERE f.value = b.year_level::text))
      AND (coalesce(p_request->'filters'->'accountClass', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'accountClass') f(value) WHERE f.value = b.account_class))
      AND (coalesce(p_request->'filters'->'entitlement', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'entitlement') f(value) WHERE f.value = b.entitlement))
      AND (coalesce(p_request->'filters'->'onboardingStatus', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'onboardingStatus') f(value) WHERE f.value = coalesce(b.stage, 'No onboarding')))
      AND (coalesce(p_request->'filters'->'product', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'product') f(value) WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(b.products) product WHERE product->>'product' = f.value)))
      AND (coalesce(p_request->'filters'->'inPersonClass', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'inPersonClass') f(value) WHERE ((f.value = 'has' AND b.has_class) OR (f.value = 'none' AND NOT b.has_class))))
      AND (coalesce(p_request->'filters'->'queue', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'queue') f(value) WHERE ((f.value = 'closed' AND NOT b.open) OR (b.open AND (f.value = 'open' OR (f.value = 'ours' AND b.ours) OR (f.value = 'waiting' AND b.waiting) OR (f.value = 'overdue' AND b.overdue))))))
      AND (coalesce(p_request->'filters'->'subject', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'subject') f(value) WHERE (coalesce(b.subject_ids,'[]'::jsonb) ? f.value OR EXISTS (SELECT 1 FROM public.students_subjects ss WHERE ss.student_id = b.id AND ss.subject_id::text = f.value) OR EXISTS (SELECT 1 FROM public.students_online_access_manual sa WHERE sa.student_id = b.id AND sa.subject_id::text = f.value) OR EXISTS (SELECT 1 FROM public.classes_students cs JOIN public.classes c ON c.id = cs.class_id WHERE cs.student_id = b.id AND cs.unenrolled_at IS NULL AND c.deleted_at IS NULL AND c.subject_id::text = f.value))))
  ), ordered AS (
    SELECT *, row_number() OVER (ORDER BY
      CASE p_request->>'groupBy' WHEN 'stage' THEN coalesce(stage,'No onboarding') WHEN 'status' THEN coalesce(status,'No in-person status') WHEN 'curriculum' THEN coalesce(curriculum,'No curriculum') WHEN 'year_level' THEN coalesce(year_level::text,'No year level') WHEN 'account_class' THEN coalesce(account_class,'Enquiries') END ASC,
      CASE WHEN p_request->>'sortBy' = 'status' AND coalesce(p_request->>'sortDirection','asc') = 'asc' THEN CASE status WHEN 'ACTIVE' THEN '3' WHEN 'TRIAL' THEN '2' WHEN 'DISCONTINUED' THEN '1' ELSE '0' END END asc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'status' AND coalesce(p_request->>'sortDirection','asc') = 'desc' THEN CASE status WHEN 'ACTIVE' THEN '3' WHEN 'TRIAL' THEN '2' WHEN 'DISCONTINUED' THEN '1' ELSE '0' END END desc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'first_name' AND coalesce(p_request->>'sortDirection','asc') = 'asc' THEN first_name END asc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'first_name' AND coalesce(p_request->>'sortDirection','asc') = 'desc' THEN first_name END desc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'last_name' AND coalesce(p_request->>'sortDirection','asc') = 'asc' THEN last_name END asc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'last_name' AND coalesce(p_request->>'sortDirection','asc') = 'desc' THEN last_name END desc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'created_at' AND coalesce(p_request->>'sortDirection','asc') = 'asc' THEN created_at::text END asc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'created_at' AND coalesce(p_request->>'sortDirection','asc') = 'desc' THEN created_at::text END desc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'online_since' AND coalesce(p_request->>'sortDirection','asc') = 'asc' THEN online_since::text END asc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'online_since' AND coalesce(p_request->>'sortDirection','asc') = 'desc' THEN online_since::text END desc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'stage' AND coalesce(p_request->>'sortDirection','asc') = 'asc' THEN stage END asc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'stage' AND coalesce(p_request->>'sortDirection','asc') = 'desc' THEN stage END desc NULLS LAST,
      last_name ASC NULLS LAST, first_name ASC NULLS LAST, id
    ) AS ordinal FROM filtered
  ), page AS (
    SELECT * FROM ordered ORDER BY ordinal
    LIMIT least(greatest(coalesce((p_request->>'pageSize')::integer, 50),1),200)
    OFFSET greatest(coalesce((p_request->>'page')::integer,1)-1,0) * least(greatest(coalesce((p_request->>'pageSize')::integer,50),1),200)
  ), entries AS (
    SELECT ordinal, jsonb_build_object('kind', kind, 'id', id, 'label', label,
      'journey_id', journey_id, 'stage', stage, 'products', products, 'online_since', online_since,
      'student', CASE WHEN kind = 'student' THEN student || jsonb_build_object(
        'classes', (SELECT coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object('subject', to_jsonb(subject)) ORDER BY c.day_of_week, c.start_time), '[]'::jsonb)
          FROM public.classes_students cs JOIN public.classes c ON c.id = cs.class_id LEFT JOIN public.subjects subject ON subject.id = c.subject_id
          WHERE cs.student_id = page.id AND cs.unenrolled_at IS NULL AND c.deleted_at IS NULL),
        'subjects', (SELECT coalesce(jsonb_agg(to_jsonb(subject)), '[]'::jsonb) FROM public.subjects subject WHERE subject.deleted_at IS NULL AND subject.id IN (
          SELECT ss.subject_id FROM public.students_subjects ss WHERE ss.student_id = page.id
          UNION SELECT sa.subject_id FROM public.students_online_access_manual sa WHERE sa.student_id = page.id
          UNION SELECT c.subject_id FROM public.classes_students cs JOIN public.classes c ON c.id = cs.class_id WHERE cs.student_id = page.id AND cs.unenrolled_at IS NULL AND c.deleted_at IS NULL
        )),
        'parents', (SELECT coalesce(jsonb_agg(to_jsonb(parent)), '[]'::jsonb) FROM public.parents_students ps JOIN public.parents parent ON parent.id = ps.parent_id WHERE ps.student_id = page.id AND parent.deleted_at IS NULL)
      ) ELSE NULL END
    ) AS entry FROM page
  )
  SELECT jsonb_build_object('entries', coalesce((SELECT jsonb_agg(entry ORDER BY ordinal) FROM entries), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered)) INTO result;
  RETURN result;
END;
$$;
