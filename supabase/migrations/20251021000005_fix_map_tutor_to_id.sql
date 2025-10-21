-- Ensure no ambiguous versions of map_tutor_to_id exist, then recreate with positional params

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'map_tutor_to_id'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.map_tutor_to_id(%s);', r.args);
  END LOOP;
END $$;

CREATE FUNCTION public.map_tutor_to_id(first_name text, last_name text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT s.id
  FROM public.staff s
  WHERE s.first_name = $1
    AND s.last_name = $2
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;


