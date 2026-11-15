BEGIN;
SELECT plan(8);
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);

INSERT INTO public.interviews(id,data)
VALUES ('e4480000-0000-4000-8000-000000000001','{}');
INSERT INTO public.interview_rounds(id,interview_id,created_by,tutor_ids,student_ids,data)
VALUES (
 'e4480000-0000-4000-8000-000000000002',
 'e4480000-0000-4000-8000-000000000001',
 '00000000-0000-0000-0000-000000000010',
 '{}','{}',
 '{"id":"e4480000-0000-4000-8000-000000000002","phase":"completed","progress":[],"attempts":[],"recordings":[]}'
);

SELECT is((public.interview_media_state('e4480000-0000-4000-8000-000000000002')->>'phase'),'completed',
 'The media facade can confirm a completed round');
SELECT is((SELECT count(*) FROM public.interview_media_sessions WHERE round_id='e4480000-0000-4000-8000-000000000002'),0::bigint,
 'A round can exist without any provider rooms');

CREATE TEMP TABLE claimed_media AS
SELECT * FROM public.interview_claim_media_job('e4480000-0000-4000-8000-000000000002');
SELECT is((SELECT count(*) FROM claimed_media),1::bigint,'A due job is claimable');
SELECT is((SELECT count(*) FROM public.interview_claim_media_job('e4480000-0000-4000-8000-000000000002')),0::bigint,
 'An active lease produces an empty claim even with no provider rooms');

SELECT public.interview_complete_media_job(round_id,revision,lease_token,300,false) FROM claimed_media;
CREATE TEMP TABLE retry_media AS
SELECT * FROM public.interview_claim_media_job('e4480000-0000-4000-8000-000000000002');
SELECT is((SELECT count(*) FROM retry_media),1::bigint,
 'An explicit round claim may run before the scheduled retry time');

SELECT public.interview_complete_media_job(round_id,revision,lease_token,300,true) FROM retry_media;
SELECT is((SELECT count(*) FROM public.interview_claim_media_job('e4480000-0000-4000-8000-000000000002')),0::bigint,
 'Retired work also produces an empty claim');
SELECT is((public.interview_media_state('e4480000-0000-4000-8000-000000000002')->>'phase'),'completed',
 'Retiring the media job preserves the authoritative round');
SELECT is((SELECT count(*) FROM public.interview_media_sessions WHERE round_id='e4480000-0000-4000-8000-000000000002'),0::bigint,
 'An empty claim after retirement does not imply an unclosed room');

SELECT * FROM finish();
ROLLBACK;
