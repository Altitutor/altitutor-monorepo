BEGIN;
SELECT no_plan();

INSERT INTO public.sessions (id,type,subject_id,start_at,end_at,status,billing_type,calendar_tombstone_until)
SELECT 'f9910000-0000-4000-8000-000000000001',type,subject_id,'2099-01-13 05:30+00','2099-01-13 07:00+00','INACTIVE',billing_type,'2099-04-13 00:00+00'
FROM public.sessions WHERE billing_type IS NOT NULL LIMIT 1;
INSERT INTO public.sessions_students (id,session_id,student_id,was_trial)
VALUES ('f9910000-0000-4000-8000-000000000002','f9910000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001',false);
SELECT is(public.session_student_is_chargeable('f9910000-0000-4000-8000-000000000002'),false,'cancelled calendar tombstone must not be chargeable');
SELECT is(public.get_chargeable_sessions_students_ids(ARRAY['f9910000-0000-4000-8000-000000000002'::uuid]),ARRAY[]::uuid[],'billing runner excludes cancelled assignments');

UPDATE public.sessions SET status='ACTIVE', calendar_tombstone_until=NULL
WHERE id='f9910000-0000-4000-8000-000000000001';
SELECT is(public.session_student_is_chargeable('f9910000-0000-4000-8000-000000000002'),true,
  'active ordinary lesson remains billable');
UPDATE public.sessions SET status='INACTIVE'
WHERE id='f9910000-0000-4000-8000-000000000001';
SELECT is(public.session_student_is_chargeable('f9910000-0000-4000-8000-000000000002'),false,
  'inactive lesson is excluded even without a tombstone');
UPDATE public.sessions SET status='ACTIVE', calendar_tombstone_until='2099-04-13 00:00+00'
WHERE id='f9910000-0000-4000-8000-000000000001';
SELECT is(public.session_student_is_chargeable('f9910000-0000-4000-8000-000000000002'),false,
  'calendar cancellation is excluded even if its status is inconsistent');

CREATE TEMP TABLE diagnostic_schedule AS
SELECT jsonb_build_object('class_id','f9920000-0000-4000-8000-000000000001','subject_id',(SELECT id FROM subjects ORDER BY id LIMIT 1),'cohort_label','Diagnostic rollback only','status','ACTIVE','schedule_type','RECURRING','billing_type','CLASS','start_date','2027-01-06','end_date','2027-01-27','effective_from','2027-01-06','timezone','Australia/Adelaide','frequency_weeks',1,'anchor_date','2027-01-06','recurring_rows',jsonb_build_array(jsonb_build_object('day_of_week',3,'start_time','13:00','end_time','14:00','position',0))) AS proposal;
SELECT public.apply_class_schedule(proposal,public.preview_class_schedule(proposal)->>'proposal_hash') FROM diagnostic_schedule;
INSERT INTO classes_students (id,class_id,student_id,enrolled_at,enrolled_by)
VALUES ('f9920000-0000-4000-8000-000000000002','f9920000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','2027-01-01 00:00+00','00000000-0000-0000-0000-000000000001');
UPDATE classes_students SET unenrolled_at='2027-01-26 00:00+00' WHERE id='f9920000-0000-4000-8000-000000000002';
UPDATE classes_students SET unenrolled_at='2027-01-19 00:00+00' WHERE id='f9920000-0000-4000-8000-000000000002';

SELECT is((SELECT count(*)::integer FROM sessions_students ss JOIN sessions s ON s.id=ss.session_id WHERE s.class_id='f9920000-0000-4000-8000-000000000001' AND ss.student_id='10000000-0000-0000-0000-000000000001' AND s.start_at >= '2027-01-19 00:00+00'),0,'moving a scheduled end earlier removes newly excluded assignments');
CREATE TEMP TABLE new_schedule AS
SELECT proposal || jsonb_build_object('class_id','f9920000-0000-4000-8000-000000000003','cohort_label','Destination','recurring_rows',jsonb_build_array(jsonb_build_object('day_of_week',6,'start_time','13:00','end_time','14:00','position',0))) AS proposal FROM diagnostic_schedule;
SELECT public.apply_class_schedule(proposal,public.preview_class_schedule(proposal)->>'proposal_hash') FROM new_schedule;
INSERT INTO invoices (id,student_id,stripe_invoice_id,invoice_date,amount_due_cents,amount_paid_cents,status)
VALUES ('f9920000-0000-4000-8000-000000000004','10000000-0000-0000-0000-000000000001','in_transfer_regression','2027-01-12',6000,6000,'paid');
INSERT INTO invoice_items (invoice_id,sessions_students_id,stripe_invoice_item_id,amount_cents,description,session_id,student_id,line_kind)
SELECT 'f9920000-0000-4000-8000-000000000004',ss.id,'ii_transfer_regression',6000,'Old class lesson',s.id,ss.student_id,'session_charge'
FROM sessions_students ss JOIN sessions s ON s.id=ss.session_id WHERE s.class_id='f9920000-0000-4000-8000-000000000001' AND (s.start_at AT TIME ZONE 'Australia/Adelaide')::date='2027-01-13' AND ss.student_id='10000000-0000-0000-0000-000000000001';
-- Force a destination-write failure after the source end has changed. The
-- enrolment, removed assignments, and credit queue must all roll back together.
CREATE FUNCTION pg_temp.reject_test_destination() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.class_id='f9920000-0000-4000-8000-000000000003' THEN
    RAISE EXCEPTION 'Destination insert failed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reject_test_destination BEFORE INSERT ON classes_students
FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_test_destination();
SELECT throws_ok($$SELECT public.change_student_class('10000000-0000-0000-0000-000000000001',
  'f9920000-0000-4000-8000-000000000001','f9920000-0000-4000-8000-000000000003',
  '2027-01-06','2027-01-23','00000000-0000-0000-0000-000000000001')$$,
  'P0001','Destination insert failed','destination failure aborts the transfer');
SELECT is((SELECT unenrolled_at FROM classes_students WHERE id='f9920000-0000-4000-8000-000000000002'),
  '2027-01-19 00:00+00'::timestamptz,'failed destination restores the original scheduled end');
SELECT is((SELECT count(*)::integer FROM session_billing_adjustments a
  JOIN sessions_students ss ON ss.id=a.sessions_students_id JOIN sessions s ON s.id=ss.session_id
  WHERE s.class_id='f9920000-0000-4000-8000-000000000001'),
  0,'failed transfer leaves no credit queued');
DROP TRIGGER reject_test_destination ON classes_students;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT lives_ok($$SELECT public.change_student_class('10000000-0000-0000-0000-000000000001','f9920000-0000-4000-8000-000000000001','f9920000-0000-4000-8000-000000000003','2027-01-06','2027-01-23','00000000-0000-0000-0000-000000000001')$$,'admin can transfer a scheduled enrolment using independent inclusive final and first dates');
RESET ROLE;
SELECT is((SELECT (unenrolled_at AT TIME ZONE 'Australia/Adelaide')::date FROM classes_students WHERE id='f9920000-0000-4000-8000-000000000002'),'2027-01-07'::date,'final old class date is inclusive');
SELECT is((SELECT count(*)::integer FROM invoice_items WHERE stripe_invoice_item_id='ii_transfer_regression'),1,'unenrolment preserves the existing financial history');
SELECT is((SELECT count(*)::integer FROM session_billing_adjustments a JOIN sessions_students ss ON ss.id=a.sessions_students_id JOIN sessions s ON s.id=ss.session_id WHERE s.class_id='f9920000-0000-4000-8000-000000000001' AND a.kind='credit_note'),1,'excluded invoiced session queues one credit');
SELECT is((SELECT count(*)::integer FROM sessions_students ss JOIN sessions s ON s.id=ss.session_id WHERE s.class_id='f9920000-0000-4000-8000-000000000003' AND ss.student_id='10000000-0000-0000-0000-000000000001'),1,'new class includes only sessions on or after selected first date');
SELECT is((SELECT count(*)::integer FROM sessions_students ss JOIN sessions s ON s.id=ss.session_id WHERE s.class_id='f9920000-0000-4000-8000-000000000001' AND (s.start_at AT TIME ZONE 'Australia/Adelaide')::date='2027-01-06' AND ss.student_id='10000000-0000-0000-0000-000000000001'),1,'selected final old lesson stays assigned');
SELECT throws_ok($$SELECT public.change_student_class('10000000-0000-0000-0000-000000000001','f9920000-0000-4000-8000-000000000001','f9920000-0000-4000-8000-000000000003','2027-01-13','2027-01-23','00000000-0000-0000-0000-000000000001')$$,'P0001','Student is already enrolled in the new class','duplicate destination fails atomically');
SELECT is((SELECT (unenrolled_at AT TIME ZONE 'Australia/Adelaide')::date FROM classes_students WHERE id='f9920000-0000-4000-8000-000000000002'),'2027-01-07'::date,'failed transfer does not change the old end date');

-- A staff correction can extend a scheduled end again after an excluded lesson
-- has already been invoiced. It must restore that obligation, not leave a credit.
SELECT public.end_student_class_enrolment('10000000-0000-0000-0000-000000000001',
  'f9920000-0000-4000-8000-000000000001','2027-01-14 00:00+00',
  '00000000-0000-0000-0000-000000000001');
SELECT is((SELECT public.session_student_is_chargeable(ss.id)
  FROM sessions_students ss JOIN sessions s ON s.id=ss.session_id
  WHERE ss.student_id='10000000-0000-0000-0000-000000000001'
    AND s.class_id='f9920000-0000-4000-8000-000000000001'
    AND (s.start_at AT TIME ZONE 'Australia/Adelaide')::date='2027-01-13'),
  true, 'extending the final date restores the included invoiced lesson');
SELECT is((SELECT count(*)::integer FROM session_billing_adjustments a
  JOIN sessions_students ss ON ss.id=a.sessions_students_id JOIN sessions s ON s.id=ss.session_id
  WHERE s.class_id='f9920000-0000-4000-8000-000000000001'
    AND a.kind='credit_note' AND a.status IN ('pending','retryable')),
  0, 'correcting the end supersedes an unprocessed credit for a restored lesson');

-- Preserve independent absences through an end-date correction in both directions.
UPDATE sessions_students SET planned_absence=true,is_credited=true
WHERE student_id='10000000-0000-0000-0000-000000000001' AND session_id IN (
  SELECT id FROM sessions WHERE class_id='f9920000-0000-4000-8000-000000000001'
    AND (start_at AT TIME ZONE 'Australia/Adelaide')::date='2027-01-06'
);
SELECT public.end_student_class_enrolment('10000000-0000-0000-0000-000000000001',
  'f9920000-0000-4000-8000-000000000001','2027-01-02 00:00+00',
  '00000000-0000-0000-0000-000000000001');
-- An explicit absence edit after unenrolment should not be undone on extension.
UPDATE sessions_students SET planned_absence_logged_at=now()+interval '1 second'
WHERE student_id='10000000-0000-0000-0000-000000000001' AND session_id IN (
  SELECT id FROM sessions WHERE class_id='f9920000-0000-4000-8000-000000000001'
    AND (start_at AT TIME ZONE 'Australia/Adelaide')::date='2027-01-13'
);
SELECT public.end_student_class_enrolment('10000000-0000-0000-0000-000000000001',
  'f9920000-0000-4000-8000-000000000001','2027-01-14 00:00+00',
  '00000000-0000-0000-0000-000000000001');
SELECT is((SELECT count(*)::integer FROM sessions_students ss
  JOIN sessions s ON s.id=ss.session_id
  WHERE ss.student_id='10000000-0000-0000-0000-000000000001'
    AND s.class_id='f9920000-0000-4000-8000-000000000001'
    AND ss.planned_absence AND ss.is_credited AND ss.enrolment_absence_snapshot IS NULL),
  2, 'earlier and later independent absence decisions survive end-date corrections');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT throws_ok($$SELECT public.change_student_class('10000000-0000-0000-0000-000000000001',
  'f9920000-0000-4000-8000-000000000001','f9920000-0000-4000-8000-000000000003',
  '2027-01-06','2027-01-23','00000000-0000-0000-0000-000000000001')$$,
  '42501','Only active admin staff may change class enrolments','students cannot invoke the staff transfer command');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
