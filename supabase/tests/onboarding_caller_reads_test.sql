BEGIN;
SELECT plan(12);
INSERT INTO public.students(id,first_name,last_name,status) VALUES
 ('fd506900-0000-4000-8000-000000000001','Scoped','Wanted','TRIAL'),
 ('fd506900-0000-4000-8000-000000000002','Scoped','Returning','TRIAL'),
 ('fd506900-0000-4000-8000-000000000003','Scoped','Historical','TRIAL');
INSERT INTO public.onboarding_journeys(id,student_id,label,enquiry_at,historical,is_returning) VALUES
 ('fd506901-0000-4000-8000-000000000011','fd506900-0000-4000-8000-000000000001','Wanted','2026-10-04T01:00:00Z',false,false),
 ('fd506901-0000-4000-8000-000000000012','fd506900-0000-4000-8000-000000000002','Returning','2026-10-04T01:00:00Z',false,true),
 ('fd506901-0000-4000-8000-000000000013','fd506900-0000-4000-8000-000000000003','Historical',NULL,true,false);
INSERT INTO public.onboarding_journeys(id,student_id,label,enquiry_at,created_at,closed_at,closure_reason,closed_evidence)
SELECT ('fd506901-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 'fd506900-0000-4000-8000-000000000001','Closed '||i,'2026-01-01T00:00:00Z',
 '2026-01-01T00:00:00Z'::timestamptz+i*interval '1 day','2026-02-01T00:00:00Z','withdrawn',
 public.onboarding_evidence('fd506901-0000-4000-8000-000000000011')
FROM generate_series(21,23)i;
INSERT INTO public.onboarding_journeys(id,enquiry_email,label,enquiry_at,historical,is_returning) VALUES
 ('fd506901-0000-4000-8000-000000000031','boundary-start@altitutor.test','Start','2026-10-03T14:30:00Z',false,false),
 ('fd506901-0000-4000-8000-000000000032','boundary-end@altitutor.test','End','2026-10-04T13:29:59Z',false,true),
 ('fd506901-0000-4000-8000-000000000033','boundary-before@altitutor.test','Before','2026-10-03T14:29:59Z',false,false),
 ('fd506901-0000-4000-8000-000000000034','boundary-after@altitutor.test','After','2026-10-04T13:30:00Z',false,false);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is(public.onboarding_journeys_read('fd506900-0000-4000-8000-000000000001'),
 (SELECT jsonb_agg(row ORDER BY row->>'created_at' DESC,row->>'id') FROM jsonb_array_elements(public.onboarding_journeys_board()) row
  WHERE row->>'student_id'='fd506900-0000-4000-8000-000000000001'),
 'Student reader returns exact canonical history without unrelated students');
SELECT is(public.onboarding_journeys_read('fd506900-0000-4000-8000-000000000099'),'[]'::jsonb,'Missing Student has no journeys');
SELECT is((SELECT array_agg(row->>'id' ORDER BY row->>'id') FROM jsonb_array_elements(public.onboarding_journeys_read(NULL,'2026-10-04','2026-10-04','new'))row WHERE row->>'id' LIKE 'fd506901-%'),
 ARRAY['fd506901-0000-4000-8000-000000000011','fd506901-0000-4000-8000-000000000031','fd506901-0000-4000-8000-000000000032'],
 'New cohort uses Adelaide DST day edges and includes returning-labelled family enquiries');
SELECT is((SELECT array_agg(row->>'id') FROM jsonb_array_elements(public.onboarding_journeys_read(NULL,'2026-10-04','2026-10-04','returning'))row WHERE row->>'id' LIKE 'fd506901-%'),
 ARRAY['fd506901-0000-4000-8000-000000000012'],'Returning cohort excludes families and other cohorts');
SELECT is((SELECT array_agg(row->>'id') FROM jsonb_array_elements(public.onboarding_journeys_read(NULL,'2026-10-04','2026-10-04','historical'))row WHERE row->>'id' LIKE 'fd506901-%'),
 ARRAY['fd506901-0000-4000-8000-000000000013'],'Historical unknown-date count remains independent of date range');
SELECT is((SELECT array_agg(row->>'id' ORDER BY row->>'id') FROM jsonb_array_elements(public.onboarding_journeys_read(p_directory=>true))row WHERE row->>'student_id'='fd506900-0000-4000-8000-000000000001'),
 ARRAY['fd506901-0000-4000-8000-000000000011','fd506901-0000-4000-8000-000000000023'],
 'Directory retains every unclosed candidate and newest closed fallback only');
SELECT is((SELECT count(*) FROM jsonb_array_elements(public.onboarding_journeys_read(p_directory=>true))row WHERE row->>'id' IN ('fd506901-0000-4000-8000-000000000031','fd506901-0000-4000-8000-000000000032','fd506901-0000-4000-8000-000000000033','fd506901-0000-4000-8000-000000000034')),
 4::bigint,'Directory retains all separate family enquiries');
SELECT throws_ok($$SELECT public.onboarding_journeys_read()$$,'22023',null,'Unscoped caller cannot accidentally request the complete board');
SELECT throws_ok($$SELECT public.onboarding_journeys_read(NULL,'2026-11-01','2026-10-01','new')$$,'22023',null,'Reversed funnel dates fail explicitly');
SELECT is((SELECT row->'evidence' FROM jsonb_array_elements(public.onboarding_journeys_read('fd506900-0000-4000-8000-000000000001'))row WHERE row->>'id'='fd506901-0000-4000-8000-000000000023'),
 public.onboarding_evidence('fd506901-0000-4000-8000-000000000023'),'Closed snapshots retain exactly the canonical evidence');
SELECT set_config('request.jwt.claims','{"role":"authenticated"}',true);
SELECT is(public.onboarding_journeys_read('fd506900-0000-4000-8000-000000000001'),'[]'::jsonb,'Unprivileged authenticated read cannot bypass RLS');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT public.onboarding_journeys_read('fd506900-0000-4000-8000-000000000001')$$,'42501',null,'Anonymous caller has no RPC access');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
