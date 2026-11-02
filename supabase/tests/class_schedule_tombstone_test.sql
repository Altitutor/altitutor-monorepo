BEGIN;

SELECT plan(5);

CREATE TEMP TABLE tombstone_proposal AS
SELECT jsonb_build_object(
  'class_id', '90000000-0000-0000-0000-000000000005',
  'subject_id', (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
  'schedule_type', 'RECURRING', 'start_date', '2027-01-05', 'end_date', '2027-01-05',
  'frequency_weeks', 1, 'anchor_date', '2027-01-05',
  'recurring_rows', jsonb_build_array(jsonb_build_object('day_of_week', 2, 'start_time', '13:00', 'end_time', '14:00'))
) AS proposal;

SELECT public.apply_class_schedule(proposal, public.preview_class_schedule(proposal)->>'proposal_hash')
FROM tombstone_proposal;

UPDATE public.sessions
SET status = 'INACTIVE', calendar_tombstone_until = NOW() - INTERVAL '1 minute'
WHERE class_id = '90000000-0000-0000-0000-000000000005';

SELECT is(
  public.purge_expired_class_session_tombstones(),
  1,
  'expired pristine calendar tombstones are archived'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.sessions WHERE class_id = '90000000-0000-0000-0000-000000000005' AND deleted_at IS NULL),
  0,
  'maintenance leaves no live Session after the cancellation window'
);

SELECT is((SELECT COUNT(*)::INTEGER FROM public.sessions WHERE class_id='90000000-0000-0000-0000-000000000005' AND deleted_at IS NOT NULL),1,'the expired Session remains retained for history and recovery');

SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.restore_business_record('session',(SELECT id FROM public.deleted_business_records() WHERE kind='session' AND name LIKE '%2027-01-05%' LIMIT 1))$$,'calendar-archived Session can be explicitly restored');
SELECT is(public.purge_expired_class_session_tombstones(),0,'the restored inactive Session is not immediately archived again');
RESET ROLE;
SELECT * FROM finish();

ROLLBACK;
