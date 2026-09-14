-- Journeys persist staff decisions; milestones remain projections of source records.
-- No historical enquiry timestamps are invented. Historical imports are explicit.
CREATE TABLE public.onboarding_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id),
  contact_id uuid REFERENCES public.contacts(id),
  label text NOT NULL CHECK (btrim(label) <> ''),
  enquiry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  historical boolean NOT NULL DEFAULT false,
  is_returning boolean NOT NULL DEFAULT false,
  closed_at timestamptz,
  closure_reason text CHECK (closure_reason IN ('withdrawn','unable_to_contact','completed')),
  closure_detail text,
  closed_evidence jsonb,
  next_contact_at timestamptz,
  CHECK (student_id IS NOT NULL OR contact_id IS NOT NULL),
  CHECK ((closed_at IS NULL) = (closure_reason IS NULL)),
  CHECK (historical OR enquiry_at IS NOT NULL)
);
CREATE UNIQUE INDEX onboarding_one_open_student ON public.onboarding_journeys(student_id) WHERE closed_at IS NULL AND student_id IS NOT NULL;
CREATE INDEX onboarding_contact_idx ON public.onboarding_journeys(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX onboarding_cohort_idx ON public.onboarding_journeys(enquiry_at, id);

CREATE TABLE public.onboarding_action_preferences (
  journey_id uuid NOT NULL REFERENCES public.onboarding_journeys(id) ON DELETE CASCADE,
  action_key text NOT NULL CHECK (action_key IN ('book_trial','trial_attendance','trial_form','registration_link','registration','enrol','paid_attendance','checkin','followup')),
  assignee_id uuid REFERENCES public.staff(id),
  due_at timestamptz,
  PRIMARY KEY (journey_id, action_key)
);
CREATE INDEX onboarding_assignee_idx ON public.onboarding_action_preferences(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE TABLE public.onboarding_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  followup_business_days integer[] NOT NULL DEFAULT '{2,5,10}',
  action_business_days jsonb NOT NULL DEFAULT '{"book_trial":1,"registration_link":1,"enrol":2,"trial_form":0}'::jsonb,
  CHECK (array_length(followup_business_days,1) > 0 AND 0 < ALL(followup_business_days)),
  CHECK (jsonb_typeof(action_business_days) = 'object')
);
INSERT INTO public.onboarding_settings DEFAULT VALUES;

-- Intent is stored atomically with the queued message. Delivery completes actions.
ALTER TABLE public.messages ADD COLUMN onboarding_journey_id uuid REFERENCES public.onboarding_journeys(id);
ALTER TABLE public.messages ADD COLUMN onboarding_purpose text CHECK (onboarding_purpose IN ('registration_link','ucat_link','followup'));
ALTER TABLE public.messages ADD CONSTRAINT messages_onboarding_intent_pair CHECK ((onboarding_journey_id IS NULL) = (onboarding_purpose IS NULL));
CREATE INDEX messages_onboarding_journey_idx ON public.messages(onboarding_journey_id) WHERE onboarding_journey_id IS NOT NULL;

ALTER TABLE public.onboarding_journeys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.onboarding_journeys FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.onboarding_journeys TO authenticated;
GRANT ALL ON public.onboarding_journeys TO service_role;
CREATE POLICY "Active adminstaff manage onboarding" ON public.onboarding_journeys FOR ALL TO authenticated USING ((SELECT public.is_adminstaff_active())) WITH CHECK ((SELECT public.is_adminstaff_active()));

ALTER TABLE public.onboarding_action_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.onboarding_action_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.onboarding_action_preferences TO authenticated;
GRANT ALL ON public.onboarding_action_preferences TO service_role;
CREATE POLICY "Active adminstaff manage onboarding" ON public.onboarding_action_preferences FOR ALL TO authenticated USING ((SELECT public.is_adminstaff_active())) WITH CHECK ((SELECT public.is_adminstaff_active()));

ALTER TABLE public.onboarding_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.onboarding_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.onboarding_settings TO authenticated;
GRANT ALL ON public.onboarding_settings TO service_role;
CREATE POLICY "Active adminstaff manage onboarding" ON public.onboarding_settings FOR ALL TO authenticated USING ((SELECT public.is_adminstaff_active())) WITH CHECK ((SELECT public.is_adminstaff_active()));


-- Import current trials as explicitly historical; do not fabricate enquiry dates.
INSERT INTO public.onboarding_journeys(student_id,label,historical)
SELECT id,concat_ws(' ',first_name,last_name),true FROM public.students WHERE status='TRIAL';

ALTER TABLE public.onboarding_journeys ADD COLUMN enquiry_email text;
ALTER TABLE public.onboarding_journeys DROP CONSTRAINT onboarding_journeys_check;
ALTER TABLE public.onboarding_journeys ADD CONSTRAINT onboarding_identity CHECK (student_id IS NOT NULL OR contact_id IS NOT NULL OR nullif(btrim(enquiry_email),'') IS NOT NULL);

CREATE TABLE public.onboarding_emails (
  id text PRIMARY KEY,
  internet_message_id text,
  conversation_id text,
  subject text NOT NULL,
  body_text text NOT NULL,
  sender text NOT NULL,
  recipients text[] NOT NULL,
  occurred_at timestamptz NOT NULL,
  direction text NOT NULL CHECK(direction IN ('inbound','outbound')),
  delivery_status text NOT NULL DEFAULT 'received',
  imported_at timestamptz NOT NULL DEFAULT now(),
  ignored boolean NOT NULL DEFAULT false
);
CREATE INDEX onboarding_emails_time ON public.onboarding_emails(occurred_at DESC,id);
CREATE TABLE public.onboarding_email_links (
  email_id text NOT NULL REFERENCES public.onboarding_emails(id) ON DELETE CASCADE,
  journey_id uuid NOT NULL REFERENCES public.onboarding_journeys(id) ON DELETE CASCADE,
  purpose text CHECK(purpose IN ('registration_link','ucat_link','followup')),
  PRIMARY KEY(email_id,journey_id)
);
CREATE INDEX onboarding_email_journey ON public.onboarding_email_links(journey_id);
CREATE TABLE public.onboarding_mailbox_sync (
  folder text PRIMARY KEY,
  cursor_url text,
  synced_at timestamptz,
  last_error text
);
ALTER TABLE public.onboarding_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_email_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_mailbox_sync ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.onboarding_emails, public.onboarding_email_links, public.onboarding_mailbox_sync FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.onboarding_emails TO authenticated;
GRANT UPDATE(ignored) ON public.onboarding_emails TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.onboarding_email_links TO authenticated;
GRANT SELECT ON public.onboarding_mailbox_sync TO authenticated;
GRANT ALL ON public.onboarding_emails, public.onboarding_email_links, public.onboarding_mailbox_sync TO service_role;
CREATE POLICY "Active adminstaff read mailbox" ON public.onboarding_emails FOR SELECT TO authenticated USING ((SELECT public.is_adminstaff_active()));
CREATE POLICY "Active adminstaff review mailbox" ON public.onboarding_emails FOR UPDATE TO authenticated USING ((SELECT public.is_adminstaff_active())) WITH CHECK ((SELECT public.is_adminstaff_active()));
CREATE POLICY "Active adminstaff link mailbox" ON public.onboarding_email_links FOR ALL TO authenticated USING ((SELECT public.is_adminstaff_active())) WITH CHECK ((SELECT public.is_adminstaff_active()));
CREATE POLICY "Active adminstaff see sync status" ON public.onboarding_mailbox_sync FOR SELECT TO authenticated USING ((SELECT public.is_adminstaff_active()));

CREATE FUNCTION public.onboarding_emails_for_journey(p_journey_id uuid, p_offset integer DEFAULT 0, p_limit integer DEFAULT 100)
RETURNS SETOF public.onboarding_emails LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
WITH j AS (SELECT * FROM public.onboarding_journeys WHERE id=p_journey_id), addresses AS (
 SELECT lower(enquiry_email) AS email FROM j WHERE enquiry_email IS NOT NULL
 UNION SELECT lower(c.email) FROM j JOIN public.contacts c ON c.id=j.contact_id WHERE c.email IS NOT NULL
 UNION SELECT lower(st.email) FROM j JOIN public.students st ON st.id=j.student_id WHERE st.email IS NOT NULL
 UNION SELECT lower(p.email) FROM j JOIN public.parents_students ps ON ps.student_id=j.student_id JOIN public.parents p ON p.id=ps.parent_id WHERE p.email IS NOT NULL
)
SELECT e.* FROM public.onboarding_emails e WHERE EXISTS (SELECT 1 FROM j) AND (
 EXISTS(SELECT 1 FROM public.onboarding_email_links l WHERE l.email_id=e.id AND l.journey_id=p_journey_id)
 OR EXISTS(SELECT 1 FROM addresses a WHERE a.email=e.sender OR a.email=ANY(e.recipients))
) ORDER BY e.occurred_at DESC,e.id DESC LIMIT least(greatest(p_limit,1),1000) OFFSET greatest(p_offset,0);
$$;
REVOKE ALL ON FUNCTION public.onboarding_emails_for_journey(uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.onboarding_emails_for_journey(uuid,integer,integer) TO authenticated,service_role;

-- Small workload (1-5 enquiries/week): one indexed projection per journey. All
-- attendance and invoice predicates refer to the SAME actual non-trial session.
CREATE FUNCTION public.onboarding_evidence(p_journey_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
WITH journey AS (
  SELECT j.*, CASE WHEN j.historical THEN '-infinity'::timestamptz ELSE coalesce(j.enquiry_at,j.created_at) END AS since FROM public.onboarding_journeys j WHERE j.id=p_journey_id
), attendance AS (
  SELECT s.id, s.class_id, s.type, s.start_at, a.was_trial, a.created_at AS recorded_at
  FROM journey j JOIN public.tutor_logs_student_attendance a ON a.student_id=j.student_id AND a.attended
  JOIN public.tutor_logs l ON l.id=a.tutor_log_id
  JOIN public.sessions s ON s.id=l.session_id
  WHERE s.status <> 'CANCELLED'
), ongoing AS (
  SELECT a.*, row_number() OVER (PARTITION BY a.class_id ORDER BY a.start_at,a.id) AS class_count
  FROM attendance a CROSS JOIN journey j
  WHERE NOT a.was_trial AND a.class_id IS NOT NULL AND a.start_at >= j.since
    AND EXISTS (SELECT 1 FROM public.sessions_students ss WHERE ss.session_id=a.id AND ss.student_id=j.student_id AND NOT ss.was_trial)
), placements AS (
  SELECT c.id, c.subject_id, cs.enrolled_at, cs.created_at AS added_at, sub.name AS subject_name
  FROM journey j JOIN public.classes_students cs ON cs.student_id=j.student_id
  JOIN public.classes c ON c.id=cs.class_id JOIN public.subjects sub ON sub.id=c.subject_id
  WHERE cs.unenrolled_at IS NULL OR cs.unenrolled_at > now()
), trial AS (
  SELECT a.* FROM attendance a WHERE a.was_trial OR a.type='TRIAL_SESSION' ORDER BY a.start_at LIMIT 1
), booked AS (
  SELECT s.id, ss.created_at, s.start_at FROM journey j JOIN public.sessions_students ss ON ss.student_id=j.student_id
  JOIN public.sessions s ON s.id=ss.session_id
  WHERE (ss.was_trial OR s.type='TRIAL_SESSION') AND s.status <> 'CANCELLED' AND NOT ss.planned_absence
  ORDER BY (s.start_at>=now()) DESC, CASE WHEN s.start_at>=now() THEN s.start_at END ASC, s.start_at DESC LIMIT 1
), paid AS (
  SELECT o.id AS session_id, i.id AS invoice_id, o.start_at, greatest(o.recorded_at,coalesce(i.paid_at,i.updated_at)) AS confirmed_at
  FROM ongoing o CROSS JOIN journey j
  JOIN public.invoice_items ii ON ii.session_id=o.id AND ii.student_id=j.student_id AND ii.deleted_at IS NULL AND ii.line_kind IN ('session_charge','restoration_charge')
  JOIN public.invoices i ON i.id=ii.invoice_id AND i.student_id=j.student_id AND lower(i.status)='paid' AND i.deleted_at IS NULL
  ORDER BY o.start_at, o.id LIMIT 1
), checkin AS (
  SELECT s.id,s.start_at FROM journey j JOIN public.sessions s ON s.type='CHECK_IN' AND s.start_at>=j.since AND s.status <> 'CANCELLED'
  JOIN public.tutor_logs l ON l.session_id=s.id
  WHERE EXISTS (SELECT 1 FROM public.tutor_logs_student_attendance a WHERE a.tutor_log_id=l.id AND a.student_id=j.student_id AND a.attended)
     OR EXISTS (SELECT 1 FROM public.tutor_logs_parent_attendance a JOIN public.parents_students ps ON ps.parent_id=a.parent_id AND ps.student_id=j.student_id WHERE a.tutor_log_id=l.id AND a.attended)
  ORDER BY s.start_at LIMIT 1
)
SELECT coalesce(j.closed_evidence,jsonb_build_object(
  'trial_booked_at', (SELECT created_at FROM booked),
  'trial_start_at', (SELECT start_at FROM booked),
  'trial_session_id', coalesce((SELECT id FROM trial),(SELECT id FROM booked)),
  'trial_attended_at', (SELECT start_at FROM trial),
  'trial_form_at', (SELECT min(r.submitted_at) FROM public.form_responses r JOIN public.forms f ON f.id=r.form_id WHERE f.purpose='trial_session' AND r.subject_student_id=j.student_id AND r.session_id=(SELECT id FROM trial) AND r.deleted_at IS NULL),
  'registration_link_at', (SELECT min(sent_at) FROM (SELECT m.sent_at FROM public.messages m WHERE m.status IN ('SENT','DELIVERED') AND m.sent_at>=j.since AND (
    (m.onboarding_journey_id=j.id AND m.onboarding_purpose='registration_link')
    OR (st.registration_public_token IS NOT NULL AND strpos(m.body,st.registration_public_token)>0 AND EXISTS (
      SELECT 1 FROM public.conversations c JOIN public.contacts ct ON ct.id=c.contact_id WHERE c.id=m.conversation_id AND (ct.student_id=j.student_id OR ct.id=j.contact_id OR EXISTS(SELECT 1 FROM public.parents_students ps WHERE ps.parent_id=ct.parent_id AND ps.student_id=j.student_id))
    ))
    OR EXISTS (SELECT 1 FROM public.automation_message_deliveries d JOIN public.automation_executions e ON e.id=d.execution_id JOIN public.automation_rules r ON r.id=e.rule_id WHERE d.message_id=m.id AND d.student_id=j.student_id AND r.name='Send registration after attended trial or subsidy')
  ) UNION ALL
    SELECT em.occurred_at FROM public.onboarding_emails em WHERE em.direction='outbound' AND em.delivery_status='sent' AND em.occurred_at>=j.since
    AND st.registration_public_token IS NOT NULL AND strpos(em.body_text,st.registration_public_token)>0
    AND (lower(st.email)=ANY(em.recipients) OR lower(j.enquiry_email)=ANY(em.recipients)
      OR EXISTS(SELECT 1 FROM public.parents_students ps JOIN public.parents p ON p.id=ps.parent_id WHERE ps.student_id=j.student_id AND lower(p.email)=ANY(em.recipients)))
  ) sends),
  'billing_at', coalesce((SELECT min(effective_at) FROM public.domain_events WHERE subject_id=j.student_id AND subject_type='student' AND event_name='student.payment_method_added'),(SELECT min(created_at) FROM public.student_payment_methods pm WHERE pm.student_id=j.student_id)),
  'registered_at', st.registered_at,
  'subjects', coalesce((SELECT jsonb_agg(jsonb_build_object('id',sub.id,'name',sub.name)) FROM public.students_subjects ss JOIN public.subjects sub ON sub.id=ss.subject_id WHERE ss.student_id=j.student_id),'[]'::jsonb),
  'classes', coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'subject_id',p.subject_id,'name',p.subject_name,'enrolled_at',p.enrolled_at,'added_at',p.added_at,'attended', (SELECT count(*) FROM ongoing o WHERE o.class_id=p.id), 'third_attended_at',(SELECT start_at FROM ongoing o WHERE o.class_id=p.id AND o.class_count=3), 'checkin_due_at', coalesce((SELECT start_at FROM ongoing o WHERE o.class_id=p.id AND o.class_count=3),(SELECT s.start_at FROM public.sessions s JOIN public.sessions_students ss ON ss.session_id=s.id WHERE ss.student_id=j.student_id AND s.class_id=p.id AND s.start_at>now() AND s.status<>'CANCELLED' AND NOT ss.planned_absence AND NOT ss.was_trial ORDER BY s.start_at OFFSET greatest(0,2-(SELECT count(*) FROM ongoing o WHERE o.class_id=p.id)) LIMIT 1)))) FROM placements p),'[]'::jsonb),
  'converted_at', (SELECT confirmed_at FROM paid),
  'paid_session_id', (SELECT session_id FROM paid),
  'paid_invoice_id', (SELECT invoice_id FROM paid),
  'checkin_booked_at', (SELECT min(s.start_at) FROM public.sessions s JOIN public.sessions_students ss ON ss.session_id=s.id WHERE ss.student_id=j.student_id AND s.type='CHECK_IN' AND s.status <> 'CANCELLED' AND s.start_at>=now()),
  'followups', coalesce((SELECT jsonb_agg(m.sent_at ORDER BY m.sent_at) FROM public.messages m WHERE m.onboarding_journey_id=j.id AND m.onboarding_purpose='followup' AND m.status IN ('SENT','DELIVERED') AND m.sent_at IS NOT NULL),'[]'::jsonb),
  'checkin_at', (SELECT start_at FROM checkin),
  'checkin_session_id', (SELECT id FROM checkin)
)) FROM journey j LEFT JOIN public.students st ON st.id=j.student_id;
$$;
REVOKE ALL ON FUNCTION public.onboarding_evidence(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onboarding_evidence(uuid) TO authenticated, service_role;


-- Booking from Sessions is also an entry point. Attach a pre-student enquiry
-- through its contact when possible; otherwise retain unknown enquiry timing.
CREATE FUNCTION public.capture_trial_onboarding_journey() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_label text; v_journey uuid;
BEGIN
  IF NOT NEW.was_trial THEN RETURN NEW; END IF;
  SELECT concat_ws(' ',first_name,last_name) INTO v_label FROM public.students WHERE id=NEW.student_id;
  SELECT j.id INTO v_journey FROM public.onboarding_journeys j WHERE j.student_id=NEW.student_id AND j.closed_at IS NULL LIMIT 1;
  IF v_journey IS NOT NULL THEN RETURN NEW; END IF;
  SELECT j.id INTO v_journey FROM public.onboarding_journeys j LEFT JOIN public.contacts c ON c.id=j.contact_id
    LEFT JOIN public.students st ON st.id=NEW.student_id
    WHERE j.student_id IS NULL AND j.closed_at IS NULL AND (
      c.student_id=NEW.student_id OR lower(j.enquiry_email)=lower(st.email)
      OR EXISTS(SELECT 1 FROM public.parents_students ps JOIN public.parents p ON p.id=ps.parent_id
        WHERE ps.student_id=NEW.student_id AND (ps.parent_id=c.parent_id OR lower(p.email)=lower(j.enquiry_email)))
    ) ORDER BY j.created_at LIMIT 1 FOR UPDATE OF j;
  IF v_journey IS NOT NULL THEN
    UPDATE public.onboarding_journeys SET student_id=NEW.student_id,label=v_label WHERE id=v_journey;
  ELSE
    INSERT INTO public.onboarding_journeys(student_id,label,historical) VALUES(NEW.student_id,v_label,true) ON CONFLICT (student_id) WHERE closed_at IS NULL AND student_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.capture_trial_onboarding_journey() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER capture_trial_onboarding_journey AFTER INSERT ON public.sessions_students FOR EACH ROW EXECUTE FUNCTION public.capture_trial_onboarding_journey();

CREATE FUNCTION public.close_discontinued_onboarding_journeys() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.status='DISCONTINUED' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.onboarding_journeys SET closed_at=coalesce(NEW.discontinued_at,now()),closure_reason='withdrawn',closure_detail='Student discontinued by adminstaff' WHERE student_id=NEW.id AND closed_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.close_discontinued_onboarding_journeys() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER close_discontinued_onboarding_journeys AFTER UPDATE OF status ON public.students FOR EACH ROW EXECUTE FUNCTION public.close_discontinued_onboarding_journeys();

-- Closed journeys retain their evidence: later unenrolment or a return must not
-- reopen a completed journey or rewrite its cohort outcome.
CREATE FUNCTION public.snapshot_onboarding_closure() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF OLD.closed_at IS NULL AND NEW.closed_at IS NOT NULL THEN
    NEW.closed_evidence=public.onboarding_evidence(OLD.id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.snapshot_onboarding_closure() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER snapshot_onboarding_closure BEFORE UPDATE OF closed_at ON public.onboarding_journeys FOR EACH ROW EXECUTE FUNCTION public.snapshot_onboarding_closure();

CREATE FUNCTION public.settle_onboarding_from_source() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sid uuid; student_ids uuid[]; j record; e jsonb;
BEGIN
  IF TG_TABLE_NAME='tutor_logs_parent_attendance' THEN SELECT array_agg(student_id) INTO student_ids FROM public.parents_students WHERE parent_id=NEW.parent_id;
  ELSIF TG_TABLE_NAME='form_responses' THEN student_ids=ARRAY[NEW.subject_student_id]; ELSE student_ids=ARRAY[NEW.student_id]; END IF;
  FOREACH sid IN ARRAY coalesce(student_ids,ARRAY[]::uuid[]) LOOP
  FOR j IN SELECT * FROM public.onboarding_journeys WHERE student_id=sid AND closed_at IS NULL FOR UPDATE LOOP
    e=public.onboarding_evidence(j.id);
    IF e->>'converted_at' IS NOT NULL AND e->>'checkin_at' IS NOT NULL
      AND (e->>'trial_form_at' IS NOT NULL OR (j.is_returning AND (e->>'trial_attended_at')::timestamptz<j.enquiry_at))
      AND jsonb_array_length(e->'subjects')>0
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(e->'subjects') s WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(e->'classes') c WHERE c->>'subject_id'=s->>'id')) THEN
      UPDATE public.onboarding_journeys SET closed_at=now(),closure_reason='completed' WHERE id=j.id;
    END IF;
  END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.settle_onboarding_from_source() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER settle_onboarding_attendance AFTER INSERT OR UPDATE ON public.tutor_logs_student_attendance FOR EACH ROW EXECUTE FUNCTION public.settle_onboarding_from_source();
CREATE TRIGGER settle_onboarding_invoice AFTER INSERT OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.settle_onboarding_from_source();
CREATE TRIGGER settle_onboarding_invoice_item AFTER INSERT OR UPDATE ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.settle_onboarding_from_source();
CREATE TRIGGER settle_onboarding_enrolment AFTER INSERT OR UPDATE ON public.classes_students FOR EACH ROW EXECUTE FUNCTION public.settle_onboarding_from_source();
CREATE TRIGGER settle_onboarding_form AFTER INSERT OR UPDATE ON public.form_responses FOR EACH ROW EXECUTE FUNCTION public.settle_onboarding_from_source();

CREATE TRIGGER settle_onboarding_parent_attendance AFTER INSERT OR UPDATE ON public.tutor_logs_parent_attendance FOR EACH ROW EXECUTE FUNCTION public.settle_onboarding_from_source();
CREATE TRIGGER settle_onboarding_subjects AFTER INSERT OR UPDATE ON public.students_subjects FOR EACH ROW EXECUTE FUNCTION public.settle_onboarding_from_source();

CREATE FUNCTION public.record_onboarding_decision_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sid uuid; jid uuid; event_name text;
BEGIN
  IF TG_TABLE_NAME='onboarding_action_preferences' THEN
    jid=NEW.journey_id;
    SELECT student_id INTO sid FROM public.onboarding_journeys WHERE id=jid;
    event_name='onboarding.action_updated';
  ELSE sid=NEW.student_id; jid=NEW.id; event_name=CASE WHEN TG_OP='INSERT' THEN 'onboarding.journey_started' ELSE 'onboarding.journey_updated' END;
  END IF;
  IF sid IS NOT NULL AND (TG_OP='INSERT' OR to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW)) THEN
    PERFORM public.record_domain_event(p_event_name=>event_name,p_subject_type=>'student',p_subject_id=>sid,
      p_payload=>jsonb_build_object('journey_id',jid,'before',CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,'after',to_jsonb(NEW)),p_source=>'onboarding',p_dispatch_automations=>false);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_onboarding_decision_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER record_onboarding_decision AFTER INSERT OR UPDATE ON public.onboarding_journeys FOR EACH ROW EXECUTE FUNCTION public.record_onboarding_decision_event();
CREATE TRIGGER record_onboarding_action_decision AFTER INSERT OR UPDATE ON public.onboarding_action_preferences FOR EACH ROW EXECUTE FUNCTION public.record_onboarding_decision_event();
