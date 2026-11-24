-- This runs in the next migration transaction after installing the reader
-- that supports both receipt formats. An invocation already running the old
-- body can still be waiting on its per-command lock without a receipt-table
-- lock. Drain transactions predating this stage before any hash is visible.
-- New transactions can continue using the compatible reader while we wait.
DO $migration$
DECLARE
  cutoff constant timestamptz := clock_timestamp();
BEGIN
  IF NOT current_setting('track_activities')::boolean
    OR NOT pg_has_role(current_user, 'pg_read_all_stats', 'USAGE') THEN
    RAISE EXCEPTION 'Interview receipt cutover requires visibility of active database transactions';
  END IF;

  LOOP
    PERFORM pg_stat_clear_snapshot();
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND backend_type = 'client backend'
        AND pid <> pg_backend_pid()
        AND xact_start <= cutoff
    );

    IF clock_timestamp() >= cutoff + interval '5 seconds' THEN
      RAISE EXCEPTION 'Interview receipt cutover timed out waiting for older database transactions'
        USING ERRCODE = '55P03';
    END IF;
    PERFORM pg_sleep(0.05);
  END LOOP;
END;
$migration$;

-- Hash ordinary receipts at the write boundary. Review receipts already
-- contain a hash and skip this trigger.
CREATE FUNCTION private.hash_interview_command_receipt()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  NEW.command := private.interview_command_payload_hash(NEW.command);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.hash_interview_command_receipt()
FROM PUBLIC, anon, authenticated, service_role;

-- Fail quickly if an existing writer holds the conflicting table lock.
SET LOCAL lock_timeout = '2s';
CREATE TRIGGER hash_interview_command_receipt
BEFORE INSERT ON public.interview_command_receipts
FOR EACH ROW
WHEN (NEW.command ? 'commandId')
EXECUTE FUNCTION private.hash_interview_command_receipt();

COMMENT ON COLUMN public.interview_command_receipts.command IS
  'SHA-256 payload fingerprint. Review commands retain their existing reviewHash object format.';
