-- Round controls change assessment data/version, never the round identity.
-- Keep controls mutually exclusive while permitting the first heartbeat's
-- foreign-key KEY SHARE check to proceed during an assessment transaction.
DO $migration$
DECLARE
  definition text;
  previous_lock text := 'SELECT * INTO r FROM public.interview_rounds WHERE id=entity_id FOR UPDATE;';
  next_lock text := 'SELECT * INTO r FROM public.interview_rounds WHERE id=entity_id FOR NO KEY UPDATE;';
BEGIN
  SELECT pg_catalog.pg_get_functiondef('public.interview_command(uuid,jsonb)'::pg_catalog.regprocedure)
    INTO definition;
  IF pg_catalog.strpos(definition, previous_lock) = 0
    OR pg_catalog.strpos(definition, next_lock) <> 0
    OR (pg_catalog.length(definition) - pg_catalog.length(pg_catalog.replace(definition, previous_lock, '')))
       / pg_catalog.length(previous_lock) <> 1 THEN
    RAISE EXCEPTION 'Unrecognized interview round-control lock definition';
  END IF;
  EXECUTE pg_catalog.replace(definition, previous_lock, next_lock);
END;
$migration$;
