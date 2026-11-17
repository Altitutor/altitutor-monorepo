-- Empty commands mutate no business rows, but exercise the real actor writer.
BEGIN;
SET LOCAL request.jwt.claim.sub = '';
SELECT public.log_student_absences('[]'::jsonb, '00000000-0000-0000-0000-000000000001'::uuid);
COMMIT;
BEGIN;
SELECT plan(2);
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}';
SELECT is((SELECT auth.uid()), '00000000-0000-0000-0000-000000000010'::uuid,
 'committed absence command cannot replace the next request identity');
SELECT is(nullif(current_setting('request.jwt.claim.sub', true), ''), NULL::text,
 'no legacy actor survives the committed transaction');
SELECT * FROM finish();
ROLLBACK;
