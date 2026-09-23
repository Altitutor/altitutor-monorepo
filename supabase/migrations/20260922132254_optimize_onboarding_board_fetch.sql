-- The trial-students board was one HTTP call to onboarding_evidence per journey.
-- Historical journeys also scanned messages from the start of time because the
-- registration-link predicate ORed a body search onto every sent message.
-- Look up each student's conversations first, and return the whole board in one call.

CREATE INDEX IF NOT EXISTS idx_conversations_contact_id
  ON public.conversations (contact_id)
  WHERE contact_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.onboarding_evidence(p_journey_id uuid)
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
  'registration_link_at', (SELECT min(sent_at) FROM (
    SELECT m.sent_at
    FROM public.messages m
    WHERE m.onboarding_journey_id=j.id
      AND m.onboarding_purpose='registration_link'
      AND m.status IN ('SENT','DELIVERED')
      AND m.sent_at>=j.since
    UNION ALL
    SELECT m.sent_at
    FROM (
      SELECT ct.id
      FROM public.contacts ct
      WHERE j.student_id IS NOT NULL AND ct.student_id=j.student_id
      UNION
      SELECT ct.id
      FROM public.contacts ct
      WHERE j.contact_id IS NOT NULL AND ct.id=j.contact_id
      UNION
      SELECT ct.id
      FROM public.contacts ct
      JOIN public.parents_students ps ON ps.parent_id=ct.parent_id
      WHERE j.student_id IS NOT NULL AND ps.student_id=j.student_id
    ) matched
    JOIN public.conversations c ON c.contact_id=matched.id
    JOIN public.messages m ON m.conversation_id=c.id
    WHERE st.registration_public_token IS NOT NULL
      AND m.status IN ('SENT','DELIVERED')
      AND m.sent_at>=j.since
      AND strpos(m.body, st.registration_public_token)>0
    UNION ALL
    SELECT m.sent_at
    FROM public.automation_message_deliveries d
    JOIN public.automation_executions e ON e.id=d.execution_id
    JOIN public.automation_rules r ON r.id=e.rule_id
    JOIN public.messages m ON m.id=d.message_id
    WHERE d.student_id=j.student_id
      AND r.name='Send registration after attended trial or subsidy'
      AND m.status IN ('SENT','DELIVERED')
      AND m.sent_at>=j.since
    UNION ALL
    SELECT em.occurred_at
    FROM public.onboarding_emails em
    WHERE em.direction='outbound'
      AND em.delivery_status='sent'
      AND em.occurred_at>=j.since
      AND st.registration_public_token IS NOT NULL
      AND strpos(em.body_text, st.registration_public_token)>0
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

-- Closed journeys already store a snapshot. Live evidence runs only for the rest,
-- in the database, so the board is one round trip instead of one per journey.
CREATE FUNCTION public.onboarding_journeys_board()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(
    to_jsonb(j) || jsonb_build_object(
      'preferences', coalesce((
        SELECT jsonb_agg(to_jsonb(p))
        FROM public.onboarding_action_preferences p
        WHERE p.journey_id = j.id
      ), '[]'::jsonb),
      'evidence', CASE
        WHEN j.closed_evidence IS NOT NULL THEN j.closed_evidence
        ELSE public.onboarding_evidence(j.id)
      END
    )
    ORDER BY j.created_at DESC, j.id
  ), '[]'::jsonb)
  FROM public.onboarding_journeys j;
$$;

REVOKE ALL ON FUNCTION public.onboarding_journeys_board() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.onboarding_journeys_board() TO authenticated, service_role;
