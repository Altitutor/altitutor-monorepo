-- Hybrid connector wake-up: private Database Broadcast when commands become available.
-- Realtime carries no command payload; the Mac still claims via imessage-connector.

CREATE OR REPLACE FUNCTION public.imessage_connector_wake_topic()
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'imessage:connector:wake'::text;
$$;

COMMENT ON FUNCTION public.imessage_connector_wake_topic() IS
  'Private Realtime Broadcast topic used only as a commands-available wake signal.';

CREATE OR REPLACE FUNCTION public.imessage_notify_connector_wake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  should_wake boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    should_wake := NEW.status = 'queued';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Newly queued, or a queued command became available again (retry backoff elapsed / requeue).
    should_wake :=
      NEW.status = 'queued'
      AND (
        OLD.status IS DISTINCT FROM 'queued'
        OR OLD.available_at IS DISTINCT FROM NEW.available_at
      );
  END IF;

  IF should_wake THEN
    PERFORM realtime.send(
      jsonb_build_object('v', 1),
      'wake',
      public.imessage_connector_wake_topic(),
      true
    );
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS imessage_commands_connector_wake ON public.imessage_commands;
CREATE TRIGGER imessage_commands_connector_wake
AFTER INSERT OR UPDATE OF status, available_at ON public.imessage_commands
FOR EACH ROW
EXECUTE FUNCTION public.imessage_notify_connector_wake();

-- Private Broadcast RLS on realtime.messages cannot be applied by migrations:
-- that table is owned by the Realtime role (SQLSTATE 42501: must be owner of table messages).
-- Apply supabase/manual/imessage_connector_wake_realtime_rls.sql once via the
-- Supabase SQL Editor (postgres / dashboard) after this migration lands.

COMMENT ON TRIGGER imessage_commands_connector_wake ON public.imessage_commands IS
  'Emits a private Realtime wake broadcast when a command becomes claimable; no sensitive payload.';

REVOKE ALL ON FUNCTION public.imessage_connector_wake_topic() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.imessage_connector_wake_topic() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.imessage_notify_connector_wake() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.imessage_notify_connector_wake() TO service_role;
