-- Notify active UCAT users when official content becomes public. Releases are
-- aggregated by content type and Adelaide calendar day, so publishing a batch
-- creates at most one Set, Mock, and Learning notification per student.
CREATE OR REPLACE FUNCTION public.notify_ucat_public_content_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released boolean := false;
  v_content_type text;
  v_notification_type text;
  v_title text;
  v_body text;
  v_plural_body text;
  v_action_url text;
  v_action_label text;
  v_aggregate_date date := (now() AT TIME ZONE 'Australia/Adelaide')::date;
  v_created_by_staff_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'question_sets' THEN
    v_content_type := 'sets';
    v_notification_type := 'ucat.content.sets_released';
    v_title := 'New UCAT sets are available';
    v_body := 'A new question set has been released.';
    v_plural_body := ' new question sets have been released.';
    v_action_url := '/sets';
    v_action_label := 'View sets';
    v_released := NEW.is_private = false
      AND NEW.deleted_at IS NULL
      AND NEW.is_student_generated = false
      AND (
        TG_OP = 'INSERT'
        OR OLD.is_private = true
        OR OLD.deleted_at IS NOT NULL
        OR OLD.is_student_generated = true
      );
  ELSIF TG_TABLE_NAME = 'ucat_mocks' THEN
    v_content_type := 'mocks';
    v_notification_type := 'ucat.content.mocks_released';
    v_title := 'New UCAT mocks are available';
    v_body := 'A new mock exam has been released.';
    v_plural_body := ' new mock exams have been released.';
    v_action_url := '/mocks';
    v_action_label := 'View mocks';
    v_released := NEW.is_private = false
      AND NEW.deleted_at IS NULL
      AND (
        TG_OP = 'INSERT'
        OR OLD.is_private = true
        OR OLD.deleted_at IS NOT NULL
      );
  ELSIF TG_TABLE_NAME = 'ucat_learning_modules' THEN
    v_content_type := 'learning';
    v_notification_type := 'ucat.content.learning_released';
    v_title := 'New UCAT learning is available';
    v_body := 'A new learning module has been released.';
    v_plural_body := ' new learning modules have been released.';
    v_action_url := '/learn';
    v_action_label := 'Start learning';
    v_released := NEW.kind = 'lesson'
      AND NEW.is_private = false
      AND NEW.deleted_at IS NULL
      AND (
        TG_OP = 'INSERT'
        OR OLD.kind <> 'lesson'
        OR OLD.is_private = true
        OR OLD.deleted_at IS NOT NULL
      );
  END IF;

  IF NOT v_released THEN
    RETURN NEW;
  END IF;

  v_created_by_staff_id := coalesce(NEW.updated_by, NEW.created_by);

  INSERT INTO public.notifications (
    student_id,
    notification_type,
    app_scope,
    title,
    body,
    action_url,
    metadata,
    dedupe_key,
    priority,
    created_by_staff_id
  )
  SELECT
    s.id,
    v_notification_type,
    'ucat_web',
    v_title,
    v_body,
    v_action_url,
    jsonb_build_object(
      'content_type', v_content_type,
      'release_count', 1,
      'content_ids', jsonb_build_array(NEW.id::text),
      'aggregate_date', v_aggregate_date::text,
      'action_label', v_action_label
    ),
    'ucat:content-release:' || v_content_type || ':' || v_aggregate_date::text || ':' || s.id::text,
    'normal',
    v_created_by_staff_id
  FROM public.students s
  WHERE s.status = 'ACTIVE'
    AND s.user_id IS NOT NULL
    AND (
      s.ucat_signup_completed_at IS NOT NULL
      OR s.ucat_onboarding_completed_at IS NOT NULL
    )
  ON CONFLICT (dedupe_key) DO UPDATE
  SET
    title = EXCLUDED.title,
    body = (
      coalesce((notifications.metadata ->> 'release_count')::integer, 1) + 1
    )::text || v_plural_body,
    action_url = EXCLUDED.action_url,
    metadata = jsonb_build_object(
      'content_type', v_content_type,
      'release_count', coalesce((notifications.metadata ->> 'release_count')::integer, 1) + 1,
      'content_ids', coalesce(notifications.metadata -> 'content_ids', '[]'::jsonb)
        || jsonb_build_array(NEW.id::text),
      'aggregate_date', v_aggregate_date::text,
      'action_label', v_action_label
    ),
    read_at = NULL,
    resolved_at = NULL,
    created_at = now(),
    updated_at = now(),
    created_by_staff_id = EXCLUDED.created_by_staff_id
  WHERE NOT (
    coalesce(notifications.metadata -> 'content_ids', '[]'::jsonb)
      @> jsonb_build_array(NEW.id::text)
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_ucat_public_content_release()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_ucat_question_set_release
  ON public.question_sets;
CREATE TRIGGER notify_ucat_question_set_release
AFTER INSERT OR UPDATE OF is_private, is_student_generated, deleted_at
ON public.question_sets
FOR EACH ROW
EXECUTE FUNCTION public.notify_ucat_public_content_release();

DROP TRIGGER IF EXISTS notify_ucat_mock_release
  ON public.ucat_mocks;
CREATE TRIGGER notify_ucat_mock_release
AFTER INSERT OR UPDATE OF is_private, deleted_at
ON public.ucat_mocks
FOR EACH ROW
EXECUTE FUNCTION public.notify_ucat_public_content_release();

DROP TRIGGER IF EXISTS notify_ucat_learning_release
  ON public.ucat_learning_modules;
CREATE TRIGGER notify_ucat_learning_release
AFTER INSERT OR UPDATE OF kind, is_private, deleted_at
ON public.ucat_learning_modules
FOR EACH ROW
EXECUTE FUNCTION public.notify_ucat_public_content_release();

COMMENT ON FUNCTION public.notify_ucat_public_content_release() IS
  'Aggregates official public UCAT set, mock, and lesson releases into one per-type notification per Adelaide day for active UCAT students.';
