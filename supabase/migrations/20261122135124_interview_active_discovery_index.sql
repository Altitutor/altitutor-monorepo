-- DEV-496: discovery must not decode completed/unstarted/deleted round history
-- just to find rejoin links. Keep the caller/assignment checks in the facades.
-- Build without blocking interview writes. This must remain a single statement
-- outside a transaction; do not combine it with other migration commands.
CREATE INDEX CONCURRENTLY interview_rounds_active_discovery
ON public.interview_rounds (id)
WHERE data->>'startedAt' IS NOT NULL
  AND data->>'phase'<>'completed'
  AND data->>'deletedAt' IS NULL;
