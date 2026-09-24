-- Effective-dated Class billing configuration.
--
-- A Class configuration revision owns the billing type that applies from its
-- effective date. Sessions keep a stored snapshot so historical Sessions and
-- existing invoice items are never repriced by a later Class change.

ALTER TABLE public.sessions
  ALTER COLUMN billing_type DROP EXPRESSION;

ALTER TABLE public.classes
  ADD COLUMN billing_type public.billing_type NOT NULL DEFAULT 'CLASS',
  ADD COLUMN billing_type_effective_from DATE NOT NULL DEFAULT CURRENT_DATE;

ALTER TABLE public.class_schedule_revisions
  ADD COLUMN billing_type public.billing_type NOT NULL DEFAULT 'CLASS';

UPDATE public.classes class
SET billing_type_effective_from = COALESCE(
  (
    SELECT revision.effective_from
    FROM public.class_schedule_revisions revision
    WHERE revision.class_id = class.id
      AND revision.superseded_at IS NULL
    ORDER BY revision.effective_from DESC, revision.created_at DESC
    LIMIT 1
  ),
  class.session_start_date
);

COMMENT ON COLUMN public.classes.billing_type IS
  'Latest configured Class billing type; effective-dated history lives on class_schedule_revisions.';
COMMENT ON COLUMN public.classes.billing_type_effective_from IS
  'Date from which the latest configured Class billing type applies in the Class schedule timezone.';
COMMENT ON COLUMN public.class_schedule_revisions.billing_type IS
  'Billing type inherited by Class Sessions covered by this effective-dated revision.';
COMMENT ON COLUMN public.sessions.billing_type IS
  'Stored billing snapshot inherited from the effective Class configuration or derived from standalone Session type.';

CREATE OR REPLACE FUNCTION public.set_class_revision_billing_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_configured_billing_type TEXT := current_setting('app.class_billing_type', TRUE);
BEGIN
  IF current_setting('app.class_schedule_apply', TRUE) = 'true'
     AND NULLIF(v_configured_billing_type, '') IS NULL THEN
    RAISE EXCEPTION 'Class schedule applies must provide a billing type';
  END IF;

  IF NULLIF(v_configured_billing_type, '') IS NOT NULL THEN
    NEW.billing_type := v_configured_billing_type::public.billing_type;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_class_revision_billing_type()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trigger_set_class_revision_billing_type
  BEFORE INSERT ON public.class_schedule_revisions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_class_revision_billing_type();

CREATE OR REPLACE FUNCTION public.sync_class_revision_billing_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_timezone TEXT;
BEGIN
  IF NEW.superseded_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT class.schedule_timezone
  INTO v_timezone
  FROM public.classes class
  WHERE class.id = NEW.class_id;

  UPDATE public.classes class
  SET
    billing_type = NEW.billing_type,
    billing_type_effective_from = NEW.effective_from
  WHERE class.id = NEW.class_id;

  UPDATE public.sessions session
  SET billing_type = NEW.billing_type
  WHERE session.class_id = NEW.class_id
    AND session.start_at >= NEW.effective_from::TIMESTAMP AT TIME ZONE v_timezone
    AND session.start_at < (NEW.effective_to + 1)::TIMESTAMP AT TIME ZONE v_timezone;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_class_revision_billing_type()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trigger_sync_class_revision_billing_type
  AFTER INSERT OR UPDATE OF billing_type, effective_from
  ON public.class_schedule_revisions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_class_revision_billing_type();

CREATE OR REPLACE FUNCTION public.set_session_billing_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_class_billing_type public.billing_type;
  v_class_default_billing_type public.billing_type;
  v_schedule_timezone TEXT;
  v_session_date DATE;
BEGIN
  IF NEW.class_id IS NOT NULL THEN
    SELECT class.billing_type, class.schedule_timezone
    INTO v_class_default_billing_type, v_schedule_timezone
    FROM public.classes class
    WHERE class.id = NEW.class_id;

    IF NEW.start_at IS NOT NULL THEN
      v_session_date := (
        NEW.start_at AT TIME ZONE COALESCE(v_schedule_timezone, 'Australia/Adelaide')
      )::DATE;

      SELECT revision.billing_type
      INTO v_class_billing_type
      FROM public.class_schedule_revisions revision
      WHERE revision.class_id = NEW.class_id
        AND revision.superseded_at IS NULL
        AND v_session_date BETWEEN revision.effective_from AND revision.effective_to
      ORDER BY revision.effective_from DESC, revision.created_at DESC
      LIMIT 1;
    END IF;

    NEW.billing_type := COALESCE(
      v_class_billing_type,
      v_class_default_billing_type,
      'CLASS'::public.billing_type
    );
  ELSE
    NEW.billing_type := CASE NEW.type
      WHEN 'CLASS'::public.session_type THEN 'CLASS'::public.billing_type
      WHEN 'DRAFTING'::public.session_type THEN 'DRAFTING'::public.billing_type
      WHEN 'EXAM_COURSE'::public.session_type THEN 'EXAM_COURSE'::public.billing_type
      ELSE NULL
    END;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_session_billing_type()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trigger_set_session_billing_type
  BEFORE INSERT OR UPDATE OF type, class_id, start_at, billing_type
  ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_session_billing_type();

-- Keep the existing, extensively tested schedule materializer as the core and
-- wrap it so billing participates in the same previewed transaction.
ALTER FUNCTION public.apply_class_schedule(JSONB, TEXT)
  RENAME TO apply_class_schedule_core;

REVOKE ALL ON FUNCTION public.apply_class_schedule_core(JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_class_schedule_core(JSONB, TEXT)
  TO authenticated, service_role;

CREATE FUNCTION public.apply_class_schedule(
  p_proposal JSONB,
  p_expected_proposal_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_billing_type_text TEXT := COALESCE(NULLIF(p_proposal->>'billing_type', ''), 'CLASS');
  v_previous_billing_type TEXT := current_setting('app.class_billing_type', TRUE);
  v_result JSONB;
BEGIN
  IF CURRENT_USER NOT IN ('postgres', 'service_role')
     AND NOT (SELECT public.is_adminstaff_active()) THEN
    RAISE EXCEPTION 'ADMINSTAFF access required' USING ERRCODE = '42501';
  END IF;

  IF v_billing_type_text NOT IN ('CLASS', 'EXAM_COURSE', 'DRAFTING') THEN
    RAISE EXCEPTION 'Unknown Class billing type: %', v_billing_type_text;
  END IF;

  PERFORM set_config('app.class_billing_type', v_billing_type_text, TRUE);
  v_result := public.apply_class_schedule_core(p_proposal, p_expected_proposal_hash);
  PERFORM set_config(
    'app.class_billing_type',
    COALESCE(v_previous_billing_type, ''),
    TRUE
  );
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config(
    'app.class_billing_type',
    COALESCE(v_previous_billing_type, ''),
    TRUE
  );
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_class_schedule(JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_class_schedule(JSONB, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.apply_class_schedule(JSONB, TEXT) IS
  'Applies one previewed effective-dated Class schedule and billing configuration atomically.';

-- Enrich the existing search payload without duplicating its filtering logic.
ALTER FUNCTION public.search_classes_admin(
  TEXT, TEXT[], UUID[], UUID[], UUID[], BOOLEAN, BOOLEAN, BOOLEAN,
  INTEGER, INTEGER, TEXT, BOOLEAN
)
  RENAME TO search_classes_admin_core;

REVOKE ALL ON FUNCTION public.search_classes_admin_core(
  TEXT, TEXT[], UUID[], UUID[], UUID[], BOOLEAN, BOOLEAN, BOOLEAN,
  INTEGER, INTEGER, TEXT, BOOLEAN
)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.search_classes_admin(
  p_search TEXT DEFAULT NULL,
  p_statuses TEXT[] DEFAULT ARRAY['ACTIVE']::TEXT[],
  p_subject_ids UUID[] DEFAULT NULL,
  p_student_ids UUID[] DEFAULT NULL,
  p_staff_ids UUID[] DEFAULT NULL,
  p_include_relationships BOOLEAN DEFAULT TRUE,
  p_exclude_student_search BOOLEAN DEFAULT FALSE,
  p_exclude_staff_search BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'day_of_week',
  p_ascending BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
DECLARE
  v_result JSONB;
  v_classes JSONB;
BEGIN
  IF NOT (SELECT public.is_adminstaff_active()) THEN
    RETURN jsonb_build_object(
      'classes', '[]'::JSONB,
      'classSubjects', '{}'::JSONB,
      'classStudents', '{}'::JSONB,
      'classStaff', '{}'::JSONB,
      'total', 0
    );
  END IF;

  v_result := public.search_classes_admin_core(
    p_search,
    p_statuses,
    p_subject_ids,
    p_student_ids,
    p_staff_ids,
    p_include_relationships,
    p_exclude_student_search,
    p_exclude_staff_search,
    p_limit,
    p_offset,
    p_order_by,
    p_ascending
  );

  SELECT COALESCE(
    jsonb_agg(
      class_json || jsonb_build_object(
        'billing_type', class.billing_type,
        'billing_type_effective_from', class.billing_type_effective_from,
        'cohort_label', class.cohort_label,
        'session_start_date', class.session_start_date,
        'session_end_date', class.session_end_date,
        'schedule_timezone', class.schedule_timezone,
        'schedule_summary_short', class.schedule_summary_short,
        'schedule_summary_long', class.schedule_summary_long,
        'schedule_weekdays', class.schedule_weekdays,
        'schedule_rows', class.schedule_rows,
        'schedule_frequency_weeks', class.schedule_frequency_weeks,
        'schedule_anchor_date', class.schedule_anchor_date,
        'next_session_start_at', class.next_session_start_at
      )
      ORDER BY class_row.position
    ),
    '[]'::JSONB
  )
  INTO v_classes
  FROM jsonb_array_elements(COALESCE(v_result->'classes', '[]'::JSONB))
    WITH ORDINALITY AS class_row(class_json, position)
  JOIN public.classes class ON class.id = (class_json->>'id')::UUID;

  RETURN jsonb_set(v_result, '{classes}', v_classes);
END;
$$;

REVOKE ALL ON FUNCTION public.search_classes_admin(
  TEXT, TEXT[], UUID[], UUID[], UUID[], BOOLEAN, BOOLEAN, BOOLEAN,
  INTEGER, INTEGER, TEXT, BOOLEAN
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_classes_admin(
  TEXT, TEXT[], UUID[], UUID[], UUID[], BOOLEAN, BOOLEAN, BOOLEAN,
  INTEGER, INTEGER, TEXT, BOOLEAN
) TO authenticated;

COMMENT ON FUNCTION public.search_classes_admin(
  TEXT, TEXT[], UUID[], UUID[], UUID[], BOOLEAN, BOOLEAN, BOOLEAN,
  INTEGER, INTEGER, TEXT, BOOLEAN
) IS 'Admin Class search with effective billing and projected schedule fields.';
