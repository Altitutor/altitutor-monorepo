CREATE TABLE public.interview_performance_review_templates (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  body jsonb NOT NULL CHECK (jsonb_typeof(body) = 'object' AND body->>'type' = 'doc'),
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.interview_performance_reviews (
  id uuid PRIMARY KEY,
  author_id uuid NOT NULL REFERENCES public.staff(id),
  student_id uuid REFERENCES public.students(id),
  review_date date NOT NULL,
  template_name text NOT NULL DEFAULT '' CHECK (length(template_name) <= 160),
  body jsonb NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'
    CHECK (jsonb_typeof(body) = 'object' AND body->>'type' = 'doc'),
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX interview_performance_reviews_author_idx ON public.interview_performance_reviews (author_id);
CREATE INDEX interview_performance_reviews_student_idx ON public.interview_performance_reviews (student_id, review_date DESC);

CREATE TABLE public.interview_performance_review_releases (
  review_id uuid NOT NULL REFERENCES public.interview_performance_reviews(id),
  revision integer NOT NULL CHECK (revision > 0),
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, revision)
);

ALTER TABLE public.interview_performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_performance_review_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_performance_review_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AdminStaff read interview reviews" ON public.interview_performance_reviews
  FOR SELECT TO authenticated USING ((SELECT public.is_adminstaff_active()));
CREATE POLICY "AdminStaff read interview review templates" ON public.interview_performance_review_templates
  FOR SELECT TO authenticated USING ((SELECT public.is_adminstaff_active()));
CREATE POLICY "AdminStaff read interview review releases" ON public.interview_performance_review_releases
  FOR SELECT TO authenticated USING ((SELECT public.is_adminstaff_active()));
REVOKE ALL ON public.interview_performance_reviews, public.interview_performance_review_templates,
  public.interview_performance_review_releases FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.interview_performance_reviews, public.interview_performance_review_templates,
  public.interview_performance_review_releases TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.interview_performance_reviews,
  public.interview_performance_review_templates TO service_role;
GRANT SELECT, INSERT ON public.interview_performance_review_releases TO service_role;

CREATE VIEW public.vtutor_interview_performance_reviews WITH (security_invoker = false) AS
SELECT review.id, review.data,
  (review.data - 'body' - 'published') || jsonb_build_object('published', nullif(review.data->'published', 'null'::jsonb) - 'body' - 'mocks') AS summary
FROM (
SELECT r.id, jsonb_build_object(
  'id', r.id, 'authorId', r.author_id, 'author', concat_ws(' ', t.first_name, t.last_name),
  'studentId', r.student_id, 'student', CASE WHEN s.id IS NOT NULL THEN concat_ws(' ', s.first_name, s.last_name) END,
  'date', CASE WHEN actor.id = r.author_id THEN to_jsonb(r.review_date) ELSE p.snapshot->'date' END,
  'template', CASE WHEN actor.id = r.author_id THEN to_jsonb(r.template_name) ELSE p.snapshot->'template' END,
  'body', CASE WHEN actor.id = r.author_id THEN r.body ELSE p.snapshot->'body' END,
  'version', CASE WHEN actor.id = r.author_id THEN r.version END,
  'published', p.snapshot - 'mocks',
  'editing', actor.id = r.author_id AND (p.revision IS NULL OR r.version <> p.revision)
) AS data
FROM public.interview_performance_reviews r
JOIN public.staff t ON t.id = r.author_id
LEFT JOIN public.students s ON s.id = r.student_id
CROSS JOIN (SELECT public.interview_tutor_id((SELECT auth.uid())) AS id) actor
LEFT JOIN LATERAL (
  SELECT snapshot, revision FROM public.interview_performance_review_releases
  WHERE review_id = r.id ORDER BY revision DESC LIMIT 1
) p ON true
WHERE actor.id IS NOT NULL AND (actor.id = r.author_id OR p.revision IS NOT NULL)
) review;

CREATE VIEW public.vstudent_interview_performance_reviews WITH (security_invoker = false) AS
SELECT r.id, p.snapshot || jsonb_build_object('id', r.id, 'author', concat_ws(' ', t.first_name, t.last_name)) AS data,
  jsonb_build_object('id', r.id, 'date', p.snapshot->'date', 'author', concat_ws(' ', t.first_name, t.last_name)) AS summary
FROM public.interview_performance_reviews r
JOIN public.staff t ON t.id = r.author_id
CROSS JOIN LATERAL (
  SELECT snapshot FROM public.interview_performance_review_releases
  WHERE review_id = r.id ORDER BY revision DESC LIMIT 1
) p
WHERE r.student_id = (SELECT public.current_student_id())
  AND (SELECT public.interview_student_has_access(public.current_student_id()));

CREATE VIEW public.vtutor_interview_performance_review_templates WITH (security_invoker = false) AS
SELECT id, name, body, version FROM public.interview_performance_review_templates
WHERE (SELECT public.interview_tutor_id((SELECT auth.uid()))) IS NOT NULL;

-- The definer facade checks the active tutor capability and the requested
-- student before reading rounds that the tutor did not personally participate in.
CREATE FUNCTION public.interview_review_mock_history(p_student_id uuid, p_review_date date DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH eligible AS (
    SELECT p_student_id AS id
    WHERE (
      current_setting('role', true) = 'service_role'
      OR (p_review_date IS NULL AND (SELECT public.interview_tutor_id((SELECT auth.uid()))) IS NOT NULL)
    ) AND (SELECT public.interview_student_has_access(p_student_id))
  ), rounds AS (
    SELECT r.id, r.data,
      (coalesce((r.data->>'startedAt')::timestamptz, (r.data->>'scheduledAt')::timestamptz,
        (r.data->>'phaseStartedAt')::timestamptz, r.updated_at) AT TIME ZONE 'Australia/Adelaide')::date AS occurred_on,
      released.snapshot
    FROM eligible e
    JOIN public.interview_rounds r ON r.student_ids @> ARRAY[e.id]
    LEFT JOIN LATERAL (
      SELECT snapshot FROM public.interview_result_releases
      WHERE round_id = r.id AND student_id = e.id ORDER BY revision DESC LIMIT 1
    ) released ON true
    WHERE r.data->>'phase' = 'completed' AND (p_review_date IS NULL OR released.snapshot IS NOT NULL)
  ), evidence AS (
    SELECT r.id, r.occurred_on, r.data->>'name' AS title, r.snapshot, station_data.stations,
      station_data.points, station_data.maximum
    FROM rounds r
    CROSS JOIN LATERAL (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', station.value->>'id', 'name', station.value->>'name',
        'score', (mark.value->>'score')::numeric, 'maximumPoints', (station.value->>'maximumPoints')::numeric,
        'notAssessedReason', mark.value->>'notAssessedReason',
        'feedback', mark.value->'generalFeedback',
        'questions', (SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', q.value->>'id', 'title', q.value->'question',
          'feedback', (SELECT entry.value->'value' FROM jsonb_array_elements(mark.value->'feedback') entry
            WHERE entry.value->>'placementId' = q.value->>'id' LIMIT 1)
        ) ORDER BY q.ordinality), '[]'::jsonb)
        FROM jsonb_array_elements(station.value->'questions') WITH ORDINALITY q)
      ) ORDER BY station.ordinality), '[]'::jsonb) AS stations,
      sum((mark.value->>'score')::numeric) AS points,
      sum((station.value->>'maximumPoints')::numeric) FILTER (WHERE mark.value->>'notAssessedReason' IS NULL) AS maximum
      FROM jsonb_array_elements(r.data->'stations') WITH ORDINALITY station
      LEFT JOIN LATERAL (
        SELECT a.value FROM jsonb_array_elements(coalesce(r.snapshot->'attempts', r.data->'attempts')) a
        WHERE a.value->>'studentId' = p_student_id::text AND a.value->>'stationId' = station.value->>'id'
        LIMIT 1
      ) mark ON true
    ) station_data
    WHERE p_review_date IS NULL OR r.occurred_on <= p_review_date
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'date', occurred_on, 'title', title, 'released', snapshot IS NOT NULL,
    'score', coalesce((snapshot->>'score')::numeric, points),
    'maximumPoints', coalesce((snapshot->>'possiblePoints')::numeric, maximum),
    'stations', stations
  ) ORDER BY occurred_on DESC, id), '[]'::jsonb) FROM evidence;
$$;
REVOKE ALL ON FUNCTION public.interview_review_mock_history(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.interview_review_mock_history(uuid, date) TO authenticated, service_role;

CREATE VIEW public.vtutor_interview_performance_review_mocks WITH (security_invoker = false) AS
SELECT s.id::text AS student_id, public.interview_review_mock_history(s.id) AS data
FROM public.students s
WHERE (SELECT public.interview_tutor_id((SELECT auth.uid()))) IS NOT NULL
  AND public.interview_student_has_access(s.id);

REVOKE ALL ON public.vtutor_interview_performance_reviews, public.vstudent_interview_performance_reviews,
  public.vtutor_interview_performance_review_templates, public.vtutor_interview_performance_review_mocks
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vtutor_interview_performance_reviews, public.vstudent_interview_performance_reviews,
  public.vtutor_interview_performance_review_templates, public.vtutor_interview_performance_review_mocks TO authenticated;

CREATE FUNCTION public.interview_performance_review_command(p_actor_user_id uuid, p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  actor uuid := public.interview_tutor_id(p_actor_user_id);
  kind text := p_command->>'type';
  target uuid := (p_command->>'id')::uuid;
  student uuid := (p_command->>'studentId')::uuid;
  dated date := (p_command->>'date')::date;
  expected integer := (p_command->>'expectedVersion')::integer;
  document jsonb := p_command->'body';
  template text := coalesce(p_command->>'template', '');
  review public.interview_performance_reviews%ROWTYPE;
  changed integer;
  operation_id uuid := coalesce((p_command->>'commandId')::uuid, gen_random_uuid());
  payload_hash jsonb := jsonb_build_object('reviewHash', encode(sha256(convert_to(p_command::text, 'UTF8')), 'hex'));
  receipt public.interview_command_receipts%ROWTYPE;
  result jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Active Medicine interview tutor access is required.' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor_user_id::text || operation_id::text, 0));
  SELECT * INTO receipt FROM public.interview_command_receipts
  WHERE actor_user_id = p_actor_user_id AND command_id = operation_id;
  IF FOUND THEN
    IF receipt.command IS DISTINCT FROM payload_hash THEN
      RAISE EXCEPTION 'This command ID was already used with different changes.' USING ERRCODE = 'PT409';
    END IF;
    RETURN receipt.result;
  END IF;
  IF kind IS DISTINCT FROM 'createReview' AND (document IS NULL OR document->>'type' IS DISTINCT FROM 'doc') THEN
    RAISE EXCEPTION 'A rich-text document is required.' USING ERRCODE = '22023';
  END IF;
  IF kind = 'createReview' THEN
    INSERT INTO public.interview_performance_reviews (id, author_id, review_date)
    VALUES (target, actor, dated) ON CONFLICT DO NOTHING;
    SELECT * INTO review FROM public.interview_performance_reviews WHERE id = target AND author_id = actor;
    IF NOT FOUND THEN RAISE EXCEPTION 'Review unavailable.' USING ERRCODE = 'P0002'; END IF;
    changed := review.version;
  ELSIF kind = 'saveTemplate' THEN
    IF expected = 0 THEN
      INSERT INTO public.interview_performance_review_templates (id, name, body)
      VALUES (target, btrim(p_command->>'name'), document) ON CONFLICT DO NOTHING
      RETURNING version INTO changed;
    ELSE
      UPDATE public.interview_performance_review_templates SET name = btrim(p_command->>'name'),
        body = document, version = version + 1, updated_at = now()
      WHERE id = target AND version = expected RETURNING version INTO changed;
    END IF;
    IF changed IS NULL THEN RAISE EXCEPTION 'The template changed. Reload before saving.' USING ERRCODE = 'PT409'; END IF;
  ELSIF kind IN ('saveReview', 'publishReview') THEN
    SELECT * INTO review FROM public.interview_performance_reviews
    WHERE id = target AND author_id = actor FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Only the author can edit this review.' USING ERRCODE = '42501'; END IF;
    IF review.version IS DISTINCT FROM expected THEN
      RAISE EXCEPTION 'The review changed. Reload before saving.' USING ERRCODE = 'PT409';
    END IF;
    IF student IS DISTINCT FROM review.student_id AND EXISTS (
      SELECT 1 FROM public.interview_performance_review_releases WHERE review_id = target
    ) THEN
      RAISE EXCEPTION 'The student cannot change after publication.' USING ERRCODE = '22023';
    END IF;
    IF student IS NOT NULL AND NOT public.interview_student_has_access(student) THEN
      RAISE EXCEPTION 'Select a student with active Medicine interview enrolment.' USING ERRCODE = '22023';
    END IF;
    IF kind = 'publishReview' AND (student IS NULL OR NOT coalesce(jsonb_path_exists(document->'content', '$.** ? (@.type == "text" && @.text like_regex "[^[:space:]]")'), false)) THEN
      RAISE EXCEPTION 'Select a student and enter feedback before publishing.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.interview_performance_reviews
    SET student_id = student, review_date = dated, template_name = template,
      body = document, version = version + 1, updated_at = now()
    WHERE id = target RETURNING version INTO changed;

    IF kind = 'publishReview' THEN
      INSERT INTO public.interview_performance_review_releases (review_id, revision, snapshot)
      VALUES (target, changed, jsonb_build_object(
        'studentId', student, 'date', dated, 'template', template, 'body', document,
        'mocks', public.interview_review_mock_history(student, dated)
      ));
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown review command.' USING ERRCODE = '22023';
  END IF;
  result := jsonb_build_object('id', target, 'version', changed);
  INSERT INTO public.interview_command_receipts (actor_user_id, command_id, command, result)
  VALUES (p_actor_user_id, operation_id, payload_hash, result);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.interview_performance_review_command(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.interview_performance_review_command(uuid, jsonb) TO service_role;

CREATE FUNCTION public.notify_interview_performance_review_release()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.notifications (student_id, app_scope, notification_type, title, body, action_url, dedupe_key)
  VALUES ((NEW.snapshot->>'studentId')::uuid, 'student_web', 'interview_performance_review_released',
    'Your performance review is ready', 'Read your tutor’s feedback and next steps.',
    '/interviews/performance-reviews/' || NEW.review_id || '?revision=' || NEW.revision,
    'interview-review:' || NEW.review_id || ':' || NEW.revision)
  ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE FUNCTION public.notify_interview_mock_result_release()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.notifications (student_id, app_scope, notification_type, title, body, action_url, dedupe_key)
  VALUES (NEW.student_id, 'student_web', 'interview_mock_result_released',
    'Your mock interview results are ready', 'View your scores and feedback.',
    '/interviews/rounds/' || NEW.round_id || '/results',
    'interview-mock:' || NEW.round_id || ':' || NEW.student_id || ':' || NEW.revision)
  ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_interview_performance_review_release(),
  public.notify_interview_mock_result_release() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER interview_performance_review_released AFTER INSERT ON public.interview_performance_review_releases
  FOR EACH ROW EXECUTE FUNCTION public.notify_interview_performance_review_release();
CREATE TRIGGER interview_mock_result_released AFTER INSERT ON public.interview_result_releases
  FOR EACH ROW EXECUTE FUNCTION public.notify_interview_mock_result_release();

CREATE TRIGGER interview_performance_review_release_immutable
  BEFORE UPDATE OR DELETE ON public.interview_performance_review_releases
  FOR EACH ROW EXECUTE FUNCTION public.interview_prevent_release_rewrite();

CREATE VIEW public.vtutor_interview_performance_review_students WITH (security_invoker = false) AS
SELECT s.id::text AS id, concat_ws(' ', s.first_name, s.last_name) AS name
FROM public.students s
WHERE (SELECT public.interview_tutor_id((SELECT auth.uid()))) IS NOT NULL
  AND public.interview_student_has_access(s.id);
REVOKE ALL ON public.vtutor_interview_performance_review_students FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vtutor_interview_performance_review_students TO authenticated;
