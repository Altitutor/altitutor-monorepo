-- Keep the existing JSONB comparison semantics, including numeric equality
-- across different decimal scales. JSONB already canonicalizes object keys.
CREATE FUNCTION private.normalize_interview_command_payload(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path = ''
AS $function$
BEGIN
  CASE jsonb_typeof(payload)
    WHEN 'object' THEN
      RETURN coalesce((
        SELECT jsonb_object_agg(item.key, private.normalize_interview_command_payload(item.value))
        FROM jsonb_each(payload) AS item
      ), '{}'::jsonb);
    WHEN 'array' THEN
      RETURN coalesce((
        SELECT jsonb_agg(private.normalize_interview_command_payload(item.value) ORDER BY item.position)
        FROM jsonb_array_elements(payload) WITH ORDINALITY AS item(value, position)
      ), '[]'::jsonb);
    WHEN 'number' THEN
      RETURN to_jsonb(trim_scale(payload::numeric));
    ELSE
      RETURN payload;
  END CASE;
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
    (CASE WHEN jsonb_typeof(receipt.command) = 'string'
      THEN private.interview_command_payload_hash(p_command)
      ELSE p_command
    END) THEN$comparison$);
END;
$migration$;

REVOKE ALL ON FUNCTION private.normalize_interview_command_payload(jsonb),
  private.interview_command_payload_hash(jsonb)
FROM PUBLIC, anon, authenticated, service_role;
