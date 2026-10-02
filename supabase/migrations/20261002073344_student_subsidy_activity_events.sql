-- Subsidy activity uses the same transactional lifecycle boundary as absences.
-- Preserve the released subsidy implementation and its null/default contract;
-- hide its internal row rewrites behind one event per save.
ALTER FUNCTION public.save_student_subsidy(
  uuid, uuid, uuid, public.billing_type, integer, text, timestamptz, timestamptz
) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.save_student_subsidy(
  uuid, uuid, uuid, public.billing_type, integer, text, timestamptz, timestamptz
) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.student_subsidy_snapshot(subsidy public.student_subsidies)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', subsidy.id,
    'student_id', subsidy.student_id,
    'subject_id', subsidy.subject_id,
    'subject_name', (SELECT COALESCE(subject.long_name, subject.short_name, subject.name)
                     FROM public.subjects subject WHERE subject.id = subsidy.subject_id),
    'billing_type', subsidy.billing_type,
    'price_cents', subsidy.price_cents,
    'currency', subsidy.currency,
    'effective_from', subsidy.effective_from,
    'effective_until', subsidy.effective_until
  );
$$;

CREATE FUNCTION private.record_student_subsidy_activity(
  before_subsidy jsonb,
  after_subsidy jsonb,
  affected_subsidies jsonb DEFAULT '[]'::jsonb,
  actor_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  subsidy jsonb := COALESCE(after_subsidy, before_subsidy);
  event_name text;
  entities jsonb := '[]'::jsonb;
BEGIN
  -- Display-name/technical metadata changes alone are not subsidy changes.
  IF (before_subsidy - 'subject_name') IS NOT DISTINCT FROM (after_subsidy - 'subject_name')
     AND affected_subsidies = '[]'::jsonb THEN
    RETURN;
  END IF;
  event_name := CASE
    WHEN before_subsidy IS NULL THEN 'student.subsidy_added'
    WHEN after_subsidy IS NULL THEN 'student.subsidy_removed'
    ELSE 'student.subsidy_changed'
  END;
  -- Subsidies belong directly to Students. Parent feeds do not inherit Student
  -- history (ADR-0036). Reassigning a subsidy directly affects both Students.
  IF before_subsidy->>'student_id' IS DISTINCT FROM after_subsidy->>'student_id'
     AND before_subsidy IS NOT NULL AND after_subsidy IS NOT NULL THEN
    entities := jsonb_build_array(public.domain_event_entity(
      'student', (before_subsidy->>'student_id')::uuid, 'previous_student'
    ));
  END IF;
  PERFORM public.record_domain_event(
    p_event_name := event_name,
    p_subject_type := 'student',
    p_subject_id := (subsidy->>'student_id')::uuid,
    p_entities := entities,
    p_payload := jsonb_build_object(
      'subsidy_id', subsidy->'id',
      'before', before_subsidy,
      'after', after_subsidy,
      'affected_subsidies', affected_subsidies
    ),
    p_effective_at := CASE WHEN after_subsidy IS NULL THEN NOW()
                           ELSE (after_subsidy->>'effective_from')::timestamptz END,
    p_actor_staff_id := actor_id
  );
END;
$$;

CREATE FUNCTION private.capture_student_subsidy_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  before_subsidy jsonb;
  after_subsidy jsonb;
  actor_id uuid := public.current_staff_id();
BEGIN
  IF current_setting('app.student_merge_in_progress', true) = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP <> 'INSERT' THEN
    before_subsidy := private.student_subsidy_snapshot(OLD);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    after_subsidy := private.student_subsidy_snapshot(NEW);
  END IF;
  -- A parent entity's cascade is not an administrator removing a subsidy.
  IF TG_OP = 'DELETE' AND (
    NOT EXISTS (SELECT 1 FROM public.students WHERE id = OLD.student_id)
    OR NOT EXISTS (SELECT 1 FROM public.subjects WHERE id = OLD.subject_id)
  ) THEN
    RETURN OLD;
  END IF;
  IF current_setting('app.student_subsidy_activity_operation', true) = 'save' THEN
    -- Collect only writes made by this operation, rather than diffing a live
    -- Student's entire subsidy set (which could include concurrent edits).
    PERFORM set_config('app.student_subsidy_activity_rows',
      (COALESCE(NULLIF(current_setting('app.student_subsidy_activity_rows', true), '')::jsonb, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('before', before_subsidy, 'after', after_subsidy)))::text, true);
  ELSE
    -- Creator attribution is valid for a new row, not for later system edits.
    IF TG_OP = 'INSERT' THEN actor_id := COALESCE(actor_id, NEW.created_by); END IF;
    PERFORM private.record_student_subsidy_activity(before_subsidy, after_subsidy, '[]'::jsonb, actor_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER capture_student_subsidy_activity
AFTER INSERT OR UPDATE OR DELETE ON public.student_subsidies
FOR EACH ROW EXECUTE FUNCTION private.capture_student_subsidy_activity();

CREATE FUNCTION public.save_student_subsidy(
  p_id uuid DEFAULT NULL,
  p_student_id uuid DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL,
  p_billing_type public.billing_type DEFAULT NULL,
  p_price_cents integer DEFAULT NULL,
  p_currency text DEFAULT 'AUD',
  p_effective_from timestamptz DEFAULT NULL,
  p_effective_until timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  saved_id uuid;
  before_subsidy jsonb;
  after_subsidy jsonb;
  affected_subsidies jsonb;
  previous_operation text := current_setting('app.student_subsidy_activity_operation', true);
  previous_rows text := current_setting('app.student_subsidy_activity_rows', true);
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_id IS NOT NULL THEN
    SELECT private.student_subsidy_snapshot(subsidy) INTO before_subsidy
    FROM public.student_subsidies subsidy WHERE id = p_id FOR UPDATE;
  END IF;
  PERFORM set_config('app.student_subsidy_activity_operation', 'save', true);
  PERFORM set_config('app.student_subsidy_activity_rows', '[]', true);
  saved_id := private.save_student_subsidy(
    p_id, p_student_id, p_subject_id, p_billing_type, p_price_cents,
    p_currency, p_effective_from, p_effective_until
  );
  SELECT private.student_subsidy_snapshot(subsidy) INTO after_subsidy
  FROM public.student_subsidies subsidy WHERE id = saved_id;

  -- Coalesce the actual row writes by identity. A delete/reinsert of the edited
  -- row is one change; resumed ranges are details of this save, not new grants.
  WITH writes AS (
    SELECT value, ordinality,
      COALESCE(value->'after'->>'id', value->'before'->>'id') AS id
    FROM jsonb_array_elements(current_setting('app.student_subsidy_activity_rows')::jsonb)
      WITH ORDINALITY
  ), changes AS (
    SELECT id,
      (array_agg(value->'before' ORDER BY ordinality))[1] AS before,
      (array_agg(value->'after' ORDER BY ordinality DESC))[1] AS after
    FROM writes WHERE id <> saved_id::text GROUP BY id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('before', before, 'after', after) ORDER BY id), '[]'::jsonb)
    INTO affected_subsidies
  FROM changes WHERE before IS DISTINCT FROM after;

  PERFORM set_config('app.student_subsidy_activity_operation', COALESCE(previous_operation, ''), true);
  PERFORM set_config('app.student_subsidy_activity_rows', COALESCE(previous_rows, ''), true);
  PERFORM private.record_student_subsidy_activity(
    before_subsidy, after_subsidy, affected_subsidies, public.current_staff_id()
  );
  RETURN saved_id;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.student_subsidy_activity_operation', COALESCE(previous_operation, ''), true);
  PERFORM set_config('app.student_subsidy_activity_rows', COALESCE(previous_rows, ''), true);
  RAISE;
END;
$$;

COMMENT ON FUNCTION public.save_student_subsidy(
  uuid, uuid, uuid, public.billing_type, integer, text, timestamptz, timestamptz
) IS 'Saves the only subsidy rate for this window and records one atomic Student lifecycle event, including any rates closed or split by the save.';

REVOKE ALL ON FUNCTION private.student_subsidy_snapshot(public.student_subsidies)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.record_student_subsidy_activity(jsonb, jsonb, jsonb, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.capture_student_subsidy_activity()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_student_subsidy(
  uuid, uuid, uuid, public.billing_type, integer, text, timestamptz, timestamptz
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.save_student_subsidy(
  uuid, uuid, uuid, public.billing_type, integer, text, timestamptz, timestamptz
) TO authenticated;
