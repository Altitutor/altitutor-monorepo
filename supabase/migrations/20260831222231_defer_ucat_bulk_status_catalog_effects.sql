-- Bulk unpublish of published sets compacted every remaining catalog scope and
-- rebuilt set-derived catalog names after each row. That work hit the
-- authenticated 8s statement_timeout, so the RPC failed with no lifecycle
-- blockers. Defer compaction and catalog refresh until the bulk call finishes,
-- and refresh once per compact when a single set leaves the pool.

CREATE OR REPLACE FUNCTION public.ucat_set_catalog_compact_is_deferred()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    current_setting('altitutor.defer_ucat_set_catalog_compact', TRUE),
    'off'
  ) = 'on';
$$;

REVOKE ALL ON FUNCTION public.ucat_set_catalog_compact_is_deferred()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trigger_refresh_ucat_catalog_from_sets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.ucat_catalog_refresh_is_deferred() THEN RETURN NULL; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM new_rows next
    JOIN old_rows previous ON previous.id = next.id
    WHERE next.status IS DISTINCT FROM previous.status
       OR next.deleted_at IS DISTINCT FROM previous.deleted_at
       OR next.catalog_index IS DISTINCT FROM previous.catalog_index
       OR next.mock_id IS DISTINCT FROM previous.mock_id
       OR next.section_id IS DISTINCT FROM previous.section_id
       OR next.set_format IS DISTINCT FROM previous.set_format
  ) THEN RETURN NULL; END IF;

  PERFORM public.refresh_ucat_question_catalog_set_derived_fields_for_stems(ARRAY(
    SELECT DISTINCT member.question_stem_id
    FROM public.question_stems_question_sets member
    WHERE member.question_set_id IN (
      SELECT id FROM new_rows UNION SELECT id FROM old_rows
    )
  ));
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.ucat_compact_previous_published_set_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_had_index_scope BOOLEAN;
  v_should_have_index BOOLEAN;
BEGIN
  IF public.ucat_set_catalog_compact_is_deferred() THEN
    RETURN NULL;
  END IF;

  v_had_index_scope :=
    OLD.deleted_at IS NULL
    AND OLD.status = 'published'
    AND NOT public.ucat_mock_occupies_sets_pool(OLD.mock_id);
  v_should_have_index :=
    NEW.deleted_at IS NULL
    AND NEW.status = 'published'
    AND NOT public.ucat_mock_occupies_sets_pool(NEW.mock_id);

  IF v_had_index_scope
    AND (
      NOT v_should_have_index
      OR NEW.section_id IS DISTINCT FROM OLD.section_id
      OR NEW.set_format IS DISTINCT FROM OLD.set_format
    )
  THEN
    PERFORM public.ucat_compact_standalone_set_catalog(OLD.section_id, OLD.set_format);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.ucat_compact_standalone_set_catalog(
  p_section_id UUID,
  p_set_format public.ucat_question_set_format
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_displacement INTEGER;
  v_refresh_was_deferred BOOLEAN;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_section_id::TEXT || ':' || p_set_format::TEXT,
    20876
  ));

  v_refresh_was_deferred := public.ucat_catalog_refresh_is_deferred();
  PERFORM set_config('altitutor.defer_ucat_catalog_refresh', 'on', TRUE);
  BEGIN
    SELECT COALESCE(max(catalog_index), 0) + count(*)::INTEGER + 1
    INTO v_displacement
    FROM public.question_sets
    WHERE deleted_at IS NULL
      AND catalog_index IS NOT NULL
      AND section_id = p_section_id
      AND set_format = p_set_format;

    UPDATE public.question_sets
    SET catalog_index = catalog_index + v_displacement
    WHERE deleted_at IS NULL
      AND catalog_index IS NOT NULL
      AND section_id = p_section_id
      AND set_format = p_set_format;

    WITH ranked AS (
      SELECT
        id,
        row_number() OVER (ORDER BY catalog_index, created_at, id)::INTEGER AS next_index
      FROM public.question_sets
      WHERE deleted_at IS NULL
        AND catalog_index IS NOT NULL
        AND section_id = p_section_id
        AND set_format = p_set_format
    )
    UPDATE public.question_sets question_set
    SET catalog_index = ranked.next_index
    FROM ranked
    WHERE question_set.id = ranked.id;

    IF NOT v_refresh_was_deferred THEN
      PERFORM public.refresh_ucat_question_catalog_set_derived_fields_for_stems(ARRAY(
        SELECT DISTINCT member.question_stem_id
        FROM public.question_stems_question_sets member
        JOIN public.question_sets question_set ON question_set.id = member.question_set_id
        WHERE question_set.section_id = p_section_id
          AND question_set.set_format = p_set_format
          AND question_set.deleted_at IS NULL
          AND question_set.catalog_index IS NOT NULL
      ));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config(
      'altitutor.defer_ucat_catalog_refresh',
      CASE WHEN v_refresh_was_deferred THEN 'on' ELSE 'off' END,
      TRUE
    );
    RAISE;
  END;
  PERFORM set_config(
    'altitutor.defer_ucat_catalog_refresh',
    CASE WHEN v_refresh_was_deferred THEN 'on' ELSE 'off' END,
    TRUE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ucat_finish_content_status_catalog_effects(
  p_content_type TEXT,
  p_content_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope RECORD;
BEGIN
  IF p_content_type = 'set' THEN
    FOR v_scope IN
      SELECT DISTINCT section_id, set_format
      FROM public.question_sets
      WHERE id = ANY(COALESCE(p_content_ids, ARRAY[]::UUID[]))
        AND section_id IS NOT NULL
        AND set_format IS NOT NULL
    LOOP
      PERFORM public.ucat_compact_standalone_set_catalog(v_scope.section_id, v_scope.set_format);
    END LOOP;
  ELSIF p_content_type = 'mock' THEN
    FOR v_scope IN
      SELECT DISTINCT section_id, set_format
      FROM public.question_sets
      WHERE mock_id = ANY(COALESCE(p_content_ids, ARRAY[]::UUID[]))
        AND section_id IS NOT NULL
        AND set_format IS NOT NULL
    LOOP
      PERFORM public.ucat_compact_standalone_set_catalog(v_scope.section_id, v_scope.set_format);
    END LOOP;
  END IF;

  PERFORM public.refresh_ucat_question_catalog_set_derived_fields_for_stems(ARRAY(
    SELECT DISTINCT member.question_stem_id
    FROM public.question_stems_question_sets member
    WHERE (
      p_content_type = 'stem'
      AND member.question_stem_id = ANY(COALESCE(p_content_ids, ARRAY[]::UUID[]))
    ) OR (
      p_content_type = 'set'
      AND (
        member.question_set_id = ANY(COALESCE(p_content_ids, ARRAY[]::UUID[]))
        OR member.question_set_id IN (
          SELECT pooled.id
          FROM public.question_sets moved
          JOIN public.question_sets pooled
            ON pooled.section_id = moved.section_id
           AND pooled.set_format = moved.set_format
          WHERE moved.id = ANY(COALESCE(p_content_ids, ARRAY[]::UUID[]))
            AND pooled.deleted_at IS NULL
            AND pooled.catalog_index IS NOT NULL
        )
      )
    ) OR (
      p_content_type = 'mock'
      AND member.question_set_id IN (
        SELECT id
        FROM public.question_sets
        WHERE mock_id = ANY(COALESCE(p_content_ids, ARRAY[]::UUID[]))
      )
    )
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_finish_content_status_catalog_effects(TEXT, UUID[])
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_set_content_status_bulk(
  p_content_type TEXT,
  p_content_ids UUID[],
  p_status public.ucat_content_status
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  v_content_id UUID;
  v_moved_ids JSONB := '[]'::jsonb;
  v_failures JSONB := '[]'::jsonb;
  v_refresh_was_deferred BOOLEAN;
  v_compact_was_deferred BOOLEAN;
  v_moved_uuid UUID[];
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF COALESCE(array_length(p_content_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'select_at_least_one_item';
  END IF;

  v_refresh_was_deferred := public.ucat_catalog_refresh_is_deferred();
  v_compact_was_deferred := public.ucat_set_catalog_compact_is_deferred();
  PERFORM set_config('altitutor.defer_ucat_catalog_refresh', 'on', TRUE);
  PERFORM set_config('altitutor.defer_ucat_set_catalog_compact', 'on', TRUE);
  BEGIN
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

    SELECT COALESCE(array_agg(moved_id::UUID), ARRAY[]::UUID[])
    INTO v_moved_uuid
    FROM jsonb_array_elements_text(v_moved_ids) moved_id;

    IF COALESCE(array_length(v_moved_uuid, 1), 0) > 0 THEN
      PERFORM public.ucat_finish_content_status_catalog_effects(p_content_type, v_moved_uuid);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config(
      'altitutor.defer_ucat_catalog_refresh',
      CASE WHEN v_refresh_was_deferred THEN 'on' ELSE 'off' END,
      TRUE
    );
    PERFORM set_config(
      'altitutor.defer_ucat_set_catalog_compact',
      CASE WHEN v_compact_was_deferred THEN 'on' ELSE 'off' END,
      TRUE
    );
    RAISE;
  END;
  PERFORM set_config(
    'altitutor.defer_ucat_catalog_refresh',
    CASE WHEN v_refresh_was_deferred THEN 'on' ELSE 'off' END,
    TRUE
  );
  PERFORM set_config(
    'altitutor.defer_ucat_set_catalog_compact',
    CASE WHEN v_compact_was_deferred THEN 'on' ELSE 'off' END,
    TRUE
  );

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

CREATE OR REPLACE FUNCTION public.tutor_ucat_restore_content_status_bulk(
  p_content_type TEXT,
  p_content_ids UUID[],
  p_current_status public.ucat_content_status,
  p_previous_status public.ucat_content_status
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  v_content_id UUID;
  v_actual_status public.ucat_content_status;
  v_refresh_was_deferred BOOLEAN;
  v_compact_was_deferred BOOLEAN;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF COALESCE(array_length(p_content_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'select_at_least_one_item';
  END IF;

  v_refresh_was_deferred := public.ucat_catalog_refresh_is_deferred();
  v_compact_was_deferred := public.ucat_set_catalog_compact_is_deferred();
  PERFORM set_config('altitutor.defer_ucat_catalog_refresh', 'on', TRUE);
  PERFORM set_config('altitutor.defer_ucat_set_catalog_compact', 'on', TRUE);
  BEGIN
    FOREACH v_content_id IN ARRAY p_content_ids
    LOOP
      BEGIN
        IF p_content_type = 'stem' THEN
          SELECT status INTO v_actual_status FROM public.question_stems
          WHERE id = v_content_id AND deleted_at IS NULL FOR UPDATE;
        ELSIF p_content_type = 'set' THEN
          SELECT status INTO v_actual_status FROM public.question_sets
          WHERE id = v_content_id AND deleted_at IS NULL FOR UPDATE;
        ELSIF p_content_type = 'mock' THEN
          SELECT status INTO v_actual_status FROM public.ucat_mocks
          WHERE id = v_content_id AND deleted_at IS NULL FOR UPDATE;
        ELSE
          RAISE EXCEPTION 'invalid_ucat_content_type';
        END IF;

        IF v_actual_status IS NULL THEN
          RAISE EXCEPTION 'ucat_content_not_found';
        END IF;
        IF v_actual_status <> p_current_status THEN
          RAISE EXCEPTION 'undo_status_changed';
        END IF;

        IF v_actual_status = 'draft' AND p_previous_status = 'published' THEN
          PERFORM public.tutor_ucat_set_content_status(p_content_type, v_content_id, 'in_review');
          PERFORM public.tutor_ucat_set_content_status(p_content_type, v_content_id, 'published');
        ELSE
          PERFORM public.tutor_ucat_set_content_status(p_content_type, v_content_id, p_previous_status);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'bulk_status_item:%:%', v_content_id, SQLERRM;
      END;
    END LOOP;

    PERFORM public.ucat_finish_content_status_catalog_effects(p_content_type, p_content_ids);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config(
      'altitutor.defer_ucat_catalog_refresh',
      CASE WHEN v_refresh_was_deferred THEN 'on' ELSE 'off' END,
      TRUE
    );
    PERFORM set_config(
      'altitutor.defer_ucat_set_catalog_compact',
      CASE WHEN v_compact_was_deferred THEN 'on' ELSE 'off' END,
      TRUE
    );
    RAISE;
  END;
  PERFORM set_config(
    'altitutor.defer_ucat_catalog_refresh',
    CASE WHEN v_refresh_was_deferred THEN 'on' ELSE 'off' END,
    TRUE
  );
  PERFORM set_config(
    'altitutor.defer_ucat_set_catalog_compact',
    CASE WHEN v_compact_was_deferred THEN 'on' ELSE 'off' END,
    TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_restore_content_status_bulk(
  TEXT, UUID[], public.ucat_content_status, public.ucat_content_status
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_restore_content_status_bulk(
  TEXT, UUID[], public.ucat_content_status, public.ucat_content_status
) TO authenticated;
