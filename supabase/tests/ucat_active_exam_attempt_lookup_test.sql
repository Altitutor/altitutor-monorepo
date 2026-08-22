BEGIN;
SELECT plan(1);

CREATE TEMP TABLE active_attempt_lookup_writes (
  table_name text NOT NULL
);

CREATE FUNCTION pg_temp.record_active_attempt_lookup_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO active_attempt_lookup_writes (table_name) VALUES (TG_TABLE_NAME);
  RETURN NULL;
END;
$$;

CREATE TRIGGER record_set_attempt_lookup_write
AFTER UPDATE ON public.student_question_set_attempts
FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.record_active_attempt_lookup_write();

CREATE TRIGGER record_mock_attempt_lookup_write
AFTER UPDATE ON public.student_ucat_mock_attempts
FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.record_active_attempt_lookup_write();

CREATE TRIGGER record_practice_attempt_lookup_write
AFTER UPDATE ON public.student_practice_sessions
FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.record_active_attempt_lookup_write();

SELECT *
FROM public.get_ucat_active_exam_attempt_slot(
  'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid
);

SELECT is(
  (SELECT count(*) FROM active_attempt_lookup_writes),
  0::bigint,
  'looking up an absent active attempt performs no attempt-table writes'
);

SELECT * FROM finish();
ROLLBACK;
