-- UCAT tutor question catalog read projection.
--
-- The authoring tables remain normalized. This table is an internal, synchronously
-- maintained read model for stem-level filtering/search/pagination and exact
-- duplicate candidate blocking.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.normalize_ucat_catalog_text(value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  normalized_value TEXT := LOWER(COALESCE(value, ''));
BEGIN
  normalized_value := REPLACE(normalized_value, '’', '''');
  normalized_value := REPLACE(normalized_value, '‘', '''');
  normalized_value := REPLACE(normalized_value, '“', '"');
  normalized_value := REPLACE(normalized_value, '”', '"');
  normalized_value := REPLACE(normalized_value, '‐', '-');
  normalized_value := REPLACE(normalized_value, '‑', '-');
  normalized_value := REPLACE(normalized_value, '‒', '-');
  normalized_value := REPLACE(normalized_value, '–', '-');
  normalized_value := REPLACE(normalized_value, '—', '-');
  normalized_value := REPLACE(normalized_value, '―', '-');
  RETURN BTRIM(REGEXP_REPLACE(normalized_value, '[[:space:]]+', ' ', 'g'));
END;
$$;

CREATE OR REPLACE FUNCTION public.ucat_catalog_media_identity(json_content JSONB)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  node JSONB;
  result TEXT := '';
  media_identity TEXT;
BEGIN
  IF json_content IS NULL OR json_content = 'null'::JSONB THEN
    RETURN '';
  END IF;

  IF json_content->>'type' = 'image' THEN
    media_identity := COALESCE(
      json_content->'attrs'->>'fileId',
      json_content->'attrs'->>'file_id',
      json_content->'attrs'->>'storagePath',
      json_content->'attrs'->>'storage_path',
      json_content->'attrs'->>'src',
      (json_content->'attrs')::TEXT,
      ''
    );
    RETURN public.normalize_ucat_catalog_text(media_identity);
  END IF;

  IF json_content ? 'content' AND JSONB_TYPEOF(json_content->'content') = 'array' THEN
    FOR node IN
      SELECT value
      FROM JSONB_ARRAY_ELEMENTS(json_content->'content')
    LOOP
      media_identity := public.ucat_catalog_media_identity(node);
      IF media_identity <> '' THEN
        result := result || CASE WHEN result = '' THEN '' ELSE '|' END || media_identity;
      END IF;
    END LOOP;
  END IF;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.canonical_ucat_catalog_rich_text(json_content JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT public.normalize_ucat_catalog_text(
    public.extract_text_from_prosemirror_json(json_content)
  )
  || CASE
    WHEN public.ucat_catalog_media_identity(json_content) = '' THEN ''
    ELSE '|media:' || public.ucat_catalog_media_identity(json_content)
  END;
$$;

CREATE TABLE public.ucat_question_catalog_projection (
  stem_id UUID PRIMARY KEY REFERENCES public.question_stems(id) ON DELETE CASCADE,
  question_count INTEGER NOT NULL DEFAULT 0,
  tag_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
  question_types TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  set_ids UUID[] NOT NULL DEFAULT '{}'::UUID[],
  set_names JSONB NOT NULL DEFAULT '[]'::JSONB,
  set_names_text TEXT NOT NULL DEFAULT '',
  stem_search_text TEXT NOT NULL DEFAULT '',
  question_search_text TEXT NOT NULL DEFAULT '',
  answer_option_search_text TEXT NOT NULL DEFAULT '',
  tutor_source_note_search_text TEXT NOT NULL DEFAULT '',
  stem_comparison_text TEXT NOT NULL DEFAULT '',
  stem_comparison_hash TEXT NOT NULL DEFAULT '',
  question_text_fingerprint TEXT NOT NULL DEFAULT '',
  question_bundle_fingerprint TEXT NOT NULL DEFAULT '',
  is_available_in_question_pool BOOLEAN NOT NULL DEFAULT FALSE,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ucat_question_catalog_projection ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ucat_question_catalog_projection FROM PUBLIC, anon, authenticated;

CREATE INDEX question_stems_catalog_active_status_updated_idx
  ON public.question_stems (status, updated_at DESC NULLS LAST, id)
  WHERE deleted_at IS NULL;

CREATE INDEX question_stems_catalog_active_status_created_idx
  ON public.question_stems (status, created_at, id)
  WHERE deleted_at IS NULL;

CREATE INDEX question_stems_catalog_deleted_updated_idx
  ON public.question_stems (updated_at DESC NULLS LAST, id)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX ucat_question_catalog_tag_ids_idx
  ON public.ucat_question_catalog_projection USING GIN (tag_ids);

CREATE INDEX ucat_question_catalog_question_types_idx
  ON public.ucat_question_catalog_projection USING GIN (question_types);

CREATE INDEX ucat_question_catalog_set_ids_idx
  ON public.ucat_question_catalog_projection USING GIN (set_ids);

CREATE INDEX ucat_question_catalog_stem_search_idx
  ON public.ucat_question_catalog_projection
  USING GIN (stem_search_text extensions.gin_trgm_ops);

CREATE INDEX ucat_question_catalog_question_search_idx
  ON public.ucat_question_catalog_projection
  USING GIN (question_search_text extensions.gin_trgm_ops);

CREATE INDEX ucat_question_catalog_answer_search_idx
  ON public.ucat_question_catalog_projection
  USING GIN (answer_option_search_text extensions.gin_trgm_ops);

CREATE INDEX ucat_question_catalog_source_note_search_idx
  ON public.ucat_question_catalog_projection
  USING GIN (tutor_source_note_search_text extensions.gin_trgm_ops);

CREATE INDEX ucat_question_catalog_duplicate_block_idx
  ON public.ucat_question_catalog_projection (stem_comparison_hash, stem_id)
  WHERE stem_comparison_text <> '';

CREATE OR REPLACE FUNCTION public.refresh_ucat_question_catalog_projection(p_stem_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_stem_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.ucat_question_catalog_projection projection
  WHERE projection.stem_id = p_stem_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.question_stems stem
      WHERE stem.id = p_stem_id
    );

  IF NOT EXISTS (SELECT 1 FROM public.question_stems stem WHERE stem.id = p_stem_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.ucat_question_catalog_projection (
    stem_id,
    question_count,
    tag_ids,
    question_types,
    set_ids,
    set_names,
    set_names_text,
    stem_search_text,
    question_search_text,
    answer_option_search_text,
    tutor_source_note_search_text,
    stem_comparison_text,
    stem_comparison_hash,
    question_text_fingerprint,
    question_bundle_fingerprint,
    is_available_in_question_pool,
    refreshed_at
  )
  SELECT
    stem.id,
    COALESCE(question_summary.question_count, 0),
    COALESCE(tag_summary.tag_ids, '{}'::UUID[]),
    COALESCE(question_summary.question_types, '{}'::TEXT[]),
    COALESCE(set_summary.set_ids, '{}'::UUID[]),
    COALESCE(set_summary.set_names, '[]'::JSONB),
    COALESCE(set_summary.set_names_text, ''),
    public.normalize_ucat_catalog_text(
      public.extract_text_from_prosemirror_json(stem.stem_text)
    ),
    COALESCE(question_summary.question_search_text, ''),
    COALESCE(question_summary.answer_option_search_text, ''),
    public.normalize_ucat_catalog_text(stem.tutor_source_note),
    public.canonical_ucat_catalog_rich_text(stem.stem_text),
    MD5(public.canonical_ucat_catalog_rich_text(stem.stem_text)),
    COALESCE(question_summary.question_text_fingerprint, MD5('[]')),
    COALESCE(question_summary.question_bundle_fingerprint, MD5('[]')),
    (
      stem.deleted_at IS NULL
      AND stem.status = 'published'
      AND stem.access_scope = 'public'
      AND COALESCE(set_summary.published_set_count, 0) = 0
    ),
    NOW()
  FROM public.question_stems stem
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER AS question_count,
      COALESCE(
        ARRAY_AGG(DISTINCT question.question_type::TEXT ORDER BY question.question_type::TEXT),
        '{}'::TEXT[]
      ) AS question_types,
      COALESCE(
        STRING_AGG(
          public.normalize_ucat_catalog_text(
            public.extract_text_from_prosemirror_json(question.question_text)
          ),
          ' ' ORDER BY question.index, question.id
        ),
        ''
      ) AS question_search_text,
      COALESCE(
        STRING_AGG(
          (
            SELECT COALESCE(
              STRING_AGG(
                public.normalize_ucat_catalog_text(
                  public.extract_text_from_prosemirror_json(answer_option.answer_text)
                ),
                ' ' ORDER BY answer_option.index, answer_option.id
              ),
              ''
            )
            FROM public.question_answer_options answer_option
            WHERE answer_option.question_id = question.id
              AND answer_option.deleted_at IS NULL
          ),
          ' ' ORDER BY question.index, question.id
        ),
        ''
      ) AS answer_option_search_text,
      MD5(
        COALESCE(
          JSONB_AGG(
            JSONB_BUILD_OBJECT(
              'question_type', question.question_type::TEXT,
              'question_text', public.canonical_ucat_catalog_rich_text(question.question_text)
            )
            ORDER BY question.index, question.id
          )::TEXT,
          '[]'
        )
      ) AS question_text_fingerprint,
      MD5(
        COALESCE(
          JSONB_AGG(
            JSONB_BUILD_OBJECT(
              'question_type', question.question_type::TEXT,
              'question_text', public.canonical_ucat_catalog_rich_text(question.question_text),
              'answer_explanation', public.canonical_ucat_catalog_rich_text(question.answer_explanation),
              'answer_options', (
                SELECT COALESCE(
                  JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                      'answer_text', public.canonical_ucat_catalog_rich_text(answer_option.answer_text),
                      'answer_explanation', public.canonical_ucat_catalog_rich_text(answer_option.answer_explanation),
                      'is_answer', answer_option.is_answer
                    )
                    ORDER BY answer_option.index, answer_option.id
                  ),
                  '[]'::JSONB
                )
                FROM public.question_answer_options answer_option
                WHERE answer_option.question_id = question.id
                  AND answer_option.deleted_at IS NULL
              )
            )
            ORDER BY question.index, question.id
          )::TEXT,
          '[]'
        )
      ) AS question_bundle_fingerprint
    FROM public.ucat_questions question
    WHERE question.question_stem_id = stem.id
      AND question.deleted_at IS NULL
  ) question_summary ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(ARRAY_AGG(DISTINCT link.tag_id ORDER BY link.tag_id), '{}'::UUID[]) AS tag_ids
    FROM public.questions_question_tags link
    JOIN public.ucat_questions question ON question.id = link.question_id
    WHERE question.question_stem_id = stem.id
      AND question.deleted_at IS NULL
  ) tag_summary ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(ARRAY_AGG(question_set.id ORDER BY question_set.updated_at DESC NULLS LAST, question_set.id), '{}'::UUID[]) AS set_ids,
      COALESCE(JSONB_AGG(question_set.name ORDER BY question_set.updated_at DESC NULLS LAST, question_set.id), '[]'::JSONB) AS set_names,
      COALESCE(
        STRING_AGG(
          public.normalize_ucat_catalog_text(
            public.extract_text_from_prosemirror_json(question_set.name)
          ),
          ', ' ORDER BY question_set.updated_at DESC NULLS LAST, question_set.id
        ),
        ''
      ) AS set_names_text,
      COUNT(*) FILTER (WHERE question_set.status = 'published')::INTEGER AS published_set_count
    FROM public.question_stems_question_sets member
    JOIN public.question_sets question_set
      ON question_set.id = member.question_set_id
      AND question_set.deleted_at IS NULL
    WHERE member.question_stem_id = stem.id
  ) set_summary ON TRUE
  WHERE stem.id = p_stem_id
  ON CONFLICT (stem_id) DO UPDATE SET
    question_count = EXCLUDED.question_count,
    tag_ids = EXCLUDED.tag_ids,
    question_types = EXCLUDED.question_types,
    set_ids = EXCLUDED.set_ids,
    set_names = EXCLUDED.set_names,
    set_names_text = EXCLUDED.set_names_text,
    stem_search_text = EXCLUDED.stem_search_text,
    question_search_text = EXCLUDED.question_search_text,
    answer_option_search_text = EXCLUDED.answer_option_search_text,
    tutor_source_note_search_text = EXCLUDED.tutor_source_note_search_text,
    stem_comparison_text = EXCLUDED.stem_comparison_text,
    stem_comparison_hash = EXCLUDED.stem_comparison_hash,
    question_text_fingerprint = EXCLUDED.question_text_fingerprint,
    question_bundle_fingerprint = EXCLUDED.question_bundle_fingerprint,
    is_available_in_question_pool = EXCLUDED.is_available_in_question_pool,
    refreshed_at = EXCLUDED.refreshed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_ucat_catalog_text(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ucat_catalog_media_identity(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.canonical_ucat_catalog_rich_text(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_ucat_question_catalog_projection(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_ucat_question_catalog_projection_for_stems(stem_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  stem_id UUID;
BEGIN
  FOR stem_id IN
    SELECT DISTINCT value
    FROM UNNEST(COALESCE(stem_ids, '{}'::UUID[])) value
    WHERE value IS NOT NULL
  LOOP
    PERFORM public.refresh_ucat_question_catalog_projection(stem_id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_ucat_question_catalog_projection_for_stems(UUID[])
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trigger_refresh_ucat_catalog_from_stems()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
      ARRAY(SELECT id FROM new_rows)
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
      ARRAY(SELECT id FROM old_rows)
    );
  ELSE
    PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
      ARRAY(
        SELECT id FROM new_rows
        UNION
        SELECT id FROM old_rows
      )
    );
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_refresh_ucat_catalog_from_questions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
      ARRAY(SELECT question_stem_id FROM new_rows)
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
      ARRAY(SELECT question_stem_id FROM old_rows)
    );
  ELSE
    PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
      ARRAY(
        SELECT question_stem_id FROM new_rows
        UNION
        SELECT question_stem_id FROM old_rows
      )
    );
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_refresh_ucat_catalog_from_answer_options()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  question_ids UUID[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    question_ids := ARRAY(SELECT question_id FROM new_rows);
  ELSIF TG_OP = 'DELETE' THEN
    question_ids := ARRAY(SELECT question_id FROM old_rows);
  ELSE
    question_ids := ARRAY(
      SELECT question_id FROM new_rows
      UNION
      SELECT question_id FROM old_rows
    );
  END IF;

  PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
    ARRAY(
      SELECT DISTINCT question.question_stem_id
      FROM public.ucat_questions question
      WHERE question.id = ANY(COALESCE(question_ids, '{}'::UUID[]))
    )
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_refresh_ucat_catalog_from_question_tags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  question_ids UUID[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    question_ids := ARRAY(SELECT question_id FROM new_rows);
  ELSIF TG_OP = 'DELETE' THEN
    question_ids := ARRAY(SELECT question_id FROM old_rows);
  ELSE
    question_ids := ARRAY(
      SELECT question_id FROM new_rows
      UNION
      SELECT question_id FROM old_rows
    );
  END IF;

  PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
    ARRAY(
      SELECT DISTINCT question.question_stem_id
      FROM public.ucat_questions question
      WHERE question.id = ANY(COALESCE(question_ids, '{}'::UUID[]))
    )
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_refresh_ucat_catalog_from_set_memberships()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
      ARRAY(SELECT question_stem_id FROM new_rows)
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
      ARRAY(SELECT question_stem_id FROM old_rows)
    );
  ELSE
    PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
      ARRAY(
        SELECT question_stem_id FROM new_rows
        UNION
        SELECT question_stem_id FROM old_rows
      )
    );
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_refresh_ucat_catalog_from_sets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.refresh_ucat_question_catalog_projection_for_stems(
    ARRAY(
      SELECT DISTINCT member.question_stem_id
      FROM public.question_stems_question_sets member
      WHERE member.question_set_id IN (
        SELECT id FROM new_rows
        UNION
        SELECT id FROM old_rows
      )
    )
  );
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_refresh_ucat_catalog_from_stems() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_refresh_ucat_catalog_from_questions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_refresh_ucat_catalog_from_answer_options() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_refresh_ucat_catalog_from_question_tags() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_refresh_ucat_catalog_from_set_memberships() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_refresh_ucat_catalog_from_sets() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER refresh_ucat_catalog_after_stem_insert
AFTER INSERT ON public.question_stems
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_refresh_ucat_catalog_from_stems();

CREATE TRIGGER refresh_ucat_catalog_after_stem_update
AFTER UPDATE ON public.question_stems
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_refresh_ucat_catalog_from_stems();

CREATE TRIGGER refresh_ucat_catalog_after_stem_delete
AFTER DELETE ON public.question_stems
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_refresh_ucat_catalog_from_stems();

CREATE TRIGGER refresh_ucat_catalog_after_question_insert
AFTER INSERT ON public.ucat_questions
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_refresh_ucat_catalog_from_questions();

CREATE TRIGGER refresh_ucat_catalog_after_question_update
AFTER UPDATE ON public.ucat_questions
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_refresh_ucat_catalog_from_questions();

CREATE TRIGGER refresh_ucat_catalog_after_question_delete
AFTER DELETE ON public.ucat_questions
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_refresh_ucat_catalog_from_questions();

CREATE TRIGGER refresh_ucat_catalog_after_option_insert
AFTER INSERT ON public.question_answer_options
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_refresh_ucat_catalog_from_answer_options();

CREATE TRIGGER refresh_ucat_catalog_after_option_update
AFTER UPDATE ON public.question_answer_options
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_refresh_ucat_catalog_from_answer_options();

CREATE TRIGGER refresh_ucat_catalog_after_option_delete
AFTER DELETE ON public.question_answer_options
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_refresh_ucat_catalog_from_answer_options();

CREATE TRIGGER refresh_ucat_catalog_after_tag_insert
AFTER INSERT ON public.questions_question_tags
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_refresh_ucat_catalog_from_question_tags();

CREATE TRIGGER refresh_ucat_catalog_after_tag_update
AFTER UPDATE ON public.questions_question_tags
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_refresh_ucat_catalog_from_question_tags();

CREATE TRIGGER refresh_ucat_catalog_after_tag_delete
AFTER DELETE ON public.questions_question_tags
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_refresh_ucat_catalog_from_question_tags();

CREATE TRIGGER refresh_ucat_catalog_after_membership_insert
AFTER INSERT ON public.question_stems_question_sets
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_refresh_ucat_catalog_from_set_memberships();

CREATE TRIGGER refresh_ucat_catalog_after_membership_update
AFTER UPDATE ON public.question_stems_question_sets
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_refresh_ucat_catalog_from_set_memberships();

CREATE TRIGGER refresh_ucat_catalog_after_membership_delete
AFTER DELETE ON public.question_stems_question_sets
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_refresh_ucat_catalog_from_set_memberships();

CREATE TRIGGER refresh_ucat_catalog_after_set_update
AFTER UPDATE ON public.question_sets
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_refresh_ucat_catalog_from_sets();

DO $$
DECLARE
  stem_id UUID;
BEGIN
  FOR stem_id IN SELECT id FROM public.question_stems
  LOOP
    PERFORM public.refresh_ucat_question_catalog_projection(stem_id);
  END LOOP;
END;
$$;

CREATE VIEW public.vtutor_ucat_question_catalog
WITH (security_invoker = false)
AS
SELECT
  stem.id,
  stem.section_id,
  section.section_number,
  section.name AS section_name,
  section.display_columns AS section_display_columns,
  stem.question_stem_category_id,
  category.name AS category_name,
  stem.status,
  stem.access_scope,
  stem.status_changed_at,
  stem.status_changed_by,
  status_staff.first_name AS status_changed_by_first_name,
  status_staff.last_name AS status_changed_by_last_name,
  stem.ai_generation_metadata,
  stem.source_channel,
  stem.tutor_source_note,
  stem.stem_text,
  stem.created_at,
  stem.updated_at,
  stem.created_by,
  stem.updated_by,
  stem.deleted_at,
  stem.deleted_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  updated_staff.first_name AS updated_by_first_name,
  updated_staff.last_name AS updated_by_last_name,
  projection.question_count,
  TO_JSONB(projection.set_names) AS set_names,
  projection.set_ids,
  projection.tag_ids,
  projection.question_types,
  projection.set_names_text,
  projection.stem_search_text,
  projection.question_search_text,
  projection.answer_option_search_text,
  projection.tutor_source_note_search_text,
  projection.stem_comparison_text,
  projection.stem_comparison_hash,
  projection.question_text_fingerprint,
  projection.question_bundle_fingerprint,
  projection.is_available_in_question_pool
FROM public.question_stems stem
JOIN public.ucat_question_catalog_projection projection ON projection.stem_id = stem.id
JOIN public.ucat_sections section ON section.id = stem.section_id
LEFT JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
LEFT JOIN public.staff created_staff ON created_staff.id = stem.created_by
LEFT JOIN public.staff updated_staff ON updated_staff.id = stem.updated_by
LEFT JOIN public.staff status_staff ON status_staff.id = stem.status_changed_by
WHERE public.is_ucat_tutor();

REVOKE ALL ON TABLE public.vtutor_ucat_question_catalog FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.vtutor_ucat_question_catalog TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_list_question_catalog(
  p_status TEXT DEFAULT 'draft',
  p_show_deleted BOOLEAN DEFAULT FALSE,
  p_search TEXT DEFAULT NULL,
  p_search_scopes TEXT[] DEFAULT ARRAY['stem_text', 'question_text', 'answer_option_text', 'tutor_source_note']::TEXT[],
  p_section_ids UUID[] DEFAULT NULL,
  p_category_ids UUID[] DEFAULT NULL,
  p_include_no_category BOOLEAN DEFAULT FALSE,
  p_tag_ids UUID[] DEFAULT NULL,
  p_access_scopes TEXT[] DEFAULT NULL,
  p_question_types TEXT[] DEFAULT NULL,
  p_set_ids UUID[] DEFAULT NULL,
  p_include_without_set BOOLEAN DEFAULT FALSE,
  p_source_channels TEXT[] DEFAULT NULL,
  p_created_by UUID[] DEFAULT NULL,
  p_created_from TIMESTAMPTZ DEFAULT NULL,
  p_created_to TIMESTAMPTZ DEFAULT NULL,
  p_sort_by TEXT DEFAULT NULL,
  p_sort_direction TEXT DEFAULT 'desc',
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20,
  p_ids_only BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
  safe_page INTEGER := GREATEST(COALESCE(p_page, 1), 1);
  safe_page_size INTEGER := LEAST(
    GREATEST(COALESCE(p_page_size, 20), 1),
    CASE WHEN p_ids_only THEN 50000 ELSE 100 END
  );
  safe_search TEXT := LOWER(BTRIM(REGEXP_REPLACE(COALESCE(p_search, ''), '[[:space:]]+', ' ', 'g')));
  safe_like_search TEXT;
  safe_direction TEXT := CASE WHEN LOWER(COALESCE(p_sort_direction, 'desc')) = 'asc' THEN 'asc' ELSE 'desc' END;
BEGIN
  IF NOT public.is_ucat_tutor() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  safe_search := REPLACE(safe_search, '’', '''');
  safe_search := REPLACE(safe_search, '‘', '''');
  safe_search := REPLACE(safe_search, '“', '"');
  safe_search := REPLACE(safe_search, '”', '"');
  safe_search := REPLACE(safe_search, '‐', '-');
  safe_search := REPLACE(safe_search, '‑', '-');
  safe_search := REPLACE(safe_search, '‒', '-');
  safe_search := REPLACE(safe_search, '–', '-');
  safe_search := REPLACE(safe_search, '—', '-');
  safe_search := REPLACE(safe_search, '―', '-');
  safe_like_search := REPLACE(
    REPLACE(REPLACE(safe_search, E'\\', E'\\\\'), '%', E'\\%'),
    '_',
    E'\\_'
  );

  IF p_status IS NOT NULL AND p_status NOT IN ('draft', 'in_review', 'published') THEN
    RAISE EXCEPTION 'invalid question catalog status';
  END IF;

  WITH filtered AS MATERIALIZED (
    SELECT catalog.*
    FROM public.vtutor_ucat_question_catalog catalog
    WHERE
      (
        (p_show_deleted AND catalog.deleted_at IS NOT NULL)
        OR
        (
          NOT p_show_deleted
          AND catalog.deleted_at IS NULL
          AND catalog.status::TEXT = COALESCE(p_status, 'draft')
        )
      )
      AND (
        safe_search = ''
        OR (
          ('stem_text' = ANY(COALESCE(p_search_scopes, '{}'::TEXT[]))
            AND catalog.stem_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\')
          OR ('question_text' = ANY(COALESCE(p_search_scopes, '{}'::TEXT[]))
            AND catalog.question_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\')
          OR ('answer_option_text' = ANY(COALESCE(p_search_scopes, '{}'::TEXT[]))
            AND catalog.answer_option_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\')
          OR ('tutor_source_note' = ANY(COALESCE(p_search_scopes, '{}'::TEXT[]))
            AND catalog.tutor_source_note_search_text LIKE '%' || safe_like_search || '%' ESCAPE E'\\')
        )
      )
      AND (COALESCE(CARDINALITY(p_section_ids), 0) = 0 OR catalog.section_id = ANY(p_section_ids))
      AND (
        (COALESCE(CARDINALITY(p_category_ids), 0) = 0 AND NOT p_include_no_category)
        OR catalog.question_stem_category_id = ANY(COALESCE(p_category_ids, '{}'::UUID[]))
        OR (p_include_no_category AND catalog.question_stem_category_id IS NULL)
      )
      AND (COALESCE(CARDINALITY(p_tag_ids), 0) = 0 OR catalog.tag_ids && p_tag_ids)
      AND (
        COALESCE(CARDINALITY(p_access_scopes), 0) = 0
        OR catalog.access_scope::TEXT = ANY(p_access_scopes)
      )
      AND (
        COALESCE(CARDINALITY(p_question_types), 0) = 0
        OR catalog.question_types && p_question_types
      )
      AND (
        (COALESCE(CARDINALITY(p_set_ids), 0) = 0 AND NOT p_include_without_set)
        OR catalog.set_ids && COALESCE(p_set_ids, '{}'::UUID[])
        OR (p_include_without_set AND CARDINALITY(catalog.set_ids) = 0)
      )
      AND (
        COALESCE(CARDINALITY(p_source_channels), 0) = 0
        OR catalog.source_channel::TEXT = ANY(p_source_channels)
      )
      AND (COALESCE(CARDINALITY(p_created_by), 0) = 0 OR catalog.created_by = ANY(p_created_by))
      AND (p_created_from IS NULL OR catalog.created_at >= p_created_from)
      AND (p_created_to IS NULL OR catalog.created_at <= p_created_to)
  ),
  ranked AS (
    SELECT
      filtered.*,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE WHEN p_sort_by = 'section_name' AND safe_direction = 'asc' THEN section_name END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'section_name' AND safe_direction = 'desc' THEN section_name END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'category_name' AND safe_direction = 'asc' THEN category_name END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'category_name' AND safe_direction = 'desc' THEN category_name END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'question_count' AND safe_direction = 'asc' THEN question_count END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'question_count' AND safe_direction = 'desc' THEN question_count END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'sets' AND safe_direction = 'asc' THEN set_names_text END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'sets' AND safe_direction = 'desc' THEN set_names_text END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'type_summary' AND safe_direction = 'asc' THEN ARRAY_TO_STRING(question_types, ',') END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'type_summary' AND safe_direction = 'desc' THEN ARRAY_TO_STRING(question_types, ',') END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'visibility' AND safe_direction = 'asc' THEN access_scope::TEXT END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'visibility' AND safe_direction = 'desc' THEN access_scope::TEXT END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'source' AND safe_direction = 'asc' THEN source_channel::TEXT END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'source' AND safe_direction = 'desc' THEN source_channel::TEXT END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'created_at' AND safe_direction = 'asc' THEN created_at END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'created_at' AND safe_direction = 'desc' THEN created_at END DESC NULLS LAST,
          CASE WHEN p_sort_by = 'status' AND safe_direction = 'asc' THEN status::TEXT END ASC NULLS LAST,
          CASE WHEN p_sort_by = 'status' AND safe_direction = 'desc' THEN status::TEXT END DESC NULLS LAST,
          CASE WHEN p_sort_by IS NULL AND safe_direction = 'asc' THEN updated_at END ASC NULLS LAST,
          CASE WHEN p_sort_by IS NULL AND safe_direction = 'desc' THEN updated_at END DESC NULLS LAST,
          id ASC
      ) AS result_ordinal
    FROM filtered
  ),
  page_rows AS (
    SELECT *
    FROM ranked
    WHERE result_ordinal > (safe_page - 1) * safe_page_size
      AND result_ordinal <= safe_page * safe_page_size
  )
  SELECT JSONB_BUILD_OBJECT(
    'items',
    COALESCE(
      JSONB_AGG(
        CASE
          WHEN p_ids_only THEN JSONB_BUILD_OBJECT('id', id)
          ELSE TO_JSONB(page_rows)
            - 'result_ordinal'
            - 'stem_search_text'
            - 'question_search_text'
            - 'answer_option_search_text'
            - 'tutor_source_note_search_text'
            - 'stem_comparison_text'
            - 'stem_comparison_hash'
            - 'question_text_fingerprint'
            - 'question_bundle_fingerprint'
            - 'set_names_text'
        END
        ORDER BY result_ordinal
      ),
      '[]'::JSONB
    ),
    'total', (SELECT COUNT(*) FROM filtered),
    'page', safe_page,
    'pageSize', safe_page_size
  )
  INTO result
  FROM page_rows;

  RETURN COALESCE(
    result,
    JSONB_BUILD_OBJECT('items', '[]'::JSONB, 'total', 0, 'page', safe_page, 'pageSize', safe_page_size)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_list_question_catalog(
  TEXT, BOOLEAN, TEXT, TEXT[], UUID[], UUID[], BOOLEAN, UUID[], TEXT[], TEXT[],
  UUID[], BOOLEAN, TEXT[], UUID[], TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_list_question_catalog(
  TEXT, BOOLEAN, TEXT, TEXT[], UUID[], UUID[], BOOLEAN, UUID[], TEXT[], TEXT[],
  UUID[], BOOLEAN, TEXT[], UUID[], TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN
) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_question_catalog_creators()
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT DISTINCT catalog.created_by, catalog.created_by_first_name, catalog.created_by_last_name
  FROM public.vtutor_ucat_question_catalog catalog
  WHERE public.is_ucat_tutor()
    AND catalog.created_by IS NOT NULL
  ORDER BY catalog.created_by_first_name NULLS LAST, catalog.created_by_last_name NULLS LAST, catalog.created_by;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_question_catalog_creators() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_question_catalog_creators() TO authenticated;
