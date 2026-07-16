-- A blocked item must not roll back otherwise valid lifecycle changes in the
-- same tutor bulk action. Each exception block is a PostgreSQL subtransaction,
-- so a failed item is rolled back independently while successful items commit.

DROP FUNCTION public.tutor_ucat_set_content_status_bulk(
  TEXT,
  UUID[],
  public.ucat_content_status
);

CREATE FUNCTION public.tutor_ucat_set_content_status_bulk(
  p_content_type TEXT,
  p_content_ids UUID[],
  p_status public.ucat_content_status
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_content_id UUID;
  v_moved_ids JSONB := '[]'::jsonb;
  v_failures JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF COALESCE(array_length(p_content_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'select_at_least_one_item';
  END IF;

  FOREACH v_content_id IN ARRAY p_content_ids
  LOOP
    BEGIN
      PERFORM public.tutor_ucat_set_content_status(p_content_type, v_content_id, p_status);
      v_moved_ids := v_moved_ids || jsonb_build_array(v_content_id);
    EXCEPTION WHEN OTHERS THEN
      v_failures := v_failures || jsonb_build_array(jsonb_build_object(
        'contentId', v_content_id,
        'rawError', SQLERRM
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'movedIds', v_moved_ids,
    'failures', v_failures
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_set_content_status_bulk(
  TEXT,
  UUID[],
  public.ucat_content_status
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_set_content_status_bulk(
  TEXT,
  UUID[],
  public.ucat_content_status
) TO authenticated;
