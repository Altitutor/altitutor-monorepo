-- DEV-494: deletion is a recoverable removal from portals, including rounds
-- already started. Keep immutable release history and operational audit intact.
DO $migration$
DECLARE definition text; previous text;
BEGIN
 SELECT pg_get_functiondef('public.interview_command(uuid,jsonb)'::regprocedure) INTO definition;
 previous:='SELECT * INTO r FROM public.interview_rounds WHERE id=(p_command->>''roundId'')::uuid;';
 IF (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 THEN
  RAISE EXCEPTION 'Unrecognized interview heartbeat lookup';
 END IF;
 -- Only deletion takes the exclusive advisory lock. Ordinary assessment saves
 -- retain ADR0059's independence from presence writes.
 definition:=replace(definition,previous,
  'PERFORM pg_advisory_xact_lock_shared(hashtextextended(''interview-round-deletion:''||((p_command->>''roundId'')::uuid)::text,0));
  SELECT * INTO r FROM public.interview_rounds WHERE id=(p_command->>''roundId'')::uuid;');
 previous:=$old$ IF kind='heartbeat' THEN
  PERFORM pg_advisory_xact_lock_shared$old$;
 IF (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 THEN
  RAISE EXCEPTION 'Unrecognized interview heartbeat branch';
 END IF;
 definition:=replace(definition,previous,$new$ IF kind='heartbeat' THEN
  -- Active admins may join media without being assigned as a tutor. Keep their
  -- liveness in the existing staff presence table, never in observer reads.
  IF EXISTS(SELECT 1 FROM public.staff WHERE user_id=p_actor_user_id AND role='ADMINSTAFF' AND status='ACTIVE') THEN
   SELECT id INTO actor FROM public.staff WHERE user_id=p_actor_user_id AND role='ADMINSTAFF' AND status='ACTIVE';
  END IF;
  PERFORM pg_advisory_xact_lock_shared$new$);
 previous:=$old$coalesce(actor=ANY(r.tutor_ids) OR actor=r.created_by,false)$old$;
 -- Replace only the early heartbeat authorization, not control authorization.
 IF strpos(definition,previous)=0 THEN RAISE EXCEPTION 'Unrecognized interview heartbeat access'; END IF;
 definition:=overlay(definition placing
  $new$(coalesce(actor=ANY(r.tutor_ids) OR actor=r.created_by,false) OR EXISTS(SELECT 1 FROM public.staff WHERE id=actor AND user_id=p_actor_user_id AND role='ADMINSTAFF' AND status='ACTIVE'))$new$
  from strpos(definition,previous) for length(previous));
 previous:=$old$   IF d->>'startedAt' IS NOT NULL THEN RAISE EXCEPTION 'Only unstarted rounds can be deleted' USING ERRCODE='22023'; END IF;$old$;
 IF (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 THEN
  RAISE EXCEPTION 'Unrecognized interview deletion guard';
 END IF;
 definition:=replace(definition,previous,$new$   PERFORM pg_advisory_xact_lock(hashtextextended('interview-round-deletion:'||r.id::text,0));
   IF EXISTS(SELECT 1 FROM public.interview_presence WHERE round_id=r.id AND last_seen_at>clock_timestamp()-interval '35 seconds')
    OR EXISTS(SELECT 1 FROM public.interview_tutor_presence WHERE round_id=r.id AND last_seen_at>clock_timestamp()-interval '35 seconds') THEN
    RAISE EXCEPTION 'Someone is still in this interview. Ask everyone to leave, then refresh before deleting.' USING ERRCODE='22023';
   END IF;
   IF d->>'startedAt' IS NOT NULL OR p_command ? 'expectedAttemptVersions' THEN
    IF jsonb_typeof(p_command->'expectedAttemptVersions') IS DISTINCT FROM 'array' THEN
     RAISE EXCEPTION 'Refresh the scores and feedback before deleting this round' USING ERRCODE='PT409';
    END IF;
    IF jsonb_array_length(p_command->'expectedAttemptVersions')<>jsonb_array_length(d->'attempts')
     OR (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_command->'expectedAttemptVersions') x)<>jsonb_array_length(d->'attempts')
     OR EXISTS(SELECT 1 FROM jsonb_array_elements(d->'attempts') a WHERE NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements(p_command->'expectedAttemptVersions') x
      WHERE x->>'id'=a->>'id' AND x->'version'=a->'version')) THEN
     RAISE EXCEPTION 'Scores or feedback changed. Refresh before deleting this round' USING ERRCODE='PT409';
    END IF;
   END IF;
   d:=d || jsonb_build_object('phase','completed','phaseDeadline',NULL,'pausedAt',NULL,'pausedBy',NULL,'remainingMilliseconds',NULL);$new$);
 EXECUTE definition;
END;
$migration$;
