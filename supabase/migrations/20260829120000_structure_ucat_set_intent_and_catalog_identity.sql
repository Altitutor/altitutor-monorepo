-- UCAT set/mock catalog identity, structured timing intent, and single-mock ownership.
-- The legacy membership table is retained only during this migration while live
-- readers and writers are replaced, then dropped before commit.

CREATE TYPE public.ucat_question_set_format AS ENUM ('full_section', 'partial_section');
CREATE TYPE public.ucat_question_set_timing_mode AS ENUM ('pace', 'fixed', 'untimed');

ALTER TABLE public.ucat_mocks
  ADD COLUMN authoring_note TEXT,
  ADD COLUMN catalog_index INTEGER;

ALTER TABLE public.question_sets
  ADD COLUMN authoring_note TEXT,
  ADD COLUMN set_format public.ucat_question_set_format,
  ADD COLUMN timing_mode public.ucat_question_set_timing_mode,
  ADD COLUMN pace_multiplier NUMERIC,
  ADD COLUMN fixed_time_limit_seconds INTEGER,
  ADD COLUMN reference_blueprint_id UUID REFERENCES public.ucat_mock_blueprints(id) ON DELETE RESTRICT,
  ADD COLUMN mock_id UUID REFERENCES public.ucat_mocks(id) ON DELETE RESTRICT,
  ADD COLUMN catalog_index INTEGER;

CREATE INDEX idx_question_sets_reference_blueprint_id
  ON public.question_sets(reference_blueprint_id);
CREATE INDEX idx_question_sets_mock_id
  ON public.question_sets(mock_id)
  WHERE mock_id IS NOT NULL;

-- Preserve every prior free name as tutor-only editorial context.
UPDATE public.ucat_mocks
SET authoring_note = NULLIF(BTRIM(name), '');

UPDATE public.question_sets
SET authoring_note = NULLIF(BTRIM(public.extract_text_from_prosemirror_json(name)), '');

-- A pre-cutover shared set is cloned for its second and later mock placements.
-- This preserves each mock's content while establishing single ownership.
DO $$
DECLARE
  v_member RECORD;
  v_clone_id UUID;
BEGIN
  FOR v_member IN
    SELECT member.id, member.question_set_id
    FROM (
      SELECT membership.*,
        row_number() OVER (
          PARTITION BY membership.question_set_id
          ORDER BY membership.created_at NULLS LAST, membership.id
        ) AS placement_number
      FROM public.question_sets_ucat_mocks membership
    ) member
    WHERE member.placement_number > 1
    ORDER BY member.question_set_id, member.placement_number
  LOOP
    INSERT INTO public.question_sets (
      description, time_limit_seconds, created_at, created_by, updated_at, updated_by,
      name, sections, time_limit_at_exam_speed_seconds, speed, deleted_at, deleted_by,
      status, access_scope, status_changed_at, status_changed_by, published_at,
      published_by, section_id, authoring_note
    )
    SELECT
      source.description, source.time_limit_seconds, source.created_at, source.created_by,
      source.updated_at, source.updated_by, source.name, source.sections,
      source.time_limit_at_exam_speed_seconds, source.speed, source.deleted_at,
      source.deleted_by, source.status, source.access_scope, source.status_changed_at,
      source.status_changed_by, source.published_at, source.published_by,
      source.section_id, source.authoring_note
    FROM public.question_sets source
    WHERE source.id = v_member.question_set_id
    RETURNING id INTO v_clone_id;

    INSERT INTO public.question_stems_question_sets (
      question_stem_id, question_set_id, index, created_at, created_by, updated_at, updated_by
    )
    SELECT question_stem_id, v_clone_id, index, created_at, created_by, updated_at, updated_by
    FROM public.question_stems_question_sets
    WHERE question_set_id = v_member.question_set_id;

    UPDATE public.question_sets_ucat_mocks
    SET question_set_id = v_clone_id
    WHERE id = v_member.id;
  END LOOP;
END;
$$;

-- Every mock and set must point at an immutable managed blueprint. Existing
-- unversioned rows are assessed against the newest managed version; incompatible
-- mocks are archived below rather than kept on a legacy runtime path.
DO $$
DECLARE
  v_blueprint_id UUID;
BEGIN
  SELECT id INTO v_blueprint_id
  FROM public.ucat_mock_blueprints
  ORDER BY test_year DESC, version DESC, id
  LIMIT 1;

  IF v_blueprint_id IS NULL AND (
    EXISTS (SELECT 1 FROM public.ucat_mocks)
    OR EXISTS (SELECT 1 FROM public.question_sets)
  ) THEN
    RAISE EXCEPTION 'ucat_catalog_cutover_requires_managed_blueprint';
  END IF;

  UPDATE public.ucat_mocks
  SET blueprint_id = v_blueprint_id
  WHERE blueprint_id IS NULL;

  UPDATE public.question_sets question_set
  SET mock_id = membership.ucat_mock_id
  FROM public.question_sets_ucat_mocks membership
  WHERE membership.question_set_id = question_set.id;

  -- If malformed legacy data placed two same-section sets in one mock, keep the
  -- earliest placement attached and preserve later rows as standalone sets.
  WITH ranked AS (
    SELECT question_set.id,
      row_number() OVER (
        PARTITION BY question_set.mock_id, question_set.section_id
        ORDER BY membership.index, question_set.created_at, question_set.id
      ) AS section_placement
    FROM public.question_sets question_set
    JOIN public.question_sets_ucat_mocks membership
      ON membership.question_set_id = question_set.id
    WHERE question_set.mock_id IS NOT NULL
  )
  UPDATE public.question_sets question_set
  SET mock_id = NULL
  FROM ranked
  WHERE ranked.id = question_set.id
    AND ranked.section_placement > 1;

  UPDATE public.question_sets question_set
  SET reference_blueprint_id = COALESCE(mock.blueprint_id, v_blueprint_id)
  FROM public.ucat_mocks mock
  WHERE mock.id = question_set.mock_id;

  UPDATE public.question_sets
  SET reference_blueprint_id = v_blueprint_id
  WHERE reference_blueprint_id IS NULL;
END;
$$;

-- Infer prior timing intent from the old exam-speed ratio. Timed legacy sets
-- already carried enough information to recover pace; untimed sets remain so.
UPDATE public.question_sets
SET
  set_format = CASE
    WHEN mock_id IS NOT NULL THEN 'full_section'::public.ucat_question_set_format
    ELSE 'partial_section'::public.ucat_question_set_format
  END,
  timing_mode = CASE
    WHEN mock_id IS NOT NULL OR time_limit_seconds IS NOT NULL
      THEN 'pace'::public.ucat_question_set_timing_mode
    ELSE 'untimed'::public.ucat_question_set_timing_mode
  END,
  pace_multiplier = CASE
    WHEN mock_id IS NOT NULL THEN 1
    WHEN time_limit_seconds IS NOT NULL THEN GREATEST(COALESCE(speed, 1), 0.01)
    ELSE NULL
  END,
  fixed_time_limit_seconds = NULL;

-- Standalone sets that exactly match their referenced blueprint total are full
-- sections; all other standalone sets are partial sections.
UPDATE public.question_sets question_set
SET set_format = 'full_section'
FROM public.ucat_sections section,
     public.ucat_mock_blueprint_sections blueprint_section
WHERE question_set.mock_id IS NULL
  AND section.id = question_set.section_id
  AND blueprint_section.blueprint_id = question_set.reference_blueprint_id
  AND blueprint_section.section_index = section.section_number - 1
  AND blueprint_section.exact_question_count = (
    SELECT count(question.id)::INTEGER
    FROM public.question_stems_question_sets member
    JOIN public.ucat_questions question
      ON question.question_stem_id = member.question_stem_id
     AND question.deleted_at IS NULL
    WHERE member.question_set_id = question_set.id
  );

WITH ranked AS (
  SELECT id,
    row_number() OVER (
      ORDER BY created_at NULLS LAST, id
    )::INTEGER AS position
  FROM public.ucat_mocks
  WHERE deleted_at IS NULL
)
UPDATE public.ucat_mocks mock
SET catalog_index = ranked.position
FROM ranked
WHERE ranked.id = mock.id;

WITH ranked AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY section_id, set_format
      ORDER BY created_at NULLS LAST, id
    )::INTEGER AS position
  FROM public.question_sets
  WHERE deleted_at IS NULL AND mock_id IS NULL
)
UPDATE public.question_sets question_set
SET catalog_index = ranked.position
FROM ranked
WHERE ranked.id = question_set.id;

ALTER TABLE public.ucat_mocks
  ALTER COLUMN blueprint_id SET NOT NULL;

ALTER TABLE public.question_sets
  ALTER COLUMN set_format SET NOT NULL,
  ALTER COLUMN timing_mode SET NOT NULL,
  ALTER COLUMN reference_blueprint_id SET NOT NULL;

ALTER TABLE public.ucat_mocks
  ADD CONSTRAINT ucat_mocks_active_catalog_index_check
  CHECK ((deleted_at IS NULL) = (catalog_index IS NOT NULL));

ALTER TABLE public.question_sets
  ADD CONSTRAINT question_sets_timing_intent_check CHECK (
    (timing_mode = 'pace' AND pace_multiplier > 0 AND fixed_time_limit_seconds IS NULL)
    OR (timing_mode = 'fixed' AND pace_multiplier IS NULL AND fixed_time_limit_seconds > 0)
    OR (timing_mode = 'untimed' AND pace_multiplier IS NULL AND fixed_time_limit_seconds IS NULL)
  ),
  ADD CONSTRAINT question_sets_placement_catalog_index_check CHECK (
    (deleted_at IS NULL AND mock_id IS NULL AND catalog_index IS NOT NULL)
    OR ((deleted_at IS NOT NULL OR mock_id IS NOT NULL) AND catalog_index IS NULL)
  ),
  ADD CONSTRAINT question_sets_mock_component_intent_check CHECK (
    mock_id IS NULL OR (
      set_format = 'full_section'
      AND timing_mode = 'pace'
      AND pace_multiplier = 1
      AND fixed_time_limit_seconds IS NULL
    )
  );

CREATE UNIQUE INDEX ucat_mocks_active_catalog_index_key
  ON public.ucat_mocks(catalog_index)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX question_sets_active_standalone_catalog_index_key
  ON public.question_sets(section_id, set_format, catalog_index)
  WHERE deleted_at IS NULL AND mock_id IS NULL;

CREATE UNIQUE INDEX question_sets_mock_section_key
  ON public.question_sets(mock_id, section_id)
  WHERE mock_id IS NOT NULL;

CREATE FUNCTION public.ucat_section_abbreviation(p_section_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(btrim(COALESCE(p_section_name, '')))
    WHEN 'verbal reasoning' THEN 'VR'
    WHEN 'decision making' THEN 'DM'
    WHEN 'quantitative reasoning' THEN 'QR'
    WHEN 'situational judgement' THEN 'SJT'
    ELSE COALESCE(NULLIF(upper(left(btrim(p_section_name), 3)), ''), 'SET')
  END;
$$;

CREATE FUNCTION public.ucat_mock_catalog_name(p_mock_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT format('Mock %s', mock.catalog_index)
  FROM public.ucat_mocks mock
  WHERE mock.id = p_mock_id;
$$;

CREATE FUNCTION public.ucat_question_set_catalog_name(
  p_set_id UUID,
  p_compact BOOLEAN DEFAULT false
)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN question_set.mock_id IS NOT NULL THEN format(
      'Mock %s %s',
      mock.catalog_index,
      CASE WHEN p_compact THEN public.ucat_section_abbreviation(section.name) ELSE section.name END
    )
    ELSE format(
      '%s %s Set %s',
      CASE WHEN p_compact THEN public.ucat_section_abbreviation(section.name) ELSE section.name END,
      CASE question_set.set_format WHEN 'full_section' THEN 'Full' ELSE 'Partial' END,
      question_set.catalog_index
    )
  END
  FROM public.question_sets question_set
  JOIN public.ucat_sections section ON section.id = question_set.section_id
  LEFT JOIN public.ucat_mocks mock ON mock.id = question_set.mock_id
  WHERE question_set.id = p_set_id;
$$;

CREATE FUNCTION public.ucat_catalog_name_rich_text(p_name TEXT)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'type', 'doc',
    'content', jsonb_build_array(jsonb_build_object(
      'type', 'paragraph',
      'content', jsonb_build_array(jsonb_build_object(
        'type', 'text', 'text', COALESCE(p_name, '')
      ))
    ))
  );
$$;

CREATE OR REPLACE FUNCTION public.refresh_ucat_question_catalog_projection(p_stem_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_stem_id IS NULL THEN RETURN; END IF;
  DELETE FROM public.ucat_question_catalog_projection projection
  WHERE projection.stem_id = p_stem_id
    AND NOT EXISTS (SELECT 1 FROM public.question_stems stem WHERE stem.id = p_stem_id);
  IF NOT EXISTS (SELECT 1 FROM public.question_stems stem WHERE stem.id = p_stem_id) THEN RETURN; END IF;

  INSERT INTO public.ucat_question_catalog_projection (
    stem_id, question_count, tag_ids, set_ids, set_names, set_names_text,
    stem_search_text, question_search_text, answer_option_search_text,
    tutor_source_note_search_text, stem_comparison_text, stem_comparison_hash,
    question_text_fingerprint, question_bundle_fingerprint,
    is_available_in_question_pool, refreshed_at
  )
  SELECT stem.id,
    COALESCE(question_summary.question_count, 0),
    COALESCE(tag_summary.tag_ids, '{}'::UUID[]),
    COALESCE(set_summary.set_ids, '{}'::UUID[]),
    COALESCE(set_summary.set_names, '[]'::JSONB),
    COALESCE(set_summary.set_names_text, ''),
    public.normalize_ucat_catalog_text(public.extract_text_from_prosemirror_json(stem.stem_text)),
    COALESCE(question_summary.question_search_text, ''),
    COALESCE(question_summary.answer_option_search_text, ''),
    public.normalize_ucat_catalog_text(stem.tutor_source_note),
    public.canonical_ucat_catalog_rich_text(stem.stem_text),
    MD5(public.canonical_ucat_catalog_rich_text(stem.stem_text)),
    COALESCE(question_summary.question_text_fingerprint, MD5('[]')),
    COALESCE(question_summary.question_bundle_fingerprint, MD5('[]')),
    stem.deleted_at IS NULL
      AND stem.status = 'published'
      AND stem.access_scope = 'public'
      AND COALESCE(set_summary.published_set_count, 0) = 0,
    NOW()
  FROM public.question_stems stem
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::INTEGER AS question_count,
      COALESCE(STRING_AGG(
        public.normalize_ucat_catalog_text(public.extract_text_from_prosemirror_json(question.question_text)),
        ' ' ORDER BY question.index, question.id
      ), '') AS question_search_text,
      COALESCE(STRING_AGG((
        SELECT COALESCE(STRING_AGG(
          public.normalize_ucat_catalog_text(public.extract_text_from_prosemirror_json(answer_option.answer_text)),
          ' ' ORDER BY answer_option.index, answer_option.id
        ), '')
        FROM public.question_answer_options answer_option
        WHERE answer_option.question_id = question.id AND answer_option.deleted_at IS NULL
      ), ' ' ORDER BY question.index, question.id), '') AS answer_option_search_text,
      MD5(COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
        'response_type', question.response_type::TEXT,
        'answer_scheme', question.answer_scheme::TEXT,
        'question_text', public.canonical_ucat_catalog_rich_text(question.question_text)
      ) ORDER BY question.index, question.id)::TEXT, '[]')) AS question_text_fingerprint,
      MD5(COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
        'response_type', question.response_type::TEXT,
        'answer_scheme', question.answer_scheme::TEXT,
        'question_text', public.canonical_ucat_catalog_rich_text(question.question_text),
        'answer_explanation', public.canonical_ucat_catalog_rich_text(question.answer_explanation),
        'answer_options', (
          SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
            'answer_text', public.canonical_ucat_catalog_rich_text(answer_option.answer_text),
            'answer_explanation', public.canonical_ucat_catalog_rich_text(answer_option.answer_explanation),
            'answer_key_value', answer_option.answer_key_value
          ) ORDER BY answer_option.index, answer_option.id), '[]'::JSONB)
          FROM public.question_answer_options answer_option
          WHERE answer_option.question_id = question.id AND answer_option.deleted_at IS NULL
        )
      ) ORDER BY question.index, question.id)::TEXT, '[]')) AS question_bundle_fingerprint
    FROM public.ucat_questions question
    WHERE question.question_stem_id = stem.id AND question.deleted_at IS NULL
  ) question_summary ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(ARRAY_AGG(DISTINCT link.tag_id ORDER BY link.tag_id), '{}'::UUID[]) AS tag_ids
    FROM public.questions_question_tags link
    JOIN public.ucat_questions question ON question.id = link.question_id
    WHERE question.question_stem_id = stem.id AND question.deleted_at IS NULL
  ) tag_summary ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(ARRAY_AGG(question_set.id ORDER BY question_set.updated_at DESC NULLS LAST, question_set.id), '{}'::UUID[]) AS set_ids,
      COALESCE(JSONB_AGG(
        public.ucat_catalog_name_rich_text(public.ucat_question_set_catalog_name(question_set.id, false))
        ORDER BY question_set.updated_at DESC NULLS LAST, question_set.id
      ), '[]'::JSONB) AS set_names,
      COALESCE(STRING_AGG(
        public.normalize_ucat_catalog_text(public.ucat_question_set_catalog_name(question_set.id, false)),
        ', ' ORDER BY question_set.updated_at DESC NULLS LAST, question_set.id
      ), '') AS set_names_text,
      COUNT(*) FILTER (WHERE question_set.status = 'published')::INTEGER AS published_set_count
    FROM public.question_stems_question_sets member
    JOIN public.question_sets question_set
      ON question_set.id = member.question_set_id AND question_set.deleted_at IS NULL
    WHERE member.question_stem_id = stem.id
  ) set_summary ON TRUE
  WHERE stem.id = p_stem_id
  ON CONFLICT (stem_id) DO UPDATE SET
    question_count = EXCLUDED.question_count,
    tag_ids = EXCLUDED.tag_ids,
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

CREATE OR REPLACE FUNCTION public.refresh_ucat_question_catalog_set_derived_fields_for_stems(
  stem_ids UUID[]
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.ucat_question_catalog_projection projection
  SET
    set_ids = COALESCE(set_summary.set_ids, '{}'::UUID[]),
    set_names = COALESCE(set_summary.set_names, '[]'::JSONB),
    set_names_text = COALESCE(set_summary.set_names_text, ''),
    is_available_in_question_pool = (
      stem.deleted_at IS NULL
      AND stem.status = 'published'
      AND stem.access_scope = 'public'
      AND COALESCE(set_summary.published_set_count, 0) = 0
    ),
    refreshed_at = NOW()
  FROM public.question_stems stem
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(ARRAY_AGG(question_set.id ORDER BY question_set.updated_at DESC NULLS LAST, question_set.id), '{}'::UUID[]) AS set_ids,
      COALESCE(JSONB_AGG(
        public.ucat_catalog_name_rich_text(public.ucat_question_set_catalog_name(question_set.id, false))
        ORDER BY question_set.updated_at DESC NULLS LAST, question_set.id
      ), '[]'::JSONB) AS set_names,
      COALESCE(STRING_AGG(
        public.normalize_ucat_catalog_text(public.ucat_question_set_catalog_name(question_set.id, false)),
        ', ' ORDER BY question_set.updated_at DESC NULLS LAST, question_set.id
      ), '') AS set_names_text,
      COUNT(*) FILTER (WHERE question_set.status = 'published')::INTEGER AS published_set_count
    FROM public.question_stems_question_sets member
    JOIN public.question_sets question_set
      ON question_set.id = member.question_set_id AND question_set.deleted_at IS NULL
    WHERE member.question_stem_id = stem.id
  ) set_summary ON TRUE
  WHERE stem.id = projection.stem_id
    AND projection.stem_id = ANY(COALESCE(stem_ids, '{}'::UUID[]));
$$;

CREATE OR REPLACE FUNCTION public.trigger_refresh_ucat_catalog_from_sets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
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

CREATE FUNCTION public.trigger_refresh_ucat_catalog_from_mock_positions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM new_mock_rows next
    JOIN old_mock_rows previous ON previous.id = next.id
    WHERE next.catalog_index IS DISTINCT FROM previous.catalog_index
  ) THEN RETURN NULL; END IF;

  PERFORM public.refresh_ucat_question_catalog_set_derived_fields_for_stems(ARRAY(
    SELECT DISTINCT membership.question_stem_id
    FROM public.question_sets component
    JOIN public.question_stems_question_sets membership
      ON membership.question_set_id = component.id
    WHERE component.mock_id IN (
      SELECT id FROM new_mock_rows UNION SELECT id FROM old_mock_rows
    )
  ));
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_ucat_catalog_from_mock_positions
  AFTER UPDATE ON public.ucat_mocks
  REFERENCING OLD TABLE AS old_mock_rows NEW TABLE AS new_mock_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_refresh_ucat_catalog_from_mock_positions();

SELECT public.refresh_ucat_question_catalog_set_derived_fields_for_stems(
  ARRAY(SELECT stem_id FROM public.ucat_question_catalog_projection)
);

CREATE FUNCTION public.ucat_question_set_exam_time_seconds(p_set_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CEIL(
    blueprint_section.answering_time_seconds::NUMERIC
    * question_count.value
    / blueprint_section.exact_question_count
  )::INTEGER
  FROM public.question_sets question_set
  JOIN public.ucat_sections section ON section.id = question_set.section_id
  JOIN public.ucat_mock_blueprint_sections blueprint_section
    ON blueprint_section.blueprint_id = question_set.reference_blueprint_id
   AND blueprint_section.section_index = section.section_number - 1
  CROSS JOIN LATERAL (
    SELECT count(question.id)::INTEGER AS value
    FROM public.question_stems_question_sets member
    JOIN public.ucat_questions question
      ON question.question_stem_id = member.question_stem_id
     AND question.deleted_at IS NULL
    WHERE member.question_set_id = question_set.id
  ) question_count
  WHERE question_set.id = p_set_id;
$$;

CREATE FUNCTION public.ucat_question_set_time_limit_seconds(p_set_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN question_set.mock_id IS NOT NULL THEN blueprint_section.answering_time_seconds
    WHEN question_set.timing_mode = 'untimed' THEN NULL
    WHEN question_set.timing_mode = 'fixed' THEN question_set.fixed_time_limit_seconds
    ELSE CEIL(
      public.ucat_question_set_exam_time_seconds(question_set.id)::NUMERIC
      / question_set.pace_multiplier
    )::INTEGER
  END
  FROM public.question_sets question_set
  JOIN public.ucat_sections section ON section.id = question_set.section_id
  JOIN public.ucat_mock_blueprint_sections blueprint_section
    ON blueprint_section.blueprint_id = question_set.reference_blueprint_id
   AND blueprint_section.section_index = section.section_number - 1
  WHERE question_set.id = p_set_id;
$$;

REVOKE ALL ON FUNCTION public.ucat_question_set_exam_time_seconds(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ucat_question_set_time_limit_seconds(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ucat_recompute_question_set_timing(p_question_set_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_time_limit INTEGER;
  v_exam_time INTEGER;
BEGIN
  SELECT
    public.ucat_question_set_time_limit_seconds(question_set.id),
    public.ucat_question_set_exam_time_seconds(question_set.id)
  INTO v_time_limit, v_exam_time
  FROM public.question_sets question_set
  WHERE question_set.id = p_question_set_id;

  UPDATE public.question_sets question_set
  SET
    sections = jsonb_build_array(jsonb_build_object(
      'section_number', section.section_number,
      'name', section.name,
      'time_per_question', blueprint_section.answering_time_seconds::NUMERIC
        / blueprint_section.exact_question_count
    )),
    time_limit_seconds = v_time_limit,
    time_limit_at_exam_speed_seconds = v_exam_time,
    speed = CASE
      WHEN v_time_limit > 0 AND v_exam_time > 0 THEN v_exam_time::NUMERIC / v_time_limit
      ELSE NULL
    END
  FROM public.ucat_sections section,
       public.ucat_mock_blueprint_sections blueprint_section
  WHERE question_set.id = p_question_set_id
    AND section.id = question_set.section_id
    AND blueprint_section.blueprint_id = question_set.reference_blueprint_id
    AND blueprint_section.section_index = section.section_number - 1;
END;
$$;

CREATE FUNCTION public.ucat_recompute_question_set_timing_from_intent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ucat_recompute_question_set_timing(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ucat_question_set_timing_intent
  AFTER INSERT OR UPDATE OF timing_mode, pace_multiplier, fixed_time_limit_seconds,
    reference_blueprint_id, section_id, mock_id
  ON public.question_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.ucat_recompute_question_set_timing_from_intent();

CREATE FUNCTION public.ucat_recompute_question_set_timing_from_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM public.ucat_recompute_question_set_timing(OLD.question_set_id);
  END IF;
  IF TG_OP <> 'DELETE' AND (
    TG_OP = 'INSERT' OR NEW.question_set_id IS DISTINCT FROM OLD.question_set_id
  ) THEN
    PERFORM public.ucat_recompute_question_set_timing(NEW.question_set_id);
  END IF;
  PERFORM public.refresh_ucat_question_catalog_set_derived_fields_for_stems(ARRAY(
    SELECT DISTINCT stem_id
    FROM unnest(ARRAY[
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.question_stem_id END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.question_stem_id END
    ]) stem_id
    WHERE stem_id IS NOT NULL
  ));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ucat_question_set_timing_membership
  AFTER INSERT OR DELETE OR UPDATE OF question_set_id
  ON public.question_stems_question_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.ucat_recompute_question_set_timing_from_membership();

CREATE FUNCTION public.ucat_recompute_question_set_timing_from_question()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stem_id UUID;
  v_set_id UUID;
BEGIN
  FOR v_stem_id IN
    SELECT DISTINCT stem_id
    FROM unnest(ARRAY[
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.question_stem_id END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.question_stem_id END
    ]) stem_id
    WHERE stem_id IS NOT NULL
  LOOP
    FOR v_set_id IN
      SELECT member.question_set_id
      FROM public.question_stems_question_sets member
      WHERE member.question_stem_id = v_stem_id
    LOOP
      PERFORM public.ucat_recompute_question_set_timing(v_set_id);
    END LOOP;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ucat_question_set_timing_question
  AFTER INSERT OR DELETE OR UPDATE OF question_stem_id, deleted_at
  ON public.ucat_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.ucat_recompute_question_set_timing_from_question();

DO $$
DECLARE
  v_set RECORD;
BEGIN
  FOR v_set IN SELECT id FROM public.question_sets LOOP
    PERFORM public.ucat_recompute_question_set_timing(v_set.id);
  END LOOP;
END;
$$;

CREATE FUNCTION public.ucat_validate_mock_component_set()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_mock_blueprint_id UUID;
BEGIN
  IF NEW.mock_id IS NULL THEN RETURN NEW; END IF;

  SELECT blueprint_id INTO v_mock_blueprint_id
  FROM public.ucat_mocks
  WHERE id = NEW.mock_id;

  IF v_mock_blueprint_id IS NULL THEN RAISE EXCEPTION 'mock_blueprint_required'; END IF;
  IF NEW.reference_blueprint_id IS DISTINCT FROM v_mock_blueprint_id THEN
    RAISE EXCEPTION 'mock_set_blueprint_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ucat_validate_mock_component_set
  BEFORE INSERT OR UPDATE OF mock_id, reference_blueprint_id
  ON public.question_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.ucat_validate_mock_component_set();

COMMENT ON COLUMN public.question_sets.authoring_note IS 'Optional tutor-only editorial note; never a catalog name.';
COMMENT ON COLUMN public.question_sets.pace_multiplier IS 'Working-speed multiplier: below 1 is slower and allows more time.';
COMMENT ON COLUMN public.question_sets.reference_blueprint_id IS 'Immutable blueprint provenance for timing and composition; not catalog identity.';
COMMENT ON COLUMN public.question_sets.catalog_index IS 'Contiguous standalone position within section and set format; null while attached or deleted.';
COMMENT ON COLUMN public.ucat_mocks.catalog_index IS 'Global year-independent active mock catalog position.';

CREATE FUNCTION public.ucat_compact_mock_catalog()
RETURNS VOID
LANGUAGE sql
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY catalog_index, created_at, id)::INTEGER AS next_index
    FROM public.ucat_mocks
    WHERE deleted_at IS NULL
  ), displaced AS (
    UPDATE public.ucat_mocks mock
    SET catalog_index = ranked.next_index + 1000000
    FROM ranked
    WHERE mock.id = ranked.id
    RETURNING mock.id
  )
  UPDATE public.ucat_mocks mock
  SET catalog_index = ranked.next_index
  FROM ranked
  WHERE mock.id = ranked.id
    AND EXISTS (SELECT 1 FROM displaced WHERE displaced.id = mock.id);
$$;

CREATE FUNCTION public.ucat_compact_standalone_set_catalog(
  p_section_id UUID,
  p_set_format public.ucat_question_set_format
)
RETURNS VOID
LANGUAGE sql
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY catalog_index, created_at, id)::INTEGER AS next_index
    FROM public.question_sets
    WHERE deleted_at IS NULL
      AND mock_id IS NULL
      AND section_id = p_section_id
      AND set_format = p_set_format
  ), displaced AS (
    UPDATE public.question_sets question_set
    SET catalog_index = ranked.next_index + 1000000
    FROM ranked
    WHERE question_set.id = ranked.id
    RETURNING question_set.id
  )
  UPDATE public.question_sets question_set
  SET catalog_index = ranked.next_index
  FROM ranked
  WHERE question_set.id = ranked.id
    AND EXISTS (SELECT 1 FROM displaced WHERE displaced.id = question_set.id);
$$;

REVOKE ALL ON FUNCTION public.ucat_compact_mock_catalog() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ucat_compact_standalone_set_catalog(UUID, public.ucat_question_set_format)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.tutor_ucat_reorder_mocks(p_mock_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected UUID[];
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(20875, 1);

  SELECT array_agg(id ORDER BY catalog_index, id) INTO v_expected
  FROM public.ucat_mocks
  WHERE deleted_at IS NULL;

  IF cardinality(COALESCE(p_mock_ids, ARRAY[]::UUID[])) <> cardinality(COALESCE(v_expected, ARRAY[]::UUID[]))
    OR EXISTS (
      SELECT 1 FROM unnest(COALESCE(v_expected, ARRAY[]::UUID[])) expected(id)
      WHERE NOT expected.id = ANY(COALESCE(p_mock_ids, ARRAY[]::UUID[]))
    )
    OR cardinality(COALESCE(p_mock_ids, ARRAY[]::UUID[])) <>
       cardinality(ARRAY(SELECT DISTINCT id FROM unnest(COALESCE(p_mock_ids, ARRAY[]::UUID[])) id))
  THEN
    RAISE EXCEPTION 'mock_catalog_order_must_include_every_active_mock_once';
  END IF;

  UPDATE public.ucat_mocks SET catalog_index = catalog_index + 1000000 WHERE deleted_at IS NULL;
  UPDATE public.ucat_mocks mock
  SET catalog_index = ordered.position
  FROM unnest(p_mock_ids) WITH ORDINALITY ordered(id, position)
  WHERE mock.id = ordered.id;
END;
$$;

CREATE FUNCTION public.tutor_ucat_reorder_question_sets(
  p_section_id UUID,
  p_set_format public.ucat_question_set_format,
  p_set_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected UUID[];
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_section_id::TEXT || ':' || p_set_format::TEXT,
    20876
  ));

  SELECT array_agg(id ORDER BY catalog_index, id) INTO v_expected
  FROM public.question_sets
  WHERE deleted_at IS NULL
    AND mock_id IS NULL
    AND section_id = p_section_id
    AND set_format = p_set_format;

  IF cardinality(COALESCE(p_set_ids, ARRAY[]::UUID[])) <> cardinality(COALESCE(v_expected, ARRAY[]::UUID[]))
    OR EXISTS (
      SELECT 1 FROM unnest(COALESCE(v_expected, ARRAY[]::UUID[])) expected(id)
      WHERE NOT expected.id = ANY(COALESCE(p_set_ids, ARRAY[]::UUID[]))
    )
    OR cardinality(COALESCE(p_set_ids, ARRAY[]::UUID[])) <>
       cardinality(ARRAY(SELECT DISTINCT id FROM unnest(COALESCE(p_set_ids, ARRAY[]::UUID[])) id))
  THEN
    RAISE EXCEPTION 'set_catalog_order_must_include_scope_once';
  END IF;

  UPDATE public.question_sets
  SET catalog_index = catalog_index + 1000000
  WHERE deleted_at IS NULL
    AND mock_id IS NULL
    AND section_id = p_section_id
    AND set_format = p_set_format;

  UPDATE public.question_sets question_set
  SET catalog_index = ordered.position
  FROM unnest(p_set_ids) WITH ORDINALITY ordered(id, position)
  WHERE question_set.id = ordered.id;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_reorder_mocks(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_reorder_mocks(UUID[]) TO authenticated;
REVOKE ALL ON FUNCTION public.tutor_ucat_reorder_question_sets(
  UUID, public.ucat_question_set_format, UUID[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_reorder_question_sets(
  UUID, public.ucat_question_set_format, UUID[]
) TO authenticated;

CREATE FUNCTION public.tutor_ucat_upsert_question_set_v2(
  p_set_id UUID,
  p_authoring_note TEXT,
  p_description JSONB,
  p_timing_mode public.ucat_question_set_timing_mode,
  p_pace_multiplier NUMERIC,
  p_fixed_time_limit_seconds INTEGER,
  p_set_format public.ucat_question_set_format,
  p_access_scope public.ucat_access_scope,
  p_stem_ids JSONB,
  p_section_id UUID,
  p_reference_blueprint_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set_id UUID;
  v_staff_id UUID;
  v_stem_id UUID;
  v_index INTEGER := 0;
  v_status public.ucat_content_status;
  v_issues JSONB;
  v_current public.question_sets%ROWTYPE;
  v_next_index INTEGER;
  v_mock_blueprint_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_staff_id := public.current_tutor_id();
  IF p_section_id IS NULL THEN RAISE EXCEPTION 'question_set_section_required'; END IF;
  IF p_reference_blueprint_id IS NULL THEN RAISE EXCEPTION 'question_set_blueprint_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ucat_sections WHERE id = p_section_id) THEN
    RAISE EXCEPTION 'ucat_section_not_found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ucat_mock_blueprints WHERE id = p_reference_blueprint_id) THEN
    RAISE EXCEPTION 'question_set_blueprint_not_found';
  END IF;

  IF p_set_id IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      p_section_id::TEXT || ':' || p_set_format::TEXT,
      20876
    ));
    SELECT COALESCE(max(catalog_index), 0) + 1 INTO v_next_index
    FROM public.question_sets
    WHERE deleted_at IS NULL AND mock_id IS NULL
      AND section_id = p_section_id AND set_format = p_set_format;

    INSERT INTO public.question_sets (
      name, authoring_note, description, status, access_scope, section_id,
      set_format, timing_mode, pace_multiplier, fixed_time_limit_seconds,
      reference_blueprint_id, mock_id, catalog_index, created_by, updated_by
    ) VALUES (
      NULL, NULLIF(BTRIM(p_authoring_note), ''), p_description, 'draft',
      COALESCE(p_access_scope, 'public'), p_section_id, p_set_format,
      p_timing_mode, p_pace_multiplier, p_fixed_time_limit_seconds,
      p_reference_blueprint_id, NULL, v_next_index, v_staff_id, v_staff_id
    ) RETURNING id, status INTO v_set_id, v_status;
  ELSE
    SELECT * INTO v_current
    FROM public.question_sets
    WHERE id = p_set_id AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'question_set_not_found'; END IF;

    IF v_current.mock_id IS NOT NULL THEN
      SELECT blueprint_id INTO v_mock_blueprint_id
      FROM public.ucat_mocks WHERE id = v_current.mock_id;
      IF p_section_id IS DISTINCT FROM v_current.section_id THEN
        RAISE EXCEPTION 'mock_component_section_frozen';
      END IF;
      IF p_set_format <> 'full_section'
        OR p_timing_mode <> 'pace'
        OR p_pace_multiplier <> 1
        OR p_fixed_time_limit_seconds IS NOT NULL
        OR p_reference_blueprint_id IS DISTINCT FROM v_mock_blueprint_id
      THEN
        RAISE EXCEPTION 'mock_component_intent_is_blueprint_owned';
      END IF;
    ELSIF p_section_id IS DISTINCT FROM v_current.section_id
      AND EXISTS (
        SELECT 1 FROM public.question_stems_question_sets member
        WHERE member.question_set_id = p_set_id
      )
    THEN
      RAISE EXCEPTION 'question_set_section_has_members';
    END IF;

    IF v_current.mock_id IS NULL AND (
      p_section_id IS DISTINCT FROM v_current.section_id
      OR p_set_format IS DISTINCT FROM v_current.set_format
    ) THEN
      PERFORM pg_advisory_xact_lock(hashtextextended(
        v_current.section_id::TEXT || ':' || v_current.set_format::TEXT,
        20876
      ));
      PERFORM pg_advisory_xact_lock(hashtextextended(
        p_section_id::TEXT || ':' || p_set_format::TEXT,
        20876
      ));
      SELECT COALESCE(max(catalog_index), 0) + 1 INTO v_next_index
      FROM public.question_sets
      WHERE deleted_at IS NULL AND mock_id IS NULL
        AND section_id = p_section_id AND set_format = p_set_format;
    ELSE
      v_next_index := v_current.catalog_index;
    END IF;

    UPDATE public.question_sets
    SET authoring_note = NULLIF(BTRIM(p_authoring_note), ''),
        description = p_description,
        timing_mode = p_timing_mode,
        pace_multiplier = p_pace_multiplier,
        fixed_time_limit_seconds = p_fixed_time_limit_seconds,
        set_format = p_set_format,
        access_scope = COALESCE(p_access_scope, 'public'),
        section_id = p_section_id,
        reference_blueprint_id = p_reference_blueprint_id,
        catalog_index = v_next_index,
        updated_by = v_staff_id
    WHERE id = p_set_id
    RETURNING id, status INTO v_set_id, v_status;
    IF v_current.mock_id IS NULL AND (
      p_section_id IS DISTINCT FROM v_current.section_id
      OR p_set_format IS DISTINCT FROM v_current.set_format
    ) THEN
      PERFORM public.ucat_compact_standalone_set_catalog(v_current.section_id, v_current.set_format);
    END IF;
  END IF;

  DELETE FROM public.question_stems_question_sets WHERE question_set_id = v_set_id;
  FOR v_stem_id IN
    SELECT NULLIF(value::TEXT, '')::UUID
    FROM jsonb_array_elements_text(COALESCE(p_stem_ids, '[]'::JSONB))
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.question_stems
      WHERE id = v_stem_id AND deleted_at IS NULL AND section_id = p_section_id
    ) THEN
      RAISE EXCEPTION 'question_stem_not_found_or_section_mismatch';
    END IF;
    v_index := v_index + 1;
    INSERT INTO public.question_stems_question_sets (
      question_stem_id, question_set_id, index, created_by, updated_by
    ) VALUES (v_stem_id, v_set_id, v_index, v_staff_id, v_staff_id);
  END LOOP;

  IF v_status = 'in_review' AND EXISTS (
    SELECT 1 FROM public.question_stems_question_sets member
    JOIN public.question_stems child ON child.id = member.question_stem_id
    WHERE member.question_set_id = v_set_id AND child.status = 'draft'
  ) THEN
    RAISE EXCEPTION 'in_review_set_contains_draft_stem';
  END IF;

  IF v_status = 'published' THEN
    v_issues := public.ucat_content_publication_issues('set', v_set_id);
    IF jsonb_array_length(v_issues) > 0 THEN
      RAISE EXCEPTION 'published_content_invalid:%', v_issues::TEXT;
    END IF;
    IF v_current.mock_id IS NOT NULL
      AND NOT (public.ucat_mock_blueprint_compliance(v_current.mock_id)->>'compliant')::BOOLEAN
    THEN
      RAISE EXCEPTION 'published_mock_blueprint_noncompliant:%', v_current.mock_id;
    END IF;
  END IF;
  RETURN v_set_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_question_set_v2(
  UUID, TEXT, JSONB, public.ucat_question_set_timing_mode, NUMERIC, INTEGER,
  public.ucat_question_set_format, public.ucat_access_scope, JSONB, UUID, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_question_set_v2(
  UUID, TEXT, JSONB, public.ucat_question_set_timing_mode, NUMERIC, INTEGER,
  public.ucat_question_set_format, public.ucat_access_scope, JSONB, UUID, UUID
) TO authenticated;

CREATE FUNCTION public.tutor_ucat_upsert_mock_v2(
  p_mock_id UUID,
  p_authoring_note TEXT,
  p_access_scope public.ucat_access_scope,
  p_instructions_text JSONB,
  p_blueprint_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mock_id UUID;
  v_staff_id UUID;
  v_status public.ucat_content_status;
  v_existing_blueprint_id UUID;
  v_next_index INTEGER;
  v_blueprint_section RECORD;
  v_section_id UUID;
  v_issues JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_blueprint_id IS NULL THEN RAISE EXCEPTION 'mock_blueprint_required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ucat_mock_blueprints WHERE id = p_blueprint_id) THEN
    RAISE EXCEPTION 'mock_blueprint_not_found';
  END IF;
  v_staff_id := public.current_tutor_id();

  IF p_mock_id IS NULL THEN
    PERFORM pg_advisory_xact_lock(20875, 1);
    SELECT COALESCE(max(catalog_index), 0) + 1 INTO v_next_index
    FROM public.ucat_mocks WHERE deleted_at IS NULL;

    INSERT INTO public.ucat_mocks (
      name, authoring_note, catalog_index, access_scope, status,
      instructions_text, blueprint_id, created_by, updated_by
    ) VALUES (
      '', NULLIF(BTRIM(p_authoring_note), ''), v_next_index,
      COALESCE(p_access_scope, 'public'), 'draft', p_instructions_text,
      p_blueprint_id, v_staff_id, v_staff_id
    ) RETURNING id, status INTO v_mock_id, v_status;

    FOR v_blueprint_section IN
      SELECT * FROM public.ucat_mock_blueprint_sections
      WHERE blueprint_id = p_blueprint_id
      ORDER BY section_index
    LOOP
      SELECT id INTO v_section_id
      FROM public.ucat_sections
      WHERE section_number = v_blueprint_section.section_index + 1;
      IF v_section_id IS NULL THEN RAISE EXCEPTION 'mock_blueprint_section_not_configured'; END IF;

      INSERT INTO public.question_sets (
        name, authoring_note, description, status, access_scope, section_id,
        set_format, timing_mode, pace_multiplier, fixed_time_limit_seconds,
        reference_blueprint_id, mock_id, catalog_index, created_by, updated_by
      ) VALUES (
        NULL, NULL, '{}'::JSONB, 'draft', COALESCE(p_access_scope, 'public'),
        v_section_id, 'full_section', 'pace', 1, NULL,
        p_blueprint_id, v_mock_id, NULL, v_staff_id, v_staff_id
      );
    END LOOP;
  ELSE
    SELECT blueprint_id, status INTO v_existing_blueprint_id, v_status
    FROM public.ucat_mocks
    WHERE id = p_mock_id AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'mock_not_found'; END IF;
    IF p_blueprint_id IS DISTINCT FROM v_existing_blueprint_id THEN
      RAISE EXCEPTION 'mock_blueprint_requires_eligible_audit';
    END IF;

    UPDATE public.ucat_mocks
    SET authoring_note = NULLIF(BTRIM(p_authoring_note), ''),
        access_scope = COALESCE(p_access_scope, 'public'),
        instructions_text = p_instructions_text,
        updated_by = v_staff_id
    WHERE id = p_mock_id
    RETURNING id INTO v_mock_id;

    UPDATE public.question_sets
    SET access_scope = COALESCE(p_access_scope, 'public'), updated_by = v_staff_id
    WHERE mock_id = v_mock_id;
  END IF;

  IF v_status = 'published' THEN
    v_issues := public.ucat_content_publication_issues('mock', v_mock_id);
    IF jsonb_array_length(v_issues) > 0 THEN
      RAISE EXCEPTION 'published_content_invalid:%', v_issues::TEXT;
    END IF;
  END IF;
  RETURN v_mock_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_upsert_mock_v2(
  UUID, TEXT, public.ucat_access_scope, JSONB, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_upsert_mock_v2(
  UUID, TEXT, public.ucat_access_scope, JSONB, UUID
) TO authenticated;

CREATE FUNCTION public.tutor_ucat_detach_mock_set(p_set_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set public.question_sets%ROWTYPE;
  v_mock_status public.ucat_content_status;
  v_next_index INTEGER;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_set FROM public.question_sets
  WHERE id = p_set_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_set.mock_id IS NULL THEN RAISE EXCEPTION 'mock_component_set_not_found'; END IF;
  SELECT status INTO v_mock_status FROM public.ucat_mocks WHERE id = v_set.mock_id FOR UPDATE;
  IF v_mock_status <> 'draft' THEN RAISE EXCEPTION 'mock_membership_changes_require_draft'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_set.section_id::TEXT || ':' || v_set.set_format::TEXT,
    20876
  ));
  SELECT COALESCE(max(catalog_index), 0) + 1 INTO v_next_index
  FROM public.question_sets
  WHERE deleted_at IS NULL AND mock_id IS NULL
    AND section_id = v_set.section_id AND set_format = v_set.set_format;

  UPDATE public.question_sets
  SET mock_id = NULL, catalog_index = v_next_index, updated_by = public.current_tutor_id()
  WHERE id = p_set_id;
END;
$$;

CREATE FUNCTION public.tutor_ucat_attach_mock_set(p_mock_id UUID, p_set_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set public.question_sets%ROWTYPE;
  v_mock public.ucat_mocks%ROWTYPE;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_mock FROM public.ucat_mocks
  WHERE id = p_mock_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mock_not_found'; END IF;
  IF v_mock.status <> 'draft' THEN RAISE EXCEPTION 'mock_membership_changes_require_draft'; END IF;

  SELECT * INTO v_set FROM public.question_sets
  WHERE id = p_set_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_set.mock_id IS NOT NULL THEN RAISE EXCEPTION 'standalone_set_required'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.ucat_mock_blueprint_sections blueprint_section
    JOIN public.ucat_sections section
      ON section.section_number = blueprint_section.section_index + 1
    WHERE blueprint_section.blueprint_id = v_mock.blueprint_id
      AND section.id = v_set.section_id
  ) THEN RAISE EXCEPTION 'set_section_not_in_mock_blueprint'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.question_sets
    WHERE mock_id = p_mock_id AND section_id = v_set.section_id
  ) THEN RAISE EXCEPTION 'mock_section_slot_occupied'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_set.section_id::TEXT || ':' || v_set.set_format::TEXT,
    20876
  ));
  UPDATE public.question_sets
  SET catalog_index = NULL,
      mock_id = p_mock_id,
      reference_blueprint_id = v_mock.blueprint_id,
      set_format = 'full_section',
      timing_mode = 'pace',
      pace_multiplier = 1,
      fixed_time_limit_seconds = NULL,
      updated_by = public.current_tutor_id()
  WHERE id = p_set_id;
  PERFORM public.ucat_compact_standalone_set_catalog(v_set.section_id, v_set.set_format);
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_detach_mock_set(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_detach_mock_set(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.tutor_ucat_attach_mock_set(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_attach_mock_set(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.ucat_mock_blueprint_candidate_compliance(
  p_mock_id UUID,
  p_blueprint_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blueprint public.ucat_mock_blueprints%ROWTYPE;
  v_section public.ucat_mock_blueprint_sections%ROWTYPE;
  v_policy JSONB;
  v_rule JSONB;
  v_checks JSONB;
  v_sections JSONB := '[]'::JSONB;
  v_reasons JSONB := '[]'::JSONB;
  v_actual INTEGER;
  v_set_count INTEGER;
  v_time_limit INTEGER;
  v_compliant BOOLEAN := true;
  v_check_compliant BOOLEAN;
  v_label TEXT;
  v_minimum INTEGER;
  v_maximum INTEGER;
  v_expected INTEGER;
  v_section_number INTEGER;
BEGIN
  SELECT blueprint.* INTO v_blueprint
  FROM public.ucat_mocks mock
  JOIN public.ucat_mock_blueprints blueprint ON blueprint.id = p_blueprint_id
  WHERE mock.id = p_mock_id AND mock.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'applicable', false,
      'compliant', false,
      'blueprintId', p_blueprint_id,
      'blueprintCode', null,
      'sections', '[]'::JSONB,
      'reasons', jsonb_build_array(jsonb_build_object(
        'code', 'BLUEPRINT_NOT_SELECTED',
        'message', 'Select a managed full-mock blueprint.'
      ))
    );
  END IF;

  FOR v_section IN
    SELECT * FROM public.ucat_mock_blueprint_sections
    WHERE blueprint_id = v_blueprint.id
    ORDER BY section_index
  LOOP
    v_checks := '[]'::JSONB;
    v_policy := v_section.altitutor_composition_policy;
    v_section_number := v_section.section_index + 1;

    SELECT
      count(question_set.id)::INTEGER,
      min(public.ucat_question_set_time_limit_seconds(question_set.id))
    INTO v_set_count, v_time_limit
    FROM public.question_sets question_set
    JOIN public.ucat_sections section ON section.id = question_set.section_id
    WHERE question_set.mock_id = p_mock_id
      AND question_set.deleted_at IS NULL
      AND section.section_number = v_section_number;

    SELECT count(question.id)::INTEGER INTO v_actual
    FROM public.question_sets mock_set
    JOIN public.question_stems_question_sets set_member
      ON set_member.question_set_id = mock_set.id
    JOIN public.question_stems stem
      ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
    JOIN public.ucat_questions question
      ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
    WHERE mock_set.mock_id = p_mock_id
      AND mock_set.deleted_at IS NULL
      AND mock_set.section_id = stem.section_id
      AND EXISTS (
        SELECT 1 FROM public.ucat_sections section
        WHERE section.id = mock_set.section_id
          AND section.section_number = v_section_number
      );

    v_check_compliant := v_set_count = 1 AND v_actual = v_section.exact_question_count;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code', 'QUESTION_TOTAL_MISMATCH', 'label', 'Candidate-visible question total',
      'unit', 'questions', 'target', v_section.exact_question_count,
      'actual', v_actual, 'compliant', v_check_compliant,
      'reason', CASE WHEN v_check_compliant THEN 'Exact total met.'
        ELSE format(
          'Requires exactly %s questions in one section set; found %s questions across %s sets.',
          v_section.exact_question_count, v_actual, v_set_count
        ) END
    ));
    IF NOT v_check_compliant THEN v_compliant := false; END IF;

    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code', 'SECTION_ORDER_INVALID', 'label', 'Section order', 'unit', 'position',
      'target', v_section_number, 'actual', CASE WHEN v_set_count = 1 THEN v_section_number ELSE NULL END,
      'compliant', v_set_count = 1,
      'reason', CASE WHEN v_set_count = 1
        THEN 'Section order is fixed by the selected blueprint.'
        ELSE 'The blueprint section slot is empty.' END
    ));
    IF v_set_count <> 1 THEN v_compliant := false; END IF;

    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code', 'INSTRUCTION_TIME_MISMATCH', 'label', 'Instruction time', 'unit', 'seconds',
      'target', v_section.instruction_time_seconds, 'actual', v_section.instruction_time_seconds,
      'compliant', true,
      'reason', 'Instruction time is supplied by the selected immutable blueprint version.'
    ));

    v_check_compliant := v_set_count = 1 AND v_time_limit = v_section.answering_time_seconds;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code', 'ANSWERING_TIME_MISMATCH', 'label', 'Answering time', 'unit', 'seconds',
      'target', v_section.answering_time_seconds, 'actual', v_time_limit,
      'compliant', v_check_compliant,
      'reason', CASE WHEN v_check_compliant THEN 'Exact answering time met.'
        ELSE format(
          'Requires exactly %s seconds; found %s.',
          v_section.answering_time_seconds,
          COALESCE(v_time_limit::TEXT, 'no section set')
        ) END
    ));
    IF NOT v_check_compliant THEN v_compliant := false; END IF;

    IF v_policy ? 'exactStemCount' THEN
      v_expected := (v_policy->>'exactStemCount')::INTEGER;
      SELECT count(DISTINCT stem.id)::INTEGER INTO v_actual
      FROM public.question_sets mock_set
      JOIN public.question_stems_question_sets set_member
        ON set_member.question_set_id = mock_set.id
      JOIN public.question_stems stem
        ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
      JOIN public.ucat_sections section ON section.id = mock_set.section_id
      WHERE mock_set.mock_id = p_mock_id
        AND mock_set.deleted_at IS NULL
        AND section.section_number = v_section_number;
      v_check_compliant := v_actual = v_expected;
      v_checks := v_checks || jsonb_build_array(jsonb_build_object(
        'code', 'STEM_TOTAL_MISMATCH', 'label', 'Stem total', 'unit', 'stems',
        'target', v_expected, 'actual', v_actual, 'compliant', v_check_compliant,
        'reason', format('Target %s stems; found %s.', v_expected, v_actual)
      ));
      IF NOT v_check_compliant THEN v_compliant := false; END IF;
    END IF;

    FOR v_rule IN
      SELECT * FROM jsonb_array_elements(COALESCE(v_policy->'categoryRules', '[]'::JSONB))
    LOOP
      v_label := COALESCE(v_rule->>'label', v_rule->>'category', 'Answer-scheme questions');
      v_minimum := (v_rule->>'min')::INTEGER;
      v_maximum := (v_rule->>'max')::INTEGER;
      IF v_rule ? 'categoryId' OR v_rule ? 'category' THEN
        IF v_rule->>'unit' = 'stems' THEN
          SELECT count(DISTINCT stem.id)::INTEGER INTO v_actual
          FROM public.question_sets mock_set
          JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_set.id
          JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
          JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
          JOIN public.ucat_sections section ON section.id = mock_set.section_id
          WHERE mock_set.mock_id = p_mock_id
            AND mock_set.deleted_at IS NULL
            AND section.section_number = v_section_number
            AND (
              category.id = NULLIF(v_rule->>'categoryId', '')::UUID
              OR (NOT (v_rule ? 'categoryId') AND category.name = v_rule->>'category')
            );
        ELSE
          SELECT count(question.id)::INTEGER INTO v_actual
          FROM public.question_sets mock_set
          JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_set.id
          JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
          JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
          JOIN public.ucat_sections section ON section.id = mock_set.section_id
          JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
          WHERE mock_set.mock_id = p_mock_id
            AND mock_set.deleted_at IS NULL
            AND section.section_number = v_section_number
            AND (
              category.id = NULLIF(v_rule->>'categoryId', '')::UUID
              OR (NOT (v_rule ? 'categoryId') AND category.name = v_rule->>'category')
            );
        END IF;
      ELSE
        SELECT count(question.id)::INTEGER INTO v_actual
        FROM public.question_sets mock_set
        JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_set.id
        JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
        JOIN public.ucat_sections section ON section.id = mock_set.section_id
        JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
        WHERE mock_set.mock_id = p_mock_id
          AND mock_set.deleted_at IS NULL
          AND section.section_number = v_section_number
          AND question.answer_scheme::TEXT = v_rule->>'answerScheme';
      END IF;

      v_check_compliant := v_actual BETWEEN v_minimum AND v_maximum;
      v_checks := v_checks || jsonb_build_array(jsonb_build_object(
        'code', 'CATEGORY_COUNT_OUT_OF_RANGE', 'label', v_label, 'unit', v_rule->>'unit',
        'minimum', v_minimum, 'preferred', (v_rule->>'preferred')::INTEGER,
        'maximum', v_maximum, 'actual', v_actual, 'compliant', v_check_compliant,
        'reason', format(
          'Allowed %s–%s; preferred %s; found %s.',
          v_minimum, v_maximum, COALESCE(v_rule->>'preferred', 'any in range'), v_actual
        )
      ));
      IF NOT v_check_compliant THEN v_compliant := false; END IF;

      IF v_rule ? 'requiredAnswerScheme' THEN
        SELECT count(question.id)::INTEGER INTO v_actual
        FROM public.question_sets mock_set
        JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_set.id
        JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
        JOIN public.question_stem_categories category ON category.id = stem.question_stem_category_id
        JOIN public.ucat_sections section ON section.id = mock_set.section_id
        JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
        WHERE mock_set.mock_id = p_mock_id
          AND mock_set.deleted_at IS NULL
          AND section.section_number = v_section_number
          AND (
            category.id = NULLIF(v_rule->>'categoryId', '')::UUID
            OR (NOT (v_rule ? 'categoryId') AND category.name = v_rule->>'category')
          )
          AND question.answer_scheme::TEXT <> v_rule->>'requiredAnswerScheme';
        v_check_compliant := v_actual = 0;
        v_checks := v_checks || jsonb_build_array(jsonb_build_object(
          'code', 'CATEGORY_ANSWER_SCHEME_MISMATCH',
          'label', format('%s Answer scheme mismatches', v_label),
          'unit', 'questions', 'target', 0, 'actual', v_actual,
          'compliant', v_check_compliant,
          'reason', format(
            'Requires %s; found %s mismatches.',
            v_rule->>'requiredAnswerScheme', v_actual
          )
        ));
        IF NOT v_check_compliant THEN v_compliant := false; END IF;
      END IF;
    END LOOP;

    FOR v_rule IN
      SELECT * FROM jsonb_array_elements(COALESCE(v_policy->'responseContractRules', '[]'::JSONB))
    LOOP
      v_expected := (v_rule->>'questionsPerStem')::INTEGER;
      SELECT count(*)::INTEGER INTO v_actual FROM (
        SELECT stem.id
        FROM public.question_sets mock_set
        JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_set.id
        JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
        JOIN public.ucat_sections section ON section.id = mock_set.section_id
        JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
        WHERE mock_set.mock_id = p_mock_id
          AND mock_set.deleted_at IS NULL
          AND section.section_number = v_section_number
        GROUP BY stem.id
        HAVING bool_or(question.answer_scheme::TEXT = v_rule->>'answerScheme')
          AND count(question.id) <> v_expected
      ) invalid_contract_stems;
      v_check_compliant := v_actual = 0;
      v_checks := v_checks || jsonb_build_array(jsonb_build_object(
        'code', 'RESPONSE_CONTRACT_STEM_COUNT_INVALID',
        'label', format('%s questions per stem', v_rule->>'answerScheme'),
        'unit', 'invalid stems', 'target', 0, 'actual', v_actual,
        'compliant', v_check_compliant,
        'reason', format(
          'Each matching stem requires exactly %s question(s); found %s invalid stems.',
          v_expected, v_actual
        )
      ));
      IF NOT v_check_compliant THEN v_compliant := false; END IF;
    END LOOP;

    SELECT count(*)::INTEGER INTO v_actual FROM (
      SELECT stem.id
      FROM public.question_sets mock_set
      JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_set.id
      JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
      JOIN public.ucat_sections section ON section.id = mock_set.section_id
      WHERE mock_set.mock_id = p_mock_id
        AND mock_set.deleted_at IS NULL
        AND section.section_number = v_section_number
      GROUP BY stem.id HAVING count(*) > 1
    ) duplicate_stems;
    v_check_compliant := v_actual = 0;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code', 'DUPLICATE_STEM_ID', 'label', 'Duplicate stems', 'unit', 'stems',
      'target', 0, 'actual', v_actual, 'compliant', v_check_compliant,
      'reason', format('A stem may appear only once; found %s duplicated stems.', v_actual)
    ));
    IF NOT v_check_compliant THEN v_compliant := false; END IF;

    FOR v_rule IN
      SELECT * FROM jsonb_array_elements(COALESCE(v_policy->'structureRules', '[]'::JSONB))
    LOOP
      v_minimum := (v_rule->>'min')::INTEGER;
      v_maximum := (v_rule->>'max')::INTEGER;
      v_label := v_rule->>'label';
      IF v_rule->>'kind' = 'stem_count' THEN
        SELECT count(*)::INTEGER INTO v_actual FROM (
          SELECT stem.id
          FROM public.question_sets mock_set
          JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_set.id
          JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
          JOIN public.ucat_sections section ON section.id = mock_set.section_id
          JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
          WHERE mock_set.mock_id = p_mock_id
            AND mock_set.deleted_at IS NULL
            AND section.section_number = v_section_number
          GROUP BY stem.id
          HAVING CASE WHEN v_rule->>'questionCardinality' = 'single'
            THEN count(question.id) = 1 ELSE count(question.id) > 1 END
        ) matching_stems;
        v_check_compliant := v_actual BETWEEN v_minimum AND v_maximum;
      ELSE
        SELECT count(*)::INTEGER INTO v_actual FROM (
          SELECT stem.id
          FROM public.question_sets mock_set
          JOIN public.question_stems_question_sets set_member ON set_member.question_set_id = mock_set.id
          JOIN public.question_stems stem ON stem.id = set_member.question_stem_id AND stem.deleted_at IS NULL
          JOIN public.ucat_sections section ON section.id = mock_set.section_id
          JOIN public.ucat_questions question ON question.question_stem_id = stem.id AND question.deleted_at IS NULL
          WHERE mock_set.mock_id = p_mock_id
            AND mock_set.deleted_at IS NULL
            AND section.section_number = v_section_number
          GROUP BY stem.id HAVING count(question.id) NOT BETWEEN v_minimum AND v_maximum
        ) invalid_stems;
        v_check_compliant := v_actual = 0;
      END IF;
      v_checks := v_checks || jsonb_build_array(jsonb_build_object(
        'code', 'STRUCTURE_RULE_FAILED', 'label', v_label,
        'unit', CASE WHEN v_rule->>'kind' = 'stem_count' THEN 'stems' ELSE 'invalid stems' END,
        'minimum', v_minimum, 'maximum', v_maximum, 'actual', v_actual,
        'compliant', v_check_compliant,
        'reason', CASE WHEN v_rule->>'kind' = 'stem_count'
          THEN format('Allowed %s–%s; found %s.', v_minimum, v_maximum, v_actual)
          ELSE format(
            '%s stems fall outside %s–%s questions per stem.',
            v_actual, v_minimum, v_maximum
          ) END
      ));
      IF NOT v_check_compliant THEN v_compliant := false; END IF;
    END LOOP;

    v_sections := v_sections || jsonb_build_array(jsonb_build_object(
      'section', v_section.section_code,
      'targetQuestions', v_section.exact_question_count,
      'actualQuestions', (v_checks->0->>'actual')::INTEGER,
      'compliant', NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_checks) item
        WHERE NOT (item->>'compliant')::BOOLEAN
      ),
      'checks', v_checks
    ));
  END LOOP;

  IF NOT v_compliant THEN
    v_reasons := jsonb_build_array(jsonb_build_object(
      'code', 'BLUEPRINT_NONCOMPLIANT',
      'message', 'One or more section sets violate the selected full-mock blueprint.'
    ));
  END IF;

  RETURN jsonb_build_object(
    'applicable', true,
    'compliant', v_compliant,
    'blueprintId', v_blueprint.id,
    'blueprintCode', v_blueprint.code,
    'testYear', v_blueprint.test_year,
    'version', v_blueprint.version,
    'sections', v_sections,
    'reasons', v_reasons
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ucat_mock_blueprint_candidate_compliance(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ucat_mock_blueprint_candidate_compliance(UUID, UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.ucat_mock_blueprint_compliance(p_mock_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.ucat_mock_blueprint_candidate_compliance(
    p_mock_id,
    (SELECT mock.blueprint_id FROM public.ucat_mocks mock
      WHERE mock.id = p_mock_id AND mock.deleted_at IS NULL)
  );
$$;

REVOKE ALL ON FUNCTION public.ucat_mock_blueprint_compliance(UUID)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ucat_mock_publication_shape_issues(p_mock_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues JSONB := '[]'::JSONB;
BEGIN
  IF (SELECT count(*) FROM public.question_sets WHERE mock_id = p_mock_id AND deleted_at IS NULL) <> 4 THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'incomplete_mock_sections',
      'message', 'Every blueprint section slot must contain one set before publication.'
    ));
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.question_sets question_set
    WHERE question_set.mock_id = p_mock_id
      AND question_set.deleted_at IS NULL
      AND (
        question_set.set_format <> 'full_section'
        OR question_set.timing_mode <> 'pace'
        OR question_set.pace_multiplier <> 1
      )
  ) THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'code', 'invalid_mock_component_intent',
      'message', 'Mock component sets must use full-section format and exact blueprint pace.'
    ));
  END IF;
  RETURN v_issues;
END;
$$;

-- Incompatible unversioned mocks are archived at cutover. Their attempts and
-- owned component sets remain intact for audit/history, but they cannot remain
-- in the active catalog under a blueprint they do not satisfy.
UPDATE public.ucat_mocks mock
SET deleted_at = COALESCE(mock.deleted_at, NOW()),
    catalog_index = NULL
WHERE mock.deleted_at IS NULL
  AND NOT (public.ucat_mock_blueprint_compliance(mock.id)->>'compliant')::BOOLEAN;
SELECT public.ucat_compact_mock_catalog();

CREATE OR REPLACE VIEW public.vstudent_ucat_accessible_question_sets AS
SELECT question_set.id
FROM public.question_sets question_set
CROSS JOIN public.vstudent_ucat_access_context context
WHERE question_set.deleted_at IS NULL
  AND question_set.status = 'published'
  AND (
    (context.has_online_access AND question_set.access_scope = 'public')
    OR EXISTS (
      SELECT 1 FROM public.vstudent_ucat_accessible_session_resources resource
      WHERE resource.question_set_id = question_set.id
    )
    OR EXISTS (
      SELECT 1 FROM public.vstudent_ucat_accessible_session_resources resource
      WHERE resource.ucat_mock_id = question_set.mock_id
    )
  );

CREATE OR REPLACE VIEW public.vstudent_ucat_accessible_question_stems AS
WITH learning_stems AS MATERIALIZED (
  SELECT block.question_stem_id AS id
  FROM public.ucat_learning_module_blocks block
  JOIN public.vstudent_ucat_accessible_learning_modules module
    ON module.id = block.learning_module_id
  WHERE block.deleted_at IS NULL AND block.question_stem_id IS NOT NULL
  UNION
  SELECT question.question_stem_id AS id
  FROM public.ucat_learning_module_blocks block
  JOIN public.vstudent_ucat_accessible_learning_modules module
    ON module.id = block.learning_module_id
  JOIN public.ucat_questions question
    ON question.id = block.question_id AND question.deleted_at IS NULL
  WHERE block.deleted_at IS NULL AND block.question_id IS NOT NULL
)
SELECT stem.id
FROM public.question_stems stem
CROSS JOIN public.vstudent_ucat_access_context context
WHERE stem.deleted_at IS NULL
  AND stem.status = 'published'
  AND (
    (context.has_online_access AND stem.access_scope = 'public')
    OR EXISTS (
      SELECT 1 FROM public.vstudent_ucat_accessible_session_resources resource
      WHERE resource.question_stem_id = stem.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.vstudent_ucat_accessible_session_resources resource
      JOIN public.question_stems_question_sets member
        ON member.question_set_id = resource.question_set_id
      WHERE member.question_stem_id = stem.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.vstudent_ucat_accessible_session_resources resource
      JOIN public.question_sets question_set ON question_set.mock_id = resource.ucat_mock_id
      JOIN public.question_stems_question_sets member ON member.question_set_id = question_set.id
      WHERE member.question_stem_id = stem.id
    )
    OR EXISTS (SELECT 1 FROM learning_stems learning WHERE learning.id = stem.id)
  );

CREATE OR REPLACE VIEW public.vtutor_ucat_question_sets AS
SELECT
  question_set.id,
  public.safe_text_to_jsonb(public.ucat_question_set_catalog_name(question_set.id)) AS name,
  question_set.description,
  question_set.time_limit_seconds,
  question_set.status,
  question_set.access_scope,
  question_set.status = 'published'
    AND question_set.access_scope = 'public'
    AND question_set.mock_id IS NULL AS is_available_in_sets_pool,
  question_set.status_changed_at,
  question_set.status_changed_by,
  question_set.sections,
  question_set.time_limit_at_exam_speed_seconds,
  question_set.speed,
  question_set.created_at,
  question_set.updated_at,
  question_set.created_by,
  question_set.updated_by,
  question_set.deleted_at,
  question_set.deleted_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  (SELECT count(*)::INTEGER FROM public.question_stems_question_sets member
    WHERE member.question_set_id = question_set.id) AS stem_count,
  (SELECT count(*)::INTEGER
    FROM public.ucat_questions question
    JOIN public.question_stems_question_sets member
      ON member.question_stem_id = question.question_stem_id
    WHERE member.question_set_id = question_set.id AND question.deleted_at IS NULL) AS question_count,
  CASE WHEN question_set.mock_id IS NULL THEN '[]'::JSONB
    ELSE jsonb_build_array(question_set.mock_id) END AS ucat_mock_ids,
  public.ucat_content_publication_issues('set', question_set.id) AS publication_issues,
  CASE WHEN parent.id IS NULL OR parent.deleted_at IS NOT NULL THEN '[]'::JSONB
    ELSE jsonb_build_array(jsonb_build_object(
      'mockId', parent.id,
      'mockName', public.ucat_mock_catalog_name(parent.id),
      'blueprintId', parent.blueprint_id,
      'setIds', COALESCE((
        SELECT jsonb_agg(component.id ORDER BY section.section_number, component.id)
        FROM public.question_sets component
        JOIN public.ucat_sections section ON section.id = component.section_id
        WHERE component.mock_id = parent.id AND component.deleted_at IS NULL
      ), '[]'::JSONB),
      'compliance', public.ucat_mock_blueprint_compliance(parent.id)
    )) END AS linked_mock_blueprint_compliance,
  question_set.section_id,
  section.section_number,
  section.name AS section_name,
  public.ucat_question_set_catalog_name(question_set.id) AS display_name,
  public.ucat_question_set_catalog_name(question_set.id, true) AS compact_display_name,
  question_set.authoring_note,
  question_set.set_format,
  question_set.timing_mode,
  question_set.pace_multiplier,
  question_set.fixed_time_limit_seconds,
  question_set.reference_blueprint_id,
  question_set.mock_id,
  question_set.catalog_index
FROM public.question_sets question_set
LEFT JOIN public.staff created_staff ON created_staff.id = question_set.created_by
LEFT JOIN public.ucat_mocks parent ON parent.id = question_set.mock_id
JOIN public.ucat_sections section ON section.id = question_set.section_id
WHERE public.is_ucat_tutor();

CREATE OR REPLACE VIEW public.vtutor_ucat_question_set_detail AS
SELECT
  question_set.id,
  public.safe_text_to_jsonb(public.ucat_question_set_catalog_name(question_set.id)) AS name,
  question_set.description,
  question_set.time_limit_seconds,
  question_set.status,
  question_set.access_scope,
  question_set.status_changed_at,
  question_set.status_changed_by,
  question_set.created_at,
  question_set.updated_at,
  question_set.created_by,
  question_set.updated_by,
  question_set.deleted_at,
  question_set.deleted_by,
  public.ucat_content_publication_issues('set', question_set.id) AS publication_issues,
  (
    SELECT json_agg(json_build_object(
      'stem_id', stem.id,
      'stem_text', stem.stem_text,
      'status', stem.status,
      'access_scope', stem.access_scope,
      'questions_meta', (
        SELECT json_agg(json_build_object('id', question.id, 'index', question.index) ORDER BY question.index)
        FROM public.ucat_questions question
        WHERE question.question_stem_id = stem.id AND question.deleted_at IS NULL
      )
    ) ORDER BY member.index)
    FROM public.question_stems_question_sets member
    JOIN public.question_stems stem ON stem.id = member.question_stem_id
    WHERE member.question_set_id = question_set.id
  ) AS stems,
  question_set.section_id,
  section.section_number,
  section.name AS section_name,
  public.ucat_question_set_catalog_name(question_set.id) AS display_name,
  public.ucat_question_set_catalog_name(question_set.id, true) AS compact_display_name,
  question_set.authoring_note,
  question_set.set_format,
  question_set.timing_mode,
  question_set.pace_multiplier,
  question_set.fixed_time_limit_seconds,
  question_set.reference_blueprint_id,
  question_set.mock_id,
  question_set.catalog_index
FROM public.question_sets question_set
JOIN public.ucat_sections section ON section.id = question_set.section_id
WHERE public.is_ucat_tutor();

CREATE OR REPLACE VIEW public.vstudent_ucat_question_sets AS
SELECT
  question_set.id,
  public.safe_text_to_jsonb(public.ucat_question_set_catalog_name(question_set.id)) AS name,
  question_set.description,
  question_set.time_limit_seconds,
  question_set.sections,
  question_set.time_limit_at_exam_speed_seconds,
  question_set.speed,
  question_set.created_at,
  question_set.updated_at,
  question_set.status = 'published'
    AND question_set.access_scope = 'public'
    AND question_set.mock_id IS NULL AS is_available_in_sets_library,
  question_set.section_id,
  section.section_number,
  public.ucat_question_set_catalog_name(question_set.id) AS display_name,
  public.ucat_question_set_catalog_name(question_set.id, true) AS compact_display_name,
  question_set.set_format,
  question_set.timing_mode,
  question_set.pace_multiplier,
  question_set.fixed_time_limit_seconds,
  question_set.reference_blueprint_id,
  question_set.mock_id,
  question_set.catalog_index
FROM public.question_sets question_set
JOIN public.vstudent_ucat_accessible_question_sets accessible ON accessible.id = question_set.id
JOIN public.ucat_sections section ON section.id = question_set.section_id;

CREATE OR REPLACE VIEW public.vstudent_ucat_question_set_detail AS
SELECT
  question_set.id,
  public.safe_text_to_jsonb(public.ucat_question_set_catalog_name(question_set.id)) AS name,
  question_set.description,
  question_set.time_limit_seconds,
  question_set.created_at,
  question_set.updated_at,
  (
    SELECT json_agg(json_build_object(
      'stem_id', stem.id,
      'stem_text', stem.stem_text,
      'questions_meta', (
        SELECT json_agg(json_build_object('id', question.id, 'index', question.index) ORDER BY question.index)
        FROM public.ucat_questions question
        WHERE question.question_stem_id = member.question_stem_id
          AND question.deleted_at IS NULL
      )
    ) ORDER BY member.index)
    FROM public.question_stems_question_sets member
    JOIN public.question_stems stem
      ON stem.id = member.question_stem_id AND stem.deleted_at IS NULL
    JOIN public.vstudent_ucat_accessible_question_stems accessible_stem
      ON accessible_stem.id = stem.id
    WHERE member.question_set_id = question_set.id
  ) AS stems,
  public.ucat_question_set_catalog_name(question_set.id) AS display_name,
  public.ucat_question_set_catalog_name(question_set.id, true) AS compact_display_name,
  question_set.set_format,
  question_set.timing_mode,
  question_set.pace_multiplier,
  question_set.fixed_time_limit_seconds,
  question_set.reference_blueprint_id,
  question_set.mock_id,
  question_set.catalog_index
FROM public.question_sets question_set
JOIN public.vstudent_ucat_accessible_question_sets accessible ON accessible.id = question_set.id;

CREATE OR REPLACE VIEW public.vtutor_ucat_mocks AS
SELECT
  mock.id,
  public.ucat_mock_catalog_name(mock.id) AS name,
  mock.status,
  mock.access_scope,
  mock.status_changed_at,
  mock.status_changed_by,
  mock.created_at,
  mock.updated_at,
  mock.created_by,
  mock.updated_by,
  mock.deleted_at,
  mock.deleted_by,
  created_staff.first_name AS created_by_first_name,
  created_staff.last_name AS created_by_last_name,
  (SELECT count(*)::INTEGER FROM public.question_sets component
    WHERE component.mock_id = mock.id AND component.deleted_at IS NULL) AS set_count,
  public.ucat_content_publication_issues('mock', mock.id) AS publication_issues,
  mock.blueprint_id,
  public.ucat_mock_blueprint_compliance(mock.id) AS blueprint_compliance,
  public.ucat_mock_catalog_name(mock.id) AS display_name,
  mock.authoring_note,
  mock.catalog_index
FROM public.ucat_mocks mock
LEFT JOIN public.staff created_staff ON created_staff.id = mock.created_by
WHERE public.is_ucat_tutor();

CREATE OR REPLACE VIEW public.vtutor_ucat_mock_detail AS
SELECT
  mock.id,
  public.ucat_mock_catalog_name(mock.id) AS name,
  mock.status,
  mock.access_scope,
  mock.status_changed_at,
  mock.status_changed_by,
  mock.instructions_text,
  mock.created_at,
  mock.updated_at,
  mock.created_by,
  mock.updated_by,
  mock.deleted_at,
  mock.deleted_by,
  public.ucat_content_publication_issues('mock', mock.id) AS publication_issues,
  (
    SELECT json_agg(json_build_object(
      'id', question_set.id,
      'name', public.safe_text_to_jsonb(public.ucat_question_set_catalog_name(question_set.id)),
      'display_name', public.ucat_question_set_catalog_name(question_set.id),
      'compact_display_name', public.ucat_question_set_catalog_name(question_set.id, true),
      'authoring_note', question_set.authoring_note,
      'description', question_set.description,
      'time_limit_seconds', question_set.time_limit_seconds,
      'sections', question_set.sections,
      'question_count', question_set.question_count,
      'status', question_set.status,
      'access_scope', question_set.access_scope,
      'section_id', question_set.section_id,
      'set_format', question_set.set_format,
      'timing_mode', question_set.timing_mode,
      'pace_multiplier', question_set.pace_multiplier,
      'reference_blueprint_id', question_set.reference_blueprint_id
    ) ORDER BY question_set.section_number, question_set.id)
    FROM public.vtutor_ucat_question_sets question_set
    WHERE question_set.mock_id = mock.id
  ) AS sets,
  mock.blueprint_id,
  public.ucat_mock_blueprint_compliance(mock.id) AS blueprint_compliance,
  public.ucat_mock_catalog_name(mock.id) AS display_name,
  mock.authoring_note,
  mock.catalog_index
FROM public.ucat_mocks mock
WHERE public.is_ucat_tutor();

CREATE OR REPLACE VIEW public.vstudent_ucat_mocks AS
SELECT
  mock.id,
  public.ucat_mock_catalog_name(mock.id) AS name,
  mock.created_at,
  mock.updated_at,
  mock.created_by,
  (SELECT count(*)::INTEGER
    FROM public.question_sets component
    JOIN public.vstudent_ucat_accessible_question_sets accessible_set
      ON accessible_set.id = component.id
    WHERE component.mock_id = mock.id AND component.deleted_at IS NULL) AS set_count,
  EXISTS (
    SELECT 1
    FROM public.question_sets component
    JOIN public.vstudent_ucat_accessible_question_sets accessible_set
      ON accessible_set.id = component.id
    WHERE component.mock_id = mock.id
      AND component.deleted_at IS NULL
      AND component.time_limit_seconds > 0
  ) AS has_timed_sets,
  public.ucat_mock_catalog_name(mock.id) AS display_name,
  mock.catalog_index
FROM public.ucat_mocks mock
JOIN public.vstudent_ucat_accessible_mocks accessible ON accessible.id = mock.id;

CREATE OR REPLACE VIEW public.vstudent_ucat_mock_detail AS
SELECT
  mock.id,
  public.ucat_mock_catalog_name(mock.id) AS name,
  mock.instructions_text,
  mock.created_at,
  mock.updated_at,
  (
    SELECT json_agg(json_build_object(
      'id', question_set.id,
      'name', public.safe_text_to_jsonb(public.ucat_question_set_catalog_name(question_set.id)),
      'display_name', public.ucat_question_set_catalog_name(question_set.id),
      'compact_display_name', public.ucat_question_set_catalog_name(question_set.id, true),
      'description', question_set.description,
      'time_limit_seconds', question_set.time_limit_seconds,
      'section_id', question_set.section_id,
      'set_format', question_set.set_format,
      'timing_mode', question_set.timing_mode,
      'pace_multiplier', question_set.pace_multiplier,
      'reference_blueprint_id', question_set.reference_blueprint_id
    ) ORDER BY section.section_number, question_set.id)
    FROM public.question_sets question_set
    JOIN public.ucat_sections section ON section.id = question_set.section_id
    JOIN public.vstudent_ucat_accessible_question_sets accessible_set
      ON accessible_set.id = question_set.id
    WHERE question_set.mock_id = mock.id AND question_set.deleted_at IS NULL
  ) AS sets,
  public.ucat_mock_catalog_name(mock.id) AS display_name,
  mock.catalog_index
FROM public.ucat_mocks mock
JOIN public.vstudent_ucat_accessible_mocks accessible ON accessible.id = mock.id;

GRANT SELECT ON public.vstudent_ucat_accessible_question_sets TO authenticated;
GRANT SELECT ON public.vstudent_ucat_accessible_question_stems TO authenticated;
GRANT SELECT ON public.vtutor_ucat_question_sets TO authenticated;
GRANT SELECT ON public.vtutor_ucat_question_set_detail TO authenticated;
GRANT SELECT ON public.vstudent_ucat_question_sets TO authenticated;
GRANT SELECT ON public.vstudent_ucat_question_set_detail TO authenticated;
GRANT SELECT ON public.vtutor_ucat_mocks TO authenticated;
GRANT SELECT ON public.vtutor_ucat_mock_detail TO authenticated;
GRANT SELECT ON public.vstudent_ucat_mocks TO authenticated;
GRANT SELECT ON public.vstudent_ucat_mock_detail TO authenticated;

CREATE OR REPLACE FUNCTION public.ucat_question_set_content_snapshot(p_set_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'schemaVersion', 2,
    'id', question_set.id,
    'name', public.safe_text_to_jsonb(public.ucat_question_set_catalog_name(question_set.id)),
    'catalogName', public.ucat_question_set_catalog_name(question_set.id),
    'description', question_set.description,
    'timeLimitSeconds', public.ucat_question_set_time_limit_seconds(question_set.id),
    'timingMode', question_set.timing_mode,
    'paceMultiplier', question_set.pace_multiplier,
    'referenceBlueprintId', question_set.reference_blueprint_id,
    'stemIds', COALESCE((
      SELECT jsonb_agg(member.question_stem_id ORDER BY member.index, member.question_stem_id)
      FROM public.question_stems_question_sets member
      WHERE member.question_set_id = question_set.id
    ), '[]'::JSONB)
  )
  FROM public.question_sets question_set
  WHERE question_set.id = p_set_id;
$$;

CREATE OR REPLACE FUNCTION public.ucat_mock_content_snapshot(p_mock_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'schemaVersion', 2,
    'id', mock.id,
    'name', public.ucat_mock_catalog_name(mock.id),
    'catalogName', public.ucat_mock_catalog_name(mock.id),
    'instructionsText', mock.instructions_text,
    'blueprintId', mock.blueprint_id,
    'setIds', COALESCE((
      SELECT jsonb_agg(component.id ORDER BY section.section_number, component.id)
      FROM public.question_sets component
      JOIN public.ucat_sections section ON section.id = component.section_id
      WHERE component.mock_id = mock.id AND component.deleted_at IS NULL
    ), '[]'::JSONB)
  )
  FROM public.ucat_mocks mock
  WHERE mock.id = p_mock_id;
$$;

CREATE OR REPLACE FUNCTION public.ucat_set_attempt_snapshot_and_speed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_time_limit INTEGER;
  v_exam_time INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_time_limit := public.ucat_question_set_time_limit_seconds(NEW.question_set_id);
    v_exam_time := public.ucat_question_set_exam_time_seconds(NEW.question_set_id);
    NEW.set_time_limit_seconds := v_time_limit;
    NEW.set_time_limit_at_exam_speed_seconds := v_exam_time;
    NEW.set_speed := CASE WHEN v_time_limit > 0 AND v_exam_time > 0
      THEN v_exam_time::NUMERIC / v_time_limit ELSE NULL END;
  END IF;

  IF NEW.time_taken_seconds IS NOT NULL AND NEW.time_taken_seconds > 0 THEN
    IF NEW.student_set_speed IS NULL AND NEW.set_time_limit_seconds > 0 THEN
      NEW.student_set_speed := NEW.set_time_limit_seconds::NUMERIC / NEW.time_taken_seconds;
    END IF;
    IF NEW.student_exam_speed IS NULL AND NEW.set_time_limit_at_exam_speed_seconds > 0 THEN
      NEW.student_exam_speed := NEW.set_time_limit_at_exam_speed_seconds / NEW.time_taken_seconds;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ucat_content_core_publication_issues(
  p_content_type TEXT,
  p_content_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues JSONB := '[]'::JSONB;
  v_access public.ucat_access_scope;
  v_actual_question_count INTEGER;
  v_expected_question_count INTEGER;
BEGIN
  IF p_content_type = 'stem' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.question_stems
      WHERE id = p_content_id AND deleted_at IS NULL
    ) THEN
      RETURN jsonb_build_array(jsonb_build_object(
        'code', 'not_found', 'message', 'Question stem not found.'
      ));
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.question_stems
      WHERE id = p_content_id AND question_stem_category_id IS NULL
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'missing_category', 'message', 'Choose a stem category.'
      ));
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.ucat_questions
      WHERE question_stem_id = p_content_id AND deleted_at IS NULL
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'missing_questions', 'message', 'Add at least one question.'
      ));
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.ucat_questions question
      WHERE question.question_stem_id = p_content_id
        AND question.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.questions_question_tags question_tag
          WHERE question_tag.question_id = question.id
        )
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'missing_tags', 'message', 'Every question needs at least one tag.'
      ));
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.ucat_questions question
      WHERE question.question_stem_id = p_content_id
        AND question.deleted_at IS NULL
        AND (
          (question.answer_scheme <> 'decision_making_binary_placement'
            AND NOT public.ucat_rich_text_has_content(question.answer_explanation))
          OR (question.answer_scheme = 'decision_making_binary_placement' AND EXISTS (
            SELECT 1 FROM public.question_answer_options option
            WHERE option.question_id = question.id
              AND option.deleted_at IS NULL
              AND NOT public.ucat_rich_text_has_content(option.answer_explanation)
          ))
        )
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'missing_explanations',
        'message', 'Complete every required answer explanation.'
      ));
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.ucat_questions question
      WHERE question.question_stem_id = p_content_id
        AND question.deleted_at IS NULL
        AND (
          NOT public.ucat_rich_text_has_content(question.question_text)
          OR (SELECT count(*) FROM public.question_answer_options option
              WHERE option.question_id = question.id AND option.deleted_at IS NULL) < 2
          OR EXISTS (
            SELECT 1 FROM public.question_answer_options option
            WHERE option.question_id = question.id
              AND option.deleted_at IS NULL
              AND NOT public.ucat_rich_text_has_content(option.answer_text)
          )
          OR (
            question.answer_scheme IN ('single_choice', 'situational_judgement_rating')
            AND (SELECT count(*) FROM public.question_answer_options option
                 WHERE option.question_id = question.id
                   AND option.deleted_at IS NULL
                   AND option.answer_key_value = 'correct') <> 1
          )
        )
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'invalid_answer_structure',
        'message', 'Every question needs valid answer options and a valid correct answer.'
      ));
    END IF;
  ELSIF p_content_type = 'set' THEN
    SELECT access_scope INTO v_access
    FROM public.question_sets
    WHERE id = p_content_id AND deleted_at IS NULL;
    IF v_access IS NULL THEN
      RETURN jsonb_build_array(jsonb_build_object(
        'code', 'not_found', 'message', 'Question set not found.'
      ));
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.question_stems_question_sets WHERE question_set_id = p_content_id
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'missing_stems', 'message', 'Add at least one question stem.'
      ));
    END IF;
    SELECT
      count(question.id)::INTEGER,
      blueprint_section.exact_question_count
    INTO v_actual_question_count, v_expected_question_count
    FROM public.question_sets question_set
    JOIN public.ucat_sections section ON section.id = question_set.section_id
    JOIN public.ucat_mock_blueprint_sections blueprint_section
      ON blueprint_section.blueprint_id = question_set.reference_blueprint_id
     AND blueprint_section.section_index = section.section_number - 1
    LEFT JOIN public.question_stems_question_sets member
      ON member.question_set_id = question_set.id
    LEFT JOIN public.question_stems stem
      ON stem.id = member.question_stem_id
     AND stem.deleted_at IS NULL
    LEFT JOIN public.ucat_questions question
      ON question.question_stem_id = stem.id
     AND question.deleted_at IS NULL
    WHERE question_set.id = p_content_id
      AND question_set.set_format = 'full_section'
    GROUP BY blueprint_section.exact_question_count;
    IF v_expected_question_count IS NOT NULL
       AND v_actual_question_count IS DISTINCT FROM v_expected_question_count THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'full_section_question_count_mismatch',
        'message', format(
          'A full section set requires exactly %s questions for its reference blueprint; found %s.',
          v_expected_question_count,
          COALESCE(v_actual_question_count, 0)
        )
      ));
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.question_stems_question_sets member
      JOIN public.question_stems stem ON stem.id = member.question_stem_id
      WHERE member.question_set_id = p_content_id
        AND (stem.deleted_at IS NOT NULL OR stem.status <> 'published')
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'unpublished_children',
        'message', 'Every stem in a published set must be published.'
      ));
    END IF;
    IF v_access = 'public' AND EXISTS (
      SELECT 1
      FROM public.question_stems_question_sets member
      JOIN public.question_stems stem ON stem.id = member.question_stem_id
      WHERE member.question_set_id = p_content_id AND stem.access_scope = 'private'
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'private_children', 'message', 'A public set cannot contain private stems.'
      ));
    END IF;
  ELSIF p_content_type = 'mock' THEN
    SELECT access_scope INTO v_access
    FROM public.ucat_mocks
    WHERE id = p_content_id AND deleted_at IS NULL;
    IF v_access IS NULL THEN
      RETURN jsonb_build_array(jsonb_build_object(
        'code', 'not_found', 'message', 'Mock exam not found.'
      ));
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.question_sets
      WHERE mock_id = p_content_id AND deleted_at IS NULL
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'missing_sets', 'message', 'Add at least one question set.'
      ));
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.question_sets question_set
      WHERE question_set.mock_id = p_content_id
        AND (question_set.deleted_at IS NOT NULL OR question_set.status <> 'published')
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'unpublished_children',
        'message', 'Every set in a published mock must be published.'
      ));
    END IF;
    IF v_access = 'public' AND EXISTS (
      SELECT 1 FROM public.question_sets question_set
      WHERE question_set.mock_id = p_content_id AND question_set.access_scope = 'private'
    ) THEN
      v_issues := v_issues || jsonb_build_array(jsonb_build_object(
        'code', 'private_children', 'message', 'A public mock cannot contain private sets.'
      ));
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_ucat_content_type';
  END IF;
  RETURN v_issues;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_set_content_access(
  p_content_type TEXT,
  p_content_id UUID,
  p_access_scope public.ucat_access_scope
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_staff_id := public.current_tutor_id();
  IF p_content_type = 'stem' THEN
    IF p_access_scope = 'private' AND EXISTS (
      SELECT 1 FROM public.question_stems_question_sets member
      JOIN public.question_sets parent ON parent.id = member.question_set_id
      WHERE member.question_stem_id = p_content_id
        AND parent.deleted_at IS NULL AND parent.access_scope = 'public'
    ) THEN RAISE EXCEPTION 'private_child_of_public_set'; END IF;
    UPDATE public.question_stems SET access_scope = p_access_scope, updated_by = v_staff_id
    WHERE id = p_content_id AND deleted_at IS NULL;
  ELSIF p_content_type = 'set' THEN
    IF p_access_scope = 'public' AND EXISTS (
      SELECT 1 FROM public.question_stems_question_sets member
      JOIN public.question_stems child ON child.id = member.question_stem_id
      WHERE member.question_set_id = p_content_id
        AND child.deleted_at IS NULL AND child.access_scope = 'private'
    ) THEN RAISE EXCEPTION 'public_set_contains_private_stem'; END IF;
    IF p_access_scope = 'private' AND EXISTS (
      SELECT 1 FROM public.question_sets child
      JOIN public.ucat_mocks parent ON parent.id = child.mock_id
      WHERE child.id = p_content_id
        AND parent.deleted_at IS NULL AND parent.access_scope = 'public'
    ) THEN RAISE EXCEPTION 'private_child_of_public_mock'; END IF;
    UPDATE public.question_sets SET access_scope = p_access_scope, updated_by = v_staff_id
    WHERE id = p_content_id AND deleted_at IS NULL;
  ELSIF p_content_type = 'mock' THEN
    IF p_access_scope = 'public' AND EXISTS (
      SELECT 1 FROM public.question_sets child
      WHERE child.mock_id = p_content_id
        AND child.deleted_at IS NULL AND child.access_scope = 'private'
    ) THEN RAISE EXCEPTION 'public_mock_contains_private_set'; END IF;
    UPDATE public.ucat_mocks SET access_scope = p_access_scope, updated_by = v_staff_id
    WHERE id = p_content_id AND deleted_at IS NULL;
    UPDATE public.question_sets SET access_scope = p_access_scope, updated_by = v_staff_id
    WHERE mock_id = p_content_id AND deleted_at IS NULL;
  ELSIF p_content_type = 'lesson' THEN
    UPDATE public.ucat_learning_modules
    SET access_scope = p_access_scope, updated_by = v_staff_id, updated_at = NOW()
    WHERE id = p_content_id AND deleted_at IS NULL AND kind = 'lesson';
  ELSE
    RAISE EXCEPTION 'invalid_ucat_content_type';
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'ucat_content_not_found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_set_content_status(
  p_content_type TEXT,
  p_content_id UUID,
  p_status public.ucat_content_status
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
  v_current public.ucat_content_status;
  v_issues JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_staff_id := public.current_tutor_id();
  IF p_content_type = 'stem' THEN
    SELECT status INTO v_current FROM public.question_stems WHERE id = p_content_id AND deleted_at IS NULL;
  ELSIF p_content_type = 'set' THEN
    SELECT status INTO v_current FROM public.question_sets WHERE id = p_content_id AND deleted_at IS NULL;
  ELSIF p_content_type = 'mock' THEN
    SELECT status INTO v_current FROM public.ucat_mocks WHERE id = p_content_id AND deleted_at IS NULL;
  ELSIF p_content_type = 'lesson' THEN
    SELECT status INTO v_current FROM public.ucat_learning_modules
    WHERE id = p_content_id AND deleted_at IS NULL AND kind = 'lesson';
  ELSE
    RAISE EXCEPTION 'invalid_ucat_content_type';
  END IF;
  IF v_current IS NULL THEN RAISE EXCEPTION 'ucat_content_not_found'; END IF;
  IF v_current = p_status THEN RETURN; END IF;
  IF v_current = 'draft' AND p_status = 'published' THEN
    RAISE EXCEPTION 'send_content_for_review_before_publishing';
  END IF;
  IF p_status = 'published' THEN
    v_issues := public.ucat_content_publication_issues(p_content_type, p_content_id);
    IF jsonb_array_length(v_issues) > 0 THEN
      RAISE EXCEPTION 'publication_blocked:%', v_issues::TEXT;
    END IF;
  END IF;

  IF p_status <> 'published' THEN
    IF p_content_type = 'stem' AND EXISTS (
      SELECT 1 FROM public.question_stems_question_sets member
      JOIN public.question_sets parent ON parent.id = member.question_set_id
      WHERE member.question_stem_id = p_content_id
        AND parent.deleted_at IS NULL
        AND (parent.status = 'published' OR (parent.status = 'in_review' AND p_status = 'draft'))
    ) THEN RAISE EXCEPTION 'status_blocked_by_parent_set'; END IF;
    IF p_content_type = 'set' AND EXISTS (
      SELECT 1 FROM public.question_sets child
      JOIN public.ucat_mocks parent ON parent.id = child.mock_id
      WHERE child.id = p_content_id AND parent.deleted_at IS NULL
        AND (parent.status = 'published' OR (parent.status = 'in_review' AND p_status = 'draft'))
    ) THEN RAISE EXCEPTION 'status_blocked_by_parent_mock'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.ucat_sessions_resources resource
      WHERE (p_content_type = 'stem' AND resource.question_stem_id = p_content_id)
         OR (p_content_type = 'set' AND resource.question_set_id = p_content_id)
         OR (p_content_type = 'mock' AND resource.ucat_mock_id = p_content_id)
         OR (p_content_type = 'lesson' AND resource.ucat_learning_module_id = p_content_id)
    ) THEN RAISE EXCEPTION 'status_blocked_by_attachment'; END IF;
  END IF;

  IF p_status = 'in_review' AND p_content_type = 'set' AND EXISTS (
    SELECT 1 FROM public.question_stems_question_sets member
    JOIN public.question_stems child ON child.id = member.question_stem_id
    WHERE member.question_set_id = p_content_id
      AND (child.deleted_at IS NOT NULL OR child.status = 'draft')
  ) THEN RAISE EXCEPTION 'in_review_set_contains_draft_stem'; END IF;
  IF p_status = 'in_review' AND p_content_type = 'mock' AND EXISTS (
    SELECT 1 FROM public.question_sets child
    WHERE child.mock_id = p_content_id
      AND (child.deleted_at IS NOT NULL OR child.status = 'draft')
  ) THEN RAISE EXCEPTION 'in_review_mock_contains_draft_set'; END IF;

  IF p_content_type = 'stem' THEN
    UPDATE public.question_stems SET status = p_status, status_changed_at = NOW(),
      status_changed_by = v_staff_id,
      published_at = CASE WHEN p_status = 'published' THEN NOW() ELSE published_at END,
      published_by = CASE WHEN p_status = 'published' THEN v_staff_id ELSE published_by END,
      updated_by = v_staff_id WHERE id = p_content_id;
  ELSIF p_content_type = 'set' THEN
    UPDATE public.question_sets SET status = p_status, status_changed_at = NOW(),
      status_changed_by = v_staff_id,
      published_at = CASE WHEN p_status = 'published' THEN NOW() ELSE published_at END,
      published_by = CASE WHEN p_status = 'published' THEN v_staff_id ELSE published_by END,
      updated_by = v_staff_id WHERE id = p_content_id;
  ELSIF p_content_type = 'mock' THEN
    UPDATE public.ucat_mocks SET status = p_status, status_changed_at = NOW(),
      status_changed_by = v_staff_id,
      published_at = CASE WHEN p_status = 'published' THEN NOW() ELSE published_at END,
      published_by = CASE WHEN p_status = 'published' THEN v_staff_id ELSE published_by END,
      updated_by = v_staff_id WHERE id = p_content_id;
  ELSE
    UPDATE public.ucat_learning_modules SET status = p_status, status_changed_at = NOW(),
      status_changed_by = v_staff_id,
      published_at = CASE WHEN p_status = 'published' THEN NOW() ELSE published_at END,
      published_by = CASE WHEN p_status = 'published' THEN v_staff_id ELSE published_by END,
      updated_by = v_staff_id, updated_at = NOW()
    WHERE id = p_content_id AND kind = 'lesson';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_content_status_blockers(
  p_content_type TEXT,
  p_content_id UUID,
  p_status public.ucat_content_status
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blockers JSONB := '[]'::JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_status = 'published' THEN
    RETURN public.ucat_content_publication_issues(p_content_type, p_content_id);
  END IF;
  IF p_content_type = 'set' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'parent_mock',
      'message', format('This set belongs to the %s mock “%s”. Move that mock first.',
        replace(parent.status::TEXT, '_', ' '), public.ucat_mock_catalog_name(parent.id)),
      'entity_type', 'mock', 'entity_id', parent.id,
      'entity_name', public.ucat_mock_catalog_name(parent.id)
    )), '[]'::JSONB) INTO v_blockers
    FROM public.question_sets child
    JOIN public.ucat_mocks parent ON parent.id = child.mock_id
    WHERE child.id = p_content_id AND parent.deleted_at IS NULL
      AND (parent.status = 'published' OR (parent.status = 'in_review' AND p_status = 'draft'));
  ELSIF p_content_type = 'mock' AND p_status = 'in_review' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'draft_child_set',
      'message', format('This mock contains the draft set “%s”. Send it for review first.',
        public.ucat_question_set_catalog_name(child.id)),
      'entity_type', 'set', 'entity_id', child.id,
      'entity_name', public.ucat_question_set_catalog_name(child.id)
    )), '[]'::JSONB) INTO v_blockers
    FROM public.question_sets child
    WHERE child.mock_id = p_content_id
      AND (child.deleted_at IS NOT NULL OR child.status = 'draft');
  END IF;
  RETURN v_blockers;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_content_visibility_blockers(
  p_content_type TEXT,
  p_content_id UUID,
  p_access_scope public.ucat_access_scope,
  p_member_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blockers JSONB := '[]'::JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_content_type = 'stem' AND p_access_scope = 'private' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'private_child_of_public_set',
      'message', format('Make “%s” private before making this question private.',
        public.ucat_question_set_catalog_name(parent.id)),
      'entity_type', 'set', 'entity_id', parent.id,
      'entity_name', public.ucat_question_set_catalog_name(parent.id)
    ) ORDER BY parent.id), '[]'::JSONB) INTO v_blockers
    FROM public.question_stems_question_sets member
    JOIN public.question_sets parent ON parent.id = member.question_set_id
    WHERE member.question_stem_id = p_content_id
      AND parent.deleted_at IS NULL AND parent.access_scope = 'public';
  ELSIF p_content_type = 'set' AND p_access_scope = 'public' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'public_set_contains_private_stem',
      'message', format('Make the private question “%s” public before making this set public.',
        COALESCE(NULLIF(BTRIM(LEFT(public.extract_text_from_prosemirror_json(child.stem_text), 80)), ''), 'Untitled question')),
      'entity_type', 'stem', 'entity_id', child.id,
      'entity_name', COALESCE(NULLIF(BTRIM(LEFT(public.extract_text_from_prosemirror_json(child.stem_text), 80)), ''), 'Untitled question')
    ) ORDER BY child.id), '[]'::JSONB) INTO v_blockers
    FROM public.question_stems child
    WHERE child.deleted_at IS NULL
      AND child.access_scope = 'private'
      AND child.id = ANY(COALESCE(
        p_member_ids,
        ARRAY(SELECT member.question_stem_id
          FROM public.question_stems_question_sets member
          WHERE member.question_set_id = p_content_id)
      ));
  ELSIF p_content_type = 'set' AND p_access_scope = 'private' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'private_child_of_public_mock',
      'message', format('Make “%s” private before making this component set private.',
        public.ucat_mock_catalog_name(parent.id)),
      'entity_type', 'mock', 'entity_id', parent.id,
      'entity_name', public.ucat_mock_catalog_name(parent.id)
    )), '[]'::JSONB) INTO v_blockers
    FROM public.question_sets child
    JOIN public.ucat_mocks parent ON parent.id = child.mock_id
    WHERE child.id = p_content_id
      AND parent.deleted_at IS NULL AND parent.access_scope = 'public';
  ELSIF p_content_type = 'mock' AND p_access_scope = 'public' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'public_mock_contains_private_set',
      'message', format('Make “%s” public before making this mock public.',
        public.ucat_question_set_catalog_name(child.id)),
      'entity_type', 'set', 'entity_id', child.id,
      'entity_name', public.ucat_question_set_catalog_name(child.id)
    )), '[]'::JSONB) INTO v_blockers
    FROM public.question_sets child
    WHERE child.deleted_at IS NULL
      AND child.access_scope = 'private'
      AND child.id = ANY(COALESCE(
        p_member_ids,
        ARRAY(SELECT component.id FROM public.question_sets component
          WHERE component.mock_id = p_content_id)
      ));
  END IF;
  RETURN v_blockers;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_content_delete_blockers(
  p_content_type TEXT,
  p_content_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blockers JSONB := '[]'::JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_content_type = 'set' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'code', 'parent_mock',
      'message', format('Detach this set from “%s” before deleting it.',
        public.ucat_mock_catalog_name(parent.id)),
      'entity_type', 'mock', 'entity_id', parent.id,
      'entity_name', public.ucat_mock_catalog_name(parent.id)
    )), '[]'::JSONB) INTO v_blockers
    FROM public.question_sets child
    JOIN public.ucat_mocks parent ON parent.id = child.mock_id
    WHERE child.id = p_content_id AND parent.deleted_at IS NULL;
  END IF;
  RETURN v_blockers;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_delete_question_set(p_set_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set public.question_sets%ROWTYPE;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_set FROM public.question_sets
  WHERE id = p_set_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_set.mock_id IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.ucat_sessions_resources WHERE question_set_id = p_set_id)
  THEN RAISE EXCEPTION 'delete_blocked_by_dependency'; END IF;
  UPDATE public.question_sets SET deleted_at = NOW(), catalog_index = NULL,
    deleted_by = public.current_tutor_id(), updated_by = public.current_tutor_id()
  WHERE id = p_set_id;
  PERFORM public.ucat_compact_standalone_set_catalog(v_set.section_id, v_set.set_format);
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_delete_mock(p_mock_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM public.ucat_sessions_resources WHERE ucat_mock_id = p_mock_id)
  THEN RAISE EXCEPTION 'delete_blocked_by_dependency'; END IF;
  PERFORM pg_advisory_xact_lock(20875, 1);
  UPDATE public.ucat_mocks SET deleted_at = NOW(), catalog_index = NULL,
    deleted_by = public.current_tutor_id(), updated_by = public.current_tutor_id()
  WHERE id = p_mock_id AND deleted_at IS NULL;
  PERFORM public.ucat_compact_mock_catalog();
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_restore_question_set(p_set_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_set public.question_sets%ROWTYPE;
  v_next_index INTEGER;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_set FROM public.question_sets WHERE id = p_set_id FOR UPDATE;
  IF NOT FOUND OR v_set.deleted_at IS NULL THEN RETURN; END IF;
  IF EXISTS (
    SELECT 1
    FROM public.question_stems_question_sets member
    JOIN public.question_stems stem ON stem.id = member.question_stem_id
    WHERE member.question_set_id = p_set_id
      AND stem.deleted_at IS NULL
      AND stem.section_id IS DISTINCT FROM v_set.section_id
  ) THEN
    RAISE EXCEPTION 'question_set_restore_section_mismatch';
  END IF;
  IF v_set.mock_id IS NULL THEN
    SELECT COALESCE(max(catalog_index), 0) + 1 INTO v_next_index
    FROM public.question_sets
    WHERE deleted_at IS NULL AND mock_id IS NULL
      AND section_id = v_set.section_id AND set_format = v_set.set_format;
  END IF;
  UPDATE public.question_sets SET deleted_at = NULL, deleted_by = NULL,
    catalog_index = v_next_index, status = 'draft', status_changed_at = NOW(),
    status_changed_by = public.current_tutor_id(), updated_by = public.current_tutor_id()
  WHERE id = p_set_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_restore_mock(p_mock_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_index INTEGER;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(20875, 1);
  SELECT COALESCE(max(catalog_index), 0) + 1 INTO v_next_index
  FROM public.ucat_mocks WHERE deleted_at IS NULL;
  UPDATE public.ucat_mocks SET deleted_at = NULL, deleted_by = NULL,
    catalog_index = v_next_index, status = 'draft', status_changed_at = NOW(),
    status_changed_by = public.current_tutor_id(), updated_by = public.current_tutor_id()
  WHERE id = p_mock_id AND deleted_at IS NOT NULL;
END;
$$;

-- Keep every indirect entitlement path on the direct component ownership model.
CREATE OR REPLACE FUNCTION public.student_has_in_person_ucat_session_resource(
  p_student_id UUID,
  p_resource_type TEXT,
  p_resource_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_resource_id IS NOT NULL
    AND p_resource_type IN (
      'question', 'question_stem', 'question_set', 'mock',
      'learning_module', 'skill_trainer'
    )
    AND EXISTS (
      SELECT 1
      FROM public.classes_students enrollment
      JOIN public.classes class ON class.id = enrollment.class_id
      JOIN public.sessions session ON session.class_id = class.id
      JOIN public.ucat_sessions_resources resource ON resource.session_id = session.id
      WHERE enrollment.student_id = p_student_id
        AND enrollment.unenrolled_at IS NULL
        AND class.subject_id = public.get_ucat_subject_id()
        AND CASE p_resource_type
          WHEN 'mock' THEN resource.ucat_mock_id = p_resource_id
          WHEN 'question_set' THEN
            resource.question_set_id = p_resource_id
            OR EXISTS (
              SELECT 1 FROM public.question_sets component
              WHERE component.mock_id = resource.ucat_mock_id
                AND component.id = p_resource_id
                AND component.deleted_at IS NULL
            )
          WHEN 'question_stem' THEN
            resource.question_stem_id = p_resource_id
            OR EXISTS (
              SELECT 1 FROM public.question_stems_question_sets member
              WHERE member.question_set_id = resource.question_set_id
                AND member.question_stem_id = p_resource_id
            )
            OR EXISTS (
              SELECT 1
              FROM public.question_sets component
              JOIN public.question_stems_question_sets member
                ON member.question_set_id = component.id
              WHERE component.mock_id = resource.ucat_mock_id
                AND component.deleted_at IS NULL
                AND member.question_stem_id = p_resource_id
            )
            OR EXISTS (
              SELECT 1
              FROM public.ucat_learning_module_blocks block
              LEFT JOIN public.ucat_questions question ON question.id = block.question_id
              WHERE block.learning_module_id = resource.ucat_learning_module_id
                AND block.deleted_at IS NULL
                AND (block.question_stem_id = p_resource_id
                  OR question.question_stem_id = p_resource_id)
            )
          WHEN 'question' THEN EXISTS (
            SELECT 1
            FROM public.ucat_questions question
            WHERE question.id = p_resource_id
              AND question.deleted_at IS NULL
              AND (
                question.question_stem_id = resource.question_stem_id
                OR EXISTS (
                  SELECT 1 FROM public.question_stems_question_sets member
                  WHERE member.question_set_id = resource.question_set_id
                    AND member.question_stem_id = question.question_stem_id
                )
                OR EXISTS (
                  SELECT 1
                  FROM public.question_sets component
                  JOIN public.question_stems_question_sets member
                    ON member.question_set_id = component.id
                  WHERE component.mock_id = resource.ucat_mock_id
                    AND component.deleted_at IS NULL
                    AND member.question_stem_id = question.question_stem_id
                )
                OR EXISTS (
                  SELECT 1
                  FROM public.ucat_learning_module_blocks block
                  LEFT JOIN public.ucat_questions block_question ON block_question.id = block.question_id
                  WHERE block.learning_module_id = resource.ucat_learning_module_id
                    AND block.deleted_at IS NULL
                    AND (block.question_id = question.id
                      OR block.question_stem_id = question.question_stem_id
                      OR block_question.question_stem_id = question.question_stem_id)
                )
              )
          )
          WHEN 'learning_module' THEN resource.ucat_learning_module_id = p_resource_id
          WHEN 'skill_trainer' THEN EXISTS (
            SELECT 1 FROM public.ucat_learning_module_blocks block
            WHERE block.learning_module_id = resource.ucat_learning_module_id
              AND block.skill_trainer_id = p_resource_id
              AND block.deleted_at IS NULL
          )
          ELSE FALSE
        END
    );
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_question_stem_bundle(
  p_stem_id UUID,
  p_section_id UUID,
  p_question_stem_category_id UUID,
  p_stem_text JSONB,
  p_access_scope public.ucat_access_scope,
  p_questions JSONB,
  p_source_channel public.ucat_question_source_channel DEFAULT NULL,
  p_tutor_source_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stem_id UUID;
  v_invalid_mock UUID;
  v_refresh_was_deferred BOOLEAN;
BEGIN
  IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN
    RAISE EXCEPTION 'invalid_questions_payload';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_questions) question
    WHERE NOT (question ? 'response_type')
      OR NOT (question ? 'answer_scheme')
      OR question->>'response_type' IS NULL
      OR question->>'response_type' NOT IN ('multiple_choice', 'drag_and_drop')
      OR question->>'answer_scheme' IS NULL
      OR question->>'answer_scheme' NOT IN (
        'single_choice', 'situational_judgement_rating',
        'decision_making_binary_placement', 'situational_judgement_most_least'
      )
      OR jsonb_typeof(question->'answer_options') IS DISTINCT FROM 'array'
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(question->'answer_options') option
        WHERE NOT (option ? 'answer_key_value')
          OR (jsonb_typeof(option->'answer_key_value') <> 'null'
            AND option->>'answer_key_value' NOT IN ('correct', 'yes', 'no', 'most', 'least'))
      )
  ) THEN RAISE EXCEPTION 'canonical_response_contract_required'; END IF;

  v_refresh_was_deferred := public.ucat_catalog_refresh_is_deferred();
  PERFORM set_config('altitutor.defer_ucat_catalog_refresh', 'on', TRUE);
  BEGIN
    v_stem_id := public.tutor_ucat_upsert_stem_with_blueprint_guard(
      p_stem_id, p_section_id, p_question_stem_category_id, p_stem_text,
      p_access_scope, p_questions, p_source_channel, p_tutor_source_note
    );
    IF NOT v_refresh_was_deferred THEN
      PERFORM public.refresh_ucat_question_catalog_projection(v_stem_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('altitutor.defer_ucat_catalog_refresh',
      CASE WHEN v_refresh_was_deferred THEN 'on' ELSE 'off' END, TRUE);
    RAISE;
  END;
  PERFORM set_config('altitutor.defer_ucat_catalog_refresh',
    CASE WHEN v_refresh_was_deferred THEN 'on' ELSE 'off' END, TRUE);

  SELECT parent.id INTO v_invalid_mock
  FROM public.question_stems_question_sets stem_member
  JOIN public.question_sets component
    ON component.id = stem_member.question_set_id AND component.mock_id IS NOT NULL
  JOIN public.ucat_mocks parent ON parent.id = component.mock_id
  WHERE stem_member.question_stem_id = v_stem_id
    AND component.deleted_at IS NULL
    AND parent.deleted_at IS NULL
    AND parent.status = 'published'
    AND NOT (public.ucat_mock_blueprint_compliance(parent.id)->>'compliant')::boolean
  ORDER BY parent.id
  LIMIT 1;

  IF v_invalid_mock IS NOT NULL THEN
    RAISE EXCEPTION 'published_mock_blueprint_noncompliant:%', v_invalid_mock;
  END IF;
  RETURN v_stem_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_bulk_update_question_stem_metadata(
  p_stem_ids UUID[],
  p_question_stem_category_id UUID,
  p_access_scope public.ucat_access_scope
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invalid_mock UUID;
BEGIN
  PERFORM public.tutor_ucat_bulk_update_stem_metadata_before_blueprint_guard(
    p_stem_ids, p_question_stem_category_id, p_access_scope
  );

  SELECT parent.id INTO v_invalid_mock
  FROM public.question_stems_question_sets stem_member
  JOIN public.question_sets component
    ON component.id = stem_member.question_set_id AND component.mock_id IS NOT NULL
  JOIN public.ucat_mocks parent ON parent.id = component.mock_id
  WHERE stem_member.question_stem_id = ANY(COALESCE(p_stem_ids, ARRAY[]::UUID[]))
    AND component.deleted_at IS NULL
    AND parent.deleted_at IS NULL
    AND parent.status = 'published'
    AND NOT (public.ucat_mock_blueprint_compliance(parent.id)->>'compliant')::boolean
  ORDER BY parent.id
  LIMIT 1;

  IF v_invalid_mock IS NOT NULL THEN
    RAISE EXCEPTION 'published_mock_blueprint_noncompliant:%', v_invalid_mock;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_audit_mock_blueprint(
  p_mock_id UUID,
  p_blueprint_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id UUID;
  v_compliance JSONB;
  v_publication JSONB;
  v_section_purity JSONB;
  v_provisional JSONB;
  v_non_metadata_compliant BOOLEAN;
  v_decision public.ucat_mock_blueprint_audit_decision;
  v_unpublished_sets INTEGER;
  v_unpublished_stems INTEGER;
  v_impure_sets INTEGER;
  v_unclassified_dm INTEGER;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ucat_mocks WHERE id = p_mock_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'mock_not_found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ucat_mock_blueprints WHERE id = p_blueprint_id) THEN
    RAISE EXCEPTION 'mock_blueprint_not_found';
  END IF;

  v_compliance := public.ucat_mock_blueprint_candidate_compliance(p_mock_id, p_blueprint_id);

  SELECT
    count(DISTINCT component.id) FILTER (WHERE component.status <> 'published')::INTEGER,
    count(DISTINCT stem.id) FILTER (WHERE stem.status <> 'published')::INTEGER
  INTO v_unpublished_sets, v_unpublished_stems
  FROM public.question_sets component
  LEFT JOIN public.question_stems_question_sets member ON member.question_set_id = component.id
  LEFT JOIN public.question_stems stem ON stem.id = member.question_stem_id AND stem.deleted_at IS NULL
  WHERE component.mock_id = p_mock_id AND component.deleted_at IS NULL;

  v_publication := jsonb_build_object(
    'compliant', coalesce(v_unpublished_sets, 0) = 0 AND coalesce(v_unpublished_stems, 0) = 0,
    'unpublishedSetCount', coalesce(v_unpublished_sets, 0),
    'unpublishedStemCount', coalesce(v_unpublished_stems, 0),
    'reason', CASE WHEN coalesce(v_unpublished_sets, 0) = 0 AND coalesce(v_unpublished_stems, 0) = 0
      THEN 'Every component set and stem is published.'
      ELSE format('%s component sets and %s stems are not published.',
        coalesce(v_unpublished_sets, 0), coalesce(v_unpublished_stems, 0)) END
  );

  SELECT count(*)::INTEGER INTO v_impure_sets
  FROM (
    SELECT component.id
    FROM public.question_sets component
    JOIN public.question_stems_question_sets member ON member.question_set_id = component.id
    JOIN public.question_stems stem ON stem.id = member.question_stem_id AND stem.deleted_at IS NULL
    WHERE component.mock_id = p_mock_id AND component.deleted_at IS NULL
    GROUP BY component.id
    HAVING count(DISTINCT stem.section_id) <> 1
  ) impure;
  v_section_purity := jsonb_build_object(
    'compliant', coalesce(v_impure_sets, 0) = 0,
    'impureSetCount', coalesce(v_impure_sets, 0),
    'reason', CASE WHEN coalesce(v_impure_sets, 0) = 0
      THEN 'Every component set contains exactly one section.'
      ELSE format('%s component sets mix sections.', v_impure_sets) END
  );

  SELECT count(DISTINCT stem.id) FILTER (
    WHERE section.section_number = 2 AND stem.question_stem_category_id IS NULL
  )::INTEGER INTO v_unclassified_dm
  FROM public.question_sets component
  JOIN public.question_stems_question_sets member ON member.question_set_id = component.id
  JOIN public.question_stems stem ON stem.id = member.question_stem_id AND stem.deleted_at IS NULL
  JOIN public.ucat_sections section ON section.id = stem.section_id
  WHERE component.mock_id = p_mock_id AND component.deleted_at IS NULL;

  v_provisional := jsonb_build_object(
    'reviewed', coalesce(v_unclassified_dm, 0) = 0,
    'unclassifiedDecisionMakingStemCount', coalesce(v_unclassified_dm, 0),
    'reason', CASE WHEN coalesce(v_unclassified_dm, 0) = 0
      THEN 'Required Decision Making category metadata has been reviewed.'
      ELSE format('%s Decision Making stems need classification.', coalesce(v_unclassified_dm, 0)) END
  );

  SELECT coalesce(bool_and((check_item->>'compliant')::BOOLEAN), true)
  INTO v_non_metadata_compliant
  FROM jsonb_array_elements(v_compliance->'sections') section_item
  CROSS JOIN LATERAL jsonb_array_elements(section_item->'checks') check_item
  WHERE check_item->>'code' <> 'CATEGORY_COUNT_OUT_OF_RANGE';

  IF NOT (v_publication->>'compliant')::BOOLEAN
    OR NOT (v_section_purity->>'compliant')::BOOLEAN
    OR NOT v_non_metadata_compliant
  THEN v_decision := 'failed';
  ELSIF NOT (v_provisional->>'reviewed')::BOOLEAN THEN v_decision := 'provisional';
  ELSIF NOT (v_compliance->>'compliant')::BOOLEAN THEN v_decision := 'failed';
  ELSE v_decision := 'eligible';
  END IF;

  INSERT INTO public.ucat_mock_blueprint_eligibility_audits (
    mock_id, blueprint_id, checked_at, gate_results, decision
  ) VALUES (
    p_mock_id, p_blueprint_id, clock_timestamp(),
    jsonb_build_object(
      'compliance', v_compliance,
      'publicationState', v_publication,
      'sectionPurity', v_section_purity,
      'provisionalMetadata', v_provisional
    ),
    v_decision
  ) RETURNING id INTO v_audit_id;
  RETURN v_audit_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tutor_ucat_confirm_mock_blueprint_audit(p_audit_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate public.ucat_mock_blueprint_eligibility_audits%ROWTYPE;
  v_recheck_id UUID;
  v_recheck_decision public.ucat_mock_blueprint_audit_decision;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_candidate
  FROM public.ucat_mock_blueprint_eligibility_audits
  WHERE id = p_audit_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'mock_blueprint_audit_not_found'; END IF;
  IF v_candidate.decision <> 'eligible' THEN RAISE EXCEPTION 'mock_blueprint_audit_not_eligible'; END IF;

  v_recheck_id := public.tutor_ucat_audit_mock_blueprint(
    v_candidate.mock_id,
    v_candidate.blueprint_id
  );
  SELECT decision INTO v_recheck_decision
  FROM public.ucat_mock_blueprint_eligibility_audits
  WHERE id = v_recheck_id
  FOR UPDATE;
  IF v_recheck_decision <> 'eligible' THEN RAISE EXCEPTION 'mock_blueprint_audit_not_eligible'; END IF;

  -- A confirmed blueprint replacement rebases every owned component in the
  -- same transaction, preserving the direct-ownership invariant.
  UPDATE public.ucat_mocks
  SET blueprint_id = v_candidate.blueprint_id,
      updated_at = now(),
      updated_by = public.current_tutor_id()
  WHERE id = v_candidate.mock_id AND deleted_at IS NULL;

  UPDATE public.question_sets
  SET reference_blueprint_id = v_candidate.blueprint_id,
      set_format = 'full_section',
      timing_mode = 'pace',
      pace_multiplier = 1,
      fixed_time_limit_seconds = NULL,
      updated_by = public.current_tutor_id()
  WHERE mock_id = v_candidate.mock_id AND deleted_at IS NULL;

  UPDATE public.ucat_mock_blueprint_eligibility_audits
  SET decision = 'attached',
      attached_at = clock_timestamp(),
      attached_by = auth.uid()
  WHERE id = v_recheck_id;
  RETURN v_recheck_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_confirm_mock_blueprint_audit(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_confirm_mock_blueprint_audit(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_ucat_upsert_stem_with_blueprint_guard(
  p_stem_id UUID,
  p_section_id UUID,
  p_question_stem_category_id UUID,
  p_stem_text JSONB,
  p_access_scope public.ucat_access_scope,
  p_questions JSONB,
  p_source_channel public.ucat_question_source_channel DEFAULT NULL,
  p_tutor_source_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stem_id UUID;
  v_invalid_mock UUID;
BEGIN
  v_stem_id := public.tutor_ucat_upsert_stem_before_blueprint_guard(
    p_stem_id, p_section_id, p_question_stem_category_id, p_stem_text,
    p_access_scope, p_questions, p_source_channel, p_tutor_source_note
  );

  SELECT parent.id INTO v_invalid_mock
  FROM public.question_stems_question_sets stem_member
  JOIN public.question_sets component
    ON component.id = stem_member.question_set_id AND component.mock_id IS NOT NULL
  JOIN public.ucat_mocks parent ON parent.id = component.mock_id
  WHERE stem_member.question_stem_id = v_stem_id
    AND component.deleted_at IS NULL
    AND parent.deleted_at IS NULL
    AND parent.status = 'published'
    AND NOT (public.ucat_mock_blueprint_compliance(parent.id)->>'compliant')::BOOLEAN
  ORDER BY parent.id
  LIMIT 1;

  IF v_invalid_mock IS NOT NULL THEN
    RAISE EXCEPTION 'published_mock_blueprint_noncompliant:%', v_invalid_mock;
  END IF;
  RETURN v_stem_id;
END;
$$;

CREATE OR REPLACE VIEW public.vstudent_ucat_my_question_progress
WITH (security_invoker = false)
AS
WITH access_context AS MATERIALIZED (
  SELECT *
  FROM public.vstudent_ucat_access_context
  WHERE student_id = (SELECT public.current_student_id())
    AND has_ucat_access
), progress_stems AS MATERIALIZED (
  SELECT DISTINCT progress.question_stem_id
  FROM public.student_ucat_question_progress progress
  WHERE progress.student_id = (SELECT public.current_student_id())
), session_stems AS MATERIALIZED (
  SELECT resource.question_stem_id AS id
  FROM public.vstudent_ucat_accessible_session_resources resource
  JOIN progress_stems progress ON progress.question_stem_id = resource.question_stem_id
  WHERE resource.question_stem_id IS NOT NULL
  UNION
  SELECT member.question_stem_id AS id
  FROM public.vstudent_ucat_accessible_session_resources resource
  JOIN public.question_stems_question_sets member
    ON member.question_set_id = resource.question_set_id
  JOIN progress_stems progress ON progress.question_stem_id = member.question_stem_id
  UNION
  SELECT stem_member.question_stem_id AS id
  FROM public.vstudent_ucat_accessible_session_resources resource
  JOIN public.question_sets component
    ON component.mock_id = resource.ucat_mock_id AND component.deleted_at IS NULL
  JOIN public.question_stems_question_sets stem_member
    ON stem_member.question_set_id = component.id
  JOIN progress_stems progress ON progress.question_stem_id = stem_member.question_stem_id
), learning_stems AS MATERIALIZED (
  SELECT block.question_stem_id AS id
  FROM public.ucat_learning_module_blocks block
  JOIN public.vstudent_ucat_accessible_learning_modules module
    ON module.id = block.learning_module_id
  JOIN progress_stems progress ON progress.question_stem_id = block.question_stem_id
  WHERE block.deleted_at IS NULL AND block.question_stem_id IS NOT NULL
  UNION
  SELECT question.question_stem_id AS id
  FROM public.ucat_learning_module_blocks block
  JOIN public.vstudent_ucat_accessible_learning_modules module
    ON module.id = block.learning_module_id
  JOIN public.ucat_questions question ON question.id = block.question_id AND question.deleted_at IS NULL
  JOIN progress_stems progress ON progress.question_stem_id = question.question_stem_id
  WHERE block.deleted_at IS NULL AND block.question_id IS NOT NULL
), accessible_progress AS (
  SELECT progress.*
  FROM public.student_ucat_question_progress progress
  CROSS JOIN access_context context
  JOIN public.ucat_questions question
    ON question.id = progress.question_id AND question.deleted_at IS NULL
  JOIN public.question_stems stem
    ON stem.id = progress.question_stem_id
   AND stem.deleted_at IS NULL
   AND stem.status = 'published'
  WHERE progress.student_id = (SELECT public.current_student_id())
    AND (
      (context.has_online_access AND stem.access_scope = 'public')
      OR EXISTS (SELECT 1 FROM session_stems item WHERE item.id = stem.id)
      OR EXISTS (SELECT 1 FROM learning_stems item WHERE item.id = stem.id)
    )
), weighted_progress AS (
  SELECT progress.*,
    row_number() OVER (
      PARTITION BY progress.section_id, progress.question_stem_id
      ORDER BY progress.question_id
    ) AS stem_question_rank
  FROM accessible_progress progress
)
SELECT
  progress.section_id,
  progress.category_id,
  coalesce(sum(progress.best_score), 0)::INTEGER AS correct_score,
  sum(CASE
    WHEN progress.answer_scheme = 'decision_making_binary_placement'
      THEN CASE WHEN progress.stem_question_rank = 1 THEN 2 ELSE 0 END
    ELSE 1
  END)::INTEGER AS max_score
FROM weighted_progress progress
GROUP BY progress.section_id, progress.category_id;

REVOKE ALL ON public.vstudent_ucat_my_question_progress FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vstudent_ucat_my_question_progress TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ucat_mock_blueprint_compliance(UUID) TO authenticated;

-- The authoring MCP uses the same intent-native writers and optimistic locking.
DROP FUNCTION IF EXISTS public.tutor_ucat_mcp_upsert_question_set(
  UUID, TIMESTAMPTZ, JSONB, JSONB, INTEGER,
  public.ucat_access_scope, JSONB, UUID, JSONB
);
DROP FUNCTION IF EXISTS public.tutor_ucat_mcp_upsert_question_set(
  UUID, TIMESTAMPTZ, JSONB, JSONB, INTEGER,
  public.ucat_access_scope, JSONB, JSONB
);

CREATE FUNCTION public.tutor_ucat_mcp_upsert_question_set(
  p_set_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_authoring_note TEXT,
  p_description JSONB,
  p_timing_mode public.ucat_question_set_timing_mode,
  p_pace_multiplier NUMERIC,
  p_fixed_time_limit_seconds INTEGER,
  p_set_format public.ucat_question_set_format,
  p_access_scope public.ucat_access_scope,
  p_stem_ids JSONB,
  p_section_id UUID,
  p_reference_blueprint_id UUID,
  p_operation_kinds JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before_updated_at TIMESTAMPTZ;
  v_after_updated_at TIMESTAMPTZ;
  v_status public.ucat_content_status;
  v_set_id UUID;
  v_issues JSONB;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF p_set_id IS NOT NULL THEN
    SELECT updated_at, status INTO v_before_updated_at, v_status
    FROM public.question_sets
    WHERE id = p_set_id AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'question_set_not_found'; END IF;
    IF v_status = 'published' THEN RAISE EXCEPTION 'mcp_published_content_read_only'; END IF;
    IF p_expected_updated_at IS NULL OR v_before_updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'mcp_stale_revision';
    END IF;
  END IF;

  v_set_id := public.tutor_ucat_upsert_question_set_v2(
    p_set_id,
    p_authoring_note,
    coalesce(p_description, '{}'::JSONB),
    p_timing_mode,
    p_pace_multiplier,
    p_fixed_time_limit_seconds,
    p_set_format,
    coalesce(p_access_scope, 'public'),
    coalesce(p_stem_ids, '[]'::JSONB),
    p_section_id,
    p_reference_blueprint_id
  );

  SELECT status, updated_at INTO v_status, v_after_updated_at
  FROM public.question_sets WHERE id = v_set_id;

  IF v_status = 'in_review' THEN
    v_issues := public.ucat_mcp_review_issues('set', v_set_id);
    IF jsonb_array_length(v_issues) > 0 THEN
      RAISE EXCEPTION 'mcp_in_review_content_invalid:%', v_issues::TEXT;
    END IF;
  END IF;

  PERFORM public.ucat_mcp_record_activity(
    'question_sets', v_set_id,
    CASE WHEN p_set_id IS NULL THEN 'CREATED' ELSE 'UPDATED' END,
    CASE WHEN p_set_id IS NULL THEN 'create_question_set' ELSE 'update_question_set' END,
    v_before_updated_at, v_after_updated_at, p_operation_kinds
  );

  RETURN jsonb_build_object(
    'id', v_set_id,
    'status', v_status,
    'revision', public.ucat_mcp_authoring_revision(v_set_id, v_after_updated_at)
  );
END;
$$;

DROP FUNCTION IF EXISTS public.tutor_ucat_mcp_upsert_mock(
  UUID, TIMESTAMPTZ, TEXT, public.ucat_access_scope, JSONB, JSONB, JSONB
);

CREATE FUNCTION public.tutor_ucat_mcp_upsert_mock(
  p_mock_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_authoring_note TEXT,
  p_access_scope public.ucat_access_scope,
  p_instructions_text JSONB,
  p_blueprint_id UUID,
  p_set_ids JSONB,
  p_operation_kinds JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before_updated_at TIMESTAMPTZ;
  v_after_updated_at TIMESTAMPTZ;
  v_status public.ucat_content_status;
  v_mock_id UUID;
  v_issues JSONB;
  v_set_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF p_mock_id IS NOT NULL THEN
    SELECT updated_at, status INTO v_before_updated_at, v_status
    FROM public.ucat_mocks
    WHERE id = p_mock_id AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'mock_not_found'; END IF;
    IF v_status = 'published' THEN RAISE EXCEPTION 'mcp_published_content_read_only'; END IF;
    IF p_expected_updated_at IS NULL OR v_before_updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'mcp_stale_revision';
    END IF;
  END IF;

  v_mock_id := public.tutor_ucat_upsert_mock_v2(
    p_mock_id,
    p_authoring_note,
    coalesce(p_access_scope, 'public'),
    p_instructions_text,
    p_blueprint_id
  );

  IF p_set_ids IS NOT NULL THEN
    FOR v_set_id IN
      SELECT component.id
      FROM public.question_sets component
      WHERE component.mock_id = v_mock_id
        AND component.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(p_set_ids) desired(id)
          WHERE desired.id::UUID = component.id
        )
      ORDER BY component.id
    LOOP
      PERFORM public.tutor_ucat_detach_mock_set(v_set_id);
    END LOOP;

    FOR v_set_id IN
      SELECT desired.id::UUID
      FROM jsonb_array_elements_text(p_set_ids) desired(id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.question_sets component
        WHERE component.id = desired.id::UUID AND component.mock_id = v_mock_id
      )
    LOOP
      PERFORM public.tutor_ucat_attach_mock_set(v_mock_id, v_set_id);
    END LOOP;

    UPDATE public.ucat_mocks
    SET updated_at = clock_timestamp(), updated_by = public.current_tutor_id()
    WHERE id = v_mock_id;
  END IF;

  SELECT status, updated_at INTO v_status, v_after_updated_at
  FROM public.ucat_mocks WHERE id = v_mock_id;

  IF v_status = 'in_review' THEN
    v_issues := public.ucat_mcp_review_issues('mock', v_mock_id);
    IF jsonb_array_length(v_issues) > 0 THEN
      RAISE EXCEPTION 'mcp_in_review_content_invalid:%', v_issues::TEXT;
    END IF;
  END IF;

  PERFORM public.ucat_mcp_record_activity(
    'ucat_mocks', v_mock_id,
    CASE WHEN p_mock_id IS NULL THEN 'CREATED' ELSE 'UPDATED' END,
    CASE WHEN p_mock_id IS NULL THEN 'create_mock' ELSE 'update_mock' END,
    v_before_updated_at, v_after_updated_at, p_operation_kinds
  );

  RETURN jsonb_build_object(
    'id', v_mock_id,
    'status', v_status,
    'revision', public.ucat_mcp_authoring_revision(v_mock_id, v_after_updated_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_upsert_question_set(
  UUID, TIMESTAMPTZ, TEXT, JSONB,
  public.ucat_question_set_timing_mode, NUMERIC, INTEGER,
  public.ucat_question_set_format, public.ucat_access_scope,
  JSONB, UUID, UUID, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_upsert_question_set(
  UUID, TIMESTAMPTZ, TEXT, JSONB,
  public.ucat_question_set_timing_mode, NUMERIC, INTEGER,
  public.ucat_question_set_format, public.ucat_access_scope,
  JSONB, UUID, UUID, JSONB
) TO authenticated;

REVOKE ALL ON FUNCTION public.tutor_ucat_mcp_upsert_mock(
  UUID, TIMESTAMPTZ, TEXT, public.ucat_access_scope, JSONB, UUID, JSONB, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_ucat_mcp_upsert_mock(
  UUID, TIMESTAMPTZ, TEXT, public.ucat_access_scope, JSONB, UUID, JSONB, JSONB
) TO authenticated;

-- Content-change review predates intent-native set and mock writers. Replace the
-- dispatcher so reviewed changes use the same canonical model as direct MCP edits.
CREATE OR REPLACE FUNCTION public.tutor_ucat_mcp_apply_content_change(
  p_existing_change_id UUID,
  p_target_type TEXT,
  p_target_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_base_snapshot JSONB,
  p_proposed_snapshot JSONB,
  p_operations JSONB,
  p_summary TEXT,
  p_rationale TEXT,
  p_source TEXT,
  p_audit_run_id UUID,
  p_finding_refs JSONB,
  p_reverse_of_change_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current RECORD;
  v_after_updated_at TIMESTAMPTZ;
  v_after_status public.ucat_content_status;
  v_change_id UUID;
  v_staff_id UUID;
  v_existing public.ucat_mcp_content_changes%ROWTYPE;
  v_module_id UUID;
  v_ref JSONB;
  v_assessment_run RECORD;
  v_finding JSONB;
  v_set_id UUID;
BEGIN
  IF NOT public.is_ucat_tutor() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_current FROM public.ucat_mcp_lock_target(p_target_type, p_target_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'ucat_content_not_found'; END IF;
  IF v_current.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    IF p_existing_change_id IS NOT NULL THEN
      UPDATE public.ucat_mcp_content_changes
      SET status = 'stale'
      WHERE id = p_existing_change_id AND status = 'pending';
    END IF;
    RAISE EXCEPTION 'mcp_stale_revision';
  END IF;

  IF p_audit_run_id IS NOT NULL THEN
    PERFORM public.ucat_mcp_assert_audit_application(
      p_audit_run_id, p_target_type, p_target_id
    );
  END IF;

  v_staff_id := public.current_tutor_id();
  IF p_existing_change_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.ucat_mcp_content_changes
    WHERE id = p_existing_change_id
      AND target_type = p_target_type
      AND target_id = p_target_id
      AND status = 'pending'
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'content_change_not_pending'; END IF;
    IF v_existing.base_revision <> public.ucat_mcp_authoring_revision(p_target_id, v_current.updated_at) THEN
      UPDATE public.ucat_mcp_content_changes SET status = 'stale' WHERE id = p_existing_change_id;
      RAISE EXCEPTION 'mcp_stale_revision';
    END IF;
    v_change_id := v_existing.id;
    p_base_snapshot := v_existing.base_snapshot;
    p_proposed_snapshot := v_existing.proposed_snapshot;
    p_operations := v_existing.operations;
    p_summary := v_existing.summary;
    p_rationale := v_existing.rationale;
    p_source := v_existing.source;
    p_audit_run_id := v_existing.audit_run_id;
    p_finding_refs := v_existing.finding_refs;
    p_reverse_of_change_id := v_existing.reverse_of_change_id;
  ELSE
    INSERT INTO public.ucat_mcp_content_changes (
      target_type, target_id, source, audit_run_id, base_revision,
      base_snapshot, proposed_snapshot, operations, summary, rationale,
      finding_refs, reverse_of_change_id, created_by
    ) VALUES (
      p_target_type, p_target_id, p_source, p_audit_run_id,
      public.ucat_mcp_authoring_revision(p_target_id, v_current.updated_at),
      p_base_snapshot, p_proposed_snapshot, COALESCE(p_operations, '[]'::JSONB),
      BTRIM(p_summary), NULLIF(BTRIM(COALESCE(p_rationale, '')), ''),
      COALESCE(p_finding_refs, '[]'::JSONB), p_reverse_of_change_id, v_staff_id
    ) RETURNING id INTO v_change_id;
  END IF;

  IF p_target_type = 'stem' THEN
    PERFORM public.tutor_ucat_upsert_question_stem_bundle(
      p_target_id,
      (p_proposed_snapshot->>'sectionId')::UUID,
      NULLIF(p_proposed_snapshot->>'categoryId', '')::UUID,
      COALESCE(p_proposed_snapshot->'stemText', '{}'::JSONB),
      COALESCE((p_proposed_snapshot->>'accessScope')::public.ucat_access_scope, 'public'),
      COALESCE(p_proposed_snapshot->'questions', '[]'::JSONB),
      'ai_generation',
      p_proposed_snapshot->>'tutorSourceNote'
    );
    SELECT updated_at, status INTO v_after_updated_at, v_after_status
    FROM public.question_stems WHERE id = p_target_id;
  ELSIF p_target_type = 'set' THEN
    PERFORM public.tutor_ucat_upsert_question_set_v2(
      p_target_id,
      p_proposed_snapshot->>'authoringNote',
      COALESCE(p_proposed_snapshot->'description', '{}'::JSONB),
      (p_proposed_snapshot->>'timingMode')::public.ucat_question_set_timing_mode,
      NULLIF(p_proposed_snapshot->>'paceMultiplier', '')::NUMERIC,
      NULLIF(p_proposed_snapshot->>'fixedTimeLimitSeconds', '')::INTEGER,
      (p_proposed_snapshot->>'setFormat')::public.ucat_question_set_format,
      COALESCE((p_proposed_snapshot->>'accessScope')::public.ucat_access_scope, 'public'),
      COALESCE(p_proposed_snapshot->'stemIds', '[]'::JSONB),
      (p_proposed_snapshot->>'sectionId')::UUID,
      (p_proposed_snapshot->>'referenceBlueprintId')::UUID
    );
    SELECT updated_at, status INTO v_after_updated_at, v_after_status
    FROM public.question_sets WHERE id = p_target_id;
  ELSIF p_target_type = 'mock' THEN
    PERFORM public.tutor_ucat_upsert_mock_v2(
      p_target_id,
      p_proposed_snapshot->>'authoringNote',
      COALESCE((p_proposed_snapshot->>'accessScope')::public.ucat_access_scope, 'public'),
      NULLIF(p_proposed_snapshot->'instructionsText', 'null'::JSONB),
      (p_proposed_snapshot->>'blueprintId')::UUID
    );

    FOR v_set_id IN
      SELECT component.id
      FROM public.question_sets component
      WHERE component.mock_id = p_target_id
        AND component.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(
            COALESCE(p_proposed_snapshot->'setIds', '[]'::JSONB)
          ) desired(id)
          WHERE desired.id::UUID = component.id
        )
      ORDER BY component.id
    LOOP
      PERFORM public.tutor_ucat_detach_mock_set(v_set_id);
    END LOOP;

    FOR v_set_id IN
      SELECT desired.id::UUID
      FROM jsonb_array_elements_text(
        COALESCE(p_proposed_snapshot->'setIds', '[]'::JSONB)
      ) desired(id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.question_sets component
        WHERE component.id = desired.id::UUID
          AND component.mock_id = p_target_id
      )
    LOOP
      PERFORM public.tutor_ucat_attach_mock_set(p_target_id, v_set_id);
    END LOOP;

    UPDATE public.ucat_mocks
    SET updated_at = clock_timestamp(), updated_by = v_staff_id
    WHERE id = p_target_id;
    SELECT updated_at, status INTO v_after_updated_at, v_after_status
    FROM public.ucat_mocks WHERE id = p_target_id;
  ELSIF p_target_type = 'learning_module' THEN
    v_module_id := public.tutor_ucat_upsert_learning_module(
      p_target_id,
      (p_proposed_snapshot->>'kind')::public.ucat_learning_module_kind,
      p_proposed_snapshot->>'title',
      p_proposed_snapshot->>'description',
      NULLIF(p_proposed_snapshot->>'sectionId', '')::UUID,
      NULLIF(p_proposed_snapshot->>'parentId', '')::UUID,
      COALESCE((p_proposed_snapshot->>'index')::INTEGER, 0),
      COALESCE((p_proposed_snapshot->>'accessScope')::public.ucat_access_scope, 'public'),
      COALESCE(NULLIF(p_proposed_snapshot->>'iconKey', ''), 'book-open'),
      NULLIF(p_proposed_snapshot->>'estimatedMinutes', '')::INTEGER
    );
    PERFORM public.tutor_ucat_update_learning_module_study_plan_metadata(
      v_module_id,
      COALESCE(NULLIF(p_proposed_snapshot->>'studyPlanPriority', ''), 'recommended'),
      ARRAY(
        SELECT value::UUID
        FROM jsonb_array_elements_text(
          COALESCE(p_proposed_snapshot->'studyPlanCategoryIds', '[]'::JSONB)
        )
      ),
      ARRAY(
        SELECT value::UUID
        FROM jsonb_array_elements_text(
          COALESCE(p_proposed_snapshot->'studyPlanTagIds', '[]'::JSONB)
        )
      )
    );
    IF p_proposed_snapshot->>'kind' = 'lesson' THEN
      PERFORM public.tutor_ucat_replace_learning_module_blocks(
        v_module_id,
        COALESCE(p_proposed_snapshot->'blocks', '[]'::JSONB)
      );
    END IF;
    UPDATE public.ucat_learning_modules
    SET updated_at = NOW(), updated_by = v_staff_id
    WHERE id = v_module_id
    RETURNING updated_at, status INTO v_after_updated_at, v_after_status;
  ELSE
    RAISE EXCEPTION 'invalid_ucat_content_type';
  END IF;

  IF v_current.kind IS DISTINCT FROM 'folder'::public.ucat_learning_module_kind
    AND v_current.status IS DISTINCT FROM v_after_status THEN
    RAISE EXCEPTION 'mcp_content_lifecycle_changed';
  END IF;

  UPDATE public.ucat_mcp_content_changes
  SET status = 'applied',
      resulting_revision = public.ucat_mcp_authoring_revision(p_target_id, v_after_updated_at),
      applied_by = v_staff_id,
      applied_at = NOW()
  WHERE id = v_change_id;

  FOR v_ref IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_finding_refs, '[]'::JSONB))
  LOOP
    IF v_ref->>'assessmentRunId' IS NULL OR v_ref->>'findingKey' IS NULL THEN
      CONTINUE;
    END IF;
    SELECT run.id, run.stem_id, run.content_fingerprint, run.assessment_result, cycle.is_current
    INTO v_assessment_run
    FROM public.ucat_ai_question_assessment_runs run
    JOIN public.ucat_ai_question_assessment_cycles cycle ON cycle.id = run.cycle_id
    WHERE run.id = (v_ref->>'assessmentRunId')::UUID
      AND run.status = 'completed'
      AND run.stem_id = p_target_id;
    IF NOT FOUND OR v_assessment_run.is_current IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'assessment_finding_stale';
    END IF;
    SELECT value INTO v_finding
    FROM jsonb_array_elements(
      COALESCE(v_assessment_run.assessment_result->'findings', '[]'::JSONB)
    )
    WHERE value->>'key' = v_ref->>'findingKey'
    LIMIT 1;
    IF v_finding IS NULL THEN RAISE EXCEPTION 'assessment_finding_not_found'; END IF;
    INSERT INTO public.ucat_ai_question_assessment_decisions (
      run_id, stem_id, finding_key, decision, reason,
      reviewed_content_fingerprint, patch, decided_by, content_change_id
    ) VALUES (
      v_assessment_run.id, p_target_id, v_ref->>'findingKey',
      CASE
        WHEN COALESCE((v_ref->>'appliedExactSuggestion')::BOOLEAN, false)
          THEN 'suggestion_accepted'
        ELSE 'acknowledged'
      END,
      NULLIF(BTRIM(COALESCE(v_ref->>'reason', '')), ''),
      v_assessment_run.content_fingerprint,
      CASE
        WHEN COALESCE((v_ref->>'appliedExactSuggestion')::BOOLEAN, false)
          THEN v_finding->'suggestion'->'patches'
        ELSE NULL
      END,
      v_staff_id,
      v_change_id
    );
  END LOOP;

  PERFORM public.ucat_mcp_record_activity(
    CASE p_target_type
      WHEN 'stem' THEN 'question_stems'
      WHEN 'set' THEN 'question_sets'
      WHEN 'mock' THEN 'ucat_mocks'
      ELSE 'ucat_learning_modules'
    END,
    p_target_id,
    'UPDATED',
    CASE
      WHEN p_source = 'assessment' THEN 'accept_question_ai_assessment_suggestion'
      WHEN p_source = 'recovery' THEN 'restore_published_content_change'
      ELSE 'apply_published_content_change'
    END,
    v_current.updated_at,
    v_after_updated_at,
    COALESCE(p_operations, '[]'::JSONB)
  );

  RETURN jsonb_build_object(
    'id', p_target_id,
    'status', v_after_status,
    'revision', public.ucat_mcp_authoring_revision(p_target_id, v_after_updated_at),
    'changeId', v_change_id
  );
END;
$$;

-- Remove superseded writers only after every in-repo caller has an intent-native path.
DROP FUNCTION IF EXISTS public.tutor_ucat_upsert_mock(
  UUID, TEXT, public.ucat_access_scope, JSONB, JSONB
);
DROP FUNCTION IF EXISTS public.tutor_ucat_upsert_mock(
  UUID, TEXT, public.ucat_access_scope, JSONB, JSONB, UUID
);
DROP FUNCTION IF EXISTS public.tutor_ucat_upsert_mock_before_eligibility_audit(
  UUID, TEXT, public.ucat_access_scope, JSONB, JSONB, UUID
);
DROP FUNCTION IF EXISTS public.tutor_ucat_upsert_question_set(
  UUID, JSONB, JSONB, INTEGER, public.ucat_access_scope, JSONB
);
DROP FUNCTION IF EXISTS public.tutor_ucat_upsert_question_set(
  UUID, JSONB, JSONB, INTEGER, public.ucat_access_scope, JSONB, UUID
);
DROP FUNCTION IF EXISTS public.tutor_ucat_upsert_question_set_before_mock_blueprint_guard(
  UUID, JSONB, JSONB, INTEGER, public.ucat_access_scope, JSONB, UUID
);

DROP TABLE public.question_sets_ucat_mocks;
