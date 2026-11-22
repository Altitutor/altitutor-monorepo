-- Keep the existing JSONB comparison semantics, including numeric equality
-- across different decimal scales. JSONB already canonicalizes object keys.
CREATE FUNCTION private.normalize_interview_command_payload(payload jsonb)
RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT
SET search_path = ''
AS $function$
  SELECT CASE jsonb_typeof(payload)
    WHEN 'object' THEN coalesce((
      SELECT jsonb_object_agg(item.key, private.normalize_interview_command_payload(item.value))
      FROM jsonb_each(payload) AS item
    ), '{}'::jsonb)
    WHEN 'array' THEN coalesce((
      SELECT jsonb_agg(private.normalize_interview_command_payload(item.value) ORDER BY item.position)
      FROM jsonb_array_elements(payload) WITH ORDINALITY AS item(value, position)
    ), '[]'::jsonb)
    WHEN 'number' THEN to_jsonb(trim_scale(payload::numeric))
    ELSE payload
  END;
$function$;

CREATE FUNCTION private.interview_command_payload_hash(payload jsonb)
RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT
SET search_path = ''
AS $function$
  SELECT to_jsonb('sha256:' || encode(sha256(convert_to(
    private.normalize_interview_command_payload(payload)::text, 'UTF8'
  )), 'hex'));
$function$;

-- Preserve the rest of the live command, including its lock, grants and result.
DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.interview_command(uuid,jsonb)'::regprocedure);
  old_check constant text := 'IF receipt.command<>p_command THEN';
BEGIN
  IF strpos(definition, old_check) = 0 THEN
    RAISE EXCEPTION 'Unrecognized interview command receipt comparison';
  END IF;

  EXECUTE replace(definition, old_check, $comparison$IF receipt.command IS DISTINCT FROM
    CASE WHEN jsonb_typeof(receipt.command) = 'string'
      THEN private.interview_command_payload_hash(p_command)
      ELSE p_command
    END THEN$comparison$);
END;
$migration$;

-- Hash at the write boundary so a command already executing during the
-- cutover also stores a compact receipt. Review receipts already contain a
-- hash and skip this trigger.
CREATE FUNCTION private.hash_interview_command_receipt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.command := private.interview_command_payload_hash(NEW.command);
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.normalize_interview_command_payload(jsonb),
  private.interview_command_payload_hash(jsonb),
  private.hash_interview_command_receipt()
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
