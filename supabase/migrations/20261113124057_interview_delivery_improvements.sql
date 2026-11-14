-- DEV-375: explicit group controls and atomic planned interview rounds.
-- Patch the current command so existing lock, timing and recording fixes survive.
DO $migration$
DECLARE definition text; previous text; replacement text;
BEGIN
 SELECT pg_get_functiondef('public.interview_command(uuid,jsonb)'::regprocedure) INTO definition;
 previous := $old$   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d->'progress') p WHERE p->>'studentId' IS NOT NULL) THEN RAISE EXCEPTION 'At least one station needs a student' USING ERRCODE='22023'; END IF;$old$;
 IF strpos(definition, previous)=0 THEN RAISE EXCEPTION 'Unrecognized interview reading participation guard'; END IF;
 definition:=replace(definition,previous,$new$   IF d->>'delivery' IS DISTINCT FROM 'in_person' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d->'progress') p WHERE p->>'studentId' IS NOT NULL) THEN RAISE EXCEPTION 'At least one station needs a student' USING ERRCODE='22023'; END IF;$new$);
 previous := $old$   IF idx IS NULL OR d->>'delivery'<>'in_person' OR d->>'phase'<>'waiting' OR coalesce((progress->>'ready')::boolean,false) THEN RAISE EXCEPTION 'Cannot select a student now' USING ERRCODE='22023'; END IF;$old$;
 IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized interview student selection guard'; END IF;
 definition:=replace(definition,previous,$new$   IF idx IS NULL OR d->>'delivery'<>'in_person' OR d->>'phase' NOT IN ('waiting','reading') OR d->>'pausedAt' IS NOT NULL
    OR (d->>'phase'='reading' AND (d->>'phaseDeadline')::timestamptz<=clock_timestamp()) THEN RAISE EXCEPTION 'Cannot select a student now' USING ERRCODE='22023'; END IF;$new$);
 previous := $old$  ELSIF kind='pause' THEN$old$;
 replacement := $new$  ELSIF kind='skipQuestions' THEN
   IF d->>'startedAt' IS NULL OR d->>'phase'<>'questions' OR d->>'pausedAt' IS NOT NULL
    OR (d->>'phaseDeadline')::timestamptz<=clock_timestamp() THEN RAISE EXCEPTION 'Cannot skip question time now' USING ERRCODE='22023'; END IF;
   timing_at:=clock_timestamp();
   d:=public.interview_question_timing(d,timing_at);
   d:=public.interview_close_phase(d,timing_at) || jsonb_build_object('phase','feedback','phaseStartedAt',timing_at,'phaseDeadline',NULL,
    'sharedAction',jsonb_build_object('type','skipQuestions','actorId',to_jsonb(actor)));
   d:=public.interview_question_timing(d,timing_at); changed:=true;
  ELSIF kind='pause' THEN$new$;
 IF strpos(definition,previous)=0 OR strpos(definition,'kind=''skipQuestions''')<>0 THEN RAISE EXCEPTION 'Unrecognized interview group controls'; END IF;
 definition:=replace(definition,previous,replacement);
 previous := $old$ ELSIF kind='createRound' THEN$old$;
 replacement := $new$ ELSIF kind='createRounds' THEN
  IF jsonb_typeof(p_command->'rounds') IS DISTINCT FROM 'array' OR jsonb_array_length(p_command->'rounds') NOT BETWEEN 1 AND 100 THEN
   RAISE EXCEPTION 'Choose between 1 and 100 rounds' USING ERRCODE='22023'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_command->'rounds'))<>(SELECT count(DISTINCT (entry->>'roundId')::uuid) FROM jsonb_array_elements(p_command->'rounds') entry)
   OR (SELECT count(*) FROM jsonb_array_elements(p_command->'rounds') entry CROSS JOIN LATERAL jsonb_array_elements_text(entry->'setup'->'studentIds') s)
      <>(SELECT count(DISTINCT s.value::uuid) FROM jsonb_array_elements(p_command->'rounds') entry CROSS JOIN LATERAL jsonb_array_elements_text(entry->'setup'->'studentIds') s)
   THEN RAISE EXCEPTION 'Rounds and their students must be distinct' USING ERRCODE='22023'; END IF;
  FOR child IN SELECT value FROM jsonb_array_elements(p_command->'rounds') LOOP
   -- The parent receipt and every child write share this transaction. A failed
   -- child rolls back the entire series, its receipts and notifications.
   PERFORM public.interview_command(p_actor_user_id,jsonb_build_object('type','createRound','commandId',child->'roundId','roundId',child->'roundId','setup',child->'setup'));
  END LOOP;
  entity_id:=v_command_id; ver:=1;
 ELSIF kind='createRound' THEN$new$;
 IF strpos(definition,previous)=0 OR strpos(definition,'kind=''createRounds''')<>0 THEN RAISE EXCEPTION 'Unrecognized interview creation command'; END IF;
 definition:=replace(definition,previous,replacement);
 previous := $old$ result:=jsonb_build_object('id',entity_id,'version',ver);$old$;
 IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized interview command result'; END IF;
 definition:=replace(definition,previous,$new$ result:=jsonb_build_object('id',entity_id,'version',ver) || CASE WHEN kind='createRounds' THEN jsonb_build_object('roundIds',
  (SELECT jsonb_agg(entry->'roundId') FROM jsonb_array_elements(p_command->'rounds') entry)) ELSE '{}'::jsonb END;$new$);
 EXECUTE definition;
END;
$migration$;

-- Keep old rounds at zero allowance. New clients explicitly submit their default.
DO $migration$
DECLARE definition text; previous text;
BEGIN
 SELECT pg_get_functiondef('public.interview_setup_data(jsonb,uuid,timestamptz)'::regprocedure) INTO definition;
 previous := $old$BEGIN
 SELECT data INTO template$old$;
 IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized interview setup validation'; END IF;
 definition:=replace(definition,previous,$new$BEGIN
 IF p_setup ? 'rotationAllowanceSeconds' THEN
  IF jsonb_typeof(p_setup->'rotationAllowanceSeconds') IS DISTINCT FROM 'number' THEN
   RAISE EXCEPTION 'Invalid rotation allowance' USING ERRCODE='22023'; END IF;
  IF (p_setup->>'rotationAllowanceSeconds')::numeric <> trunc((p_setup->>'rotationAllowanceSeconds')::numeric)
   OR (p_setup->>'rotationAllowanceSeconds')::numeric NOT BETWEEN 0 AND 7200 THEN
   RAISE EXCEPTION 'Invalid rotation allowance' USING ERRCODE='22023'; END IF;
 END IF;
 SELECT data INTO template$new$);
 EXECUTE definition;
END;
$migration$;

-- Calendar estimates include every rotation and its visible allowance, without
-- imposing an unrelated minimum. Live phase deadlines remain unchanged.
DO $migration$
DECLARE definition text; previous text;
BEGIN
 SELECT pg_get_functiondef('public.interview_student_round_json(public.interview_rounds,uuid)'::regprocedure) INTO definition;
 previous := $old$greatest(1800, ((d->>'readingTimeSeconds')::integer + (d->>'questionTimeSeconds')::integer) * greatest(1,jsonb_array_length(d->'stations')))$old$;
 IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized interview student calendar estimate'; END IF;
 definition:=replace(definition,previous,$new$((d->>'readingTimeSeconds')::integer + (d->>'questionTimeSeconds')::integer + coalesce((d->>'rotationAllowanceSeconds')::integer,0)) * greatest(1,jsonb_array_length(d->'stations'))$new$);
 EXECUTE definition;
END;
$migration$;
