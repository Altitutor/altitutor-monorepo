-- DEV-372. Keep the draft and each immutable published version independent.
ALTER TABLE public.interview_performance_reviews
  ADD COLUMN title text CHECK (length(title) <= 160);
ALTER TABLE public.interview_performance_review_templates
  ADD COLUMN title text CHECK (length(title) <= 160);

CREATE OR REPLACE VIEW public.vtutor_interview_performance_reviews WITH (security_invoker = false) AS
SELECT review.id, review.data,
  (review.data - 'body' - 'published') || jsonb_build_object('published', nullif(review.data->'published', 'null'::jsonb) - 'body' - 'mocks') AS summary
FROM (
SELECT r.id, jsonb_build_object(
  'id', r.id, 'authorId', r.author_id, 'author', concat_ws(' ', t.first_name, t.last_name),
  'studentId', r.student_id, 'student', CASE WHEN s.id IS NOT NULL THEN concat_ws(' ', s.first_name, s.last_name) END,
  'date', CASE WHEN actor.id = r.author_id THEN to_jsonb(r.review_date) ELSE p.snapshot->'date' END,
  'title', CASE WHEN actor.id = r.author_id THEN to_jsonb(r.title) ELSE p.snapshot->'title' END,
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

CREATE OR REPLACE VIEW public.vstudent_interview_performance_reviews WITH (security_invoker = false) AS
SELECT r.id, p.snapshot || jsonb_build_object('id', r.id, 'author', concat_ws(' ', t.first_name, t.last_name)) AS data,
  jsonb_build_object('id', r.id, 'date', p.snapshot->'date', 'title', p.snapshot->'title', 'author', concat_ws(' ', t.first_name, t.last_name)) AS summary
FROM public.interview_performance_reviews r
JOIN public.staff t ON t.id = r.author_id
CROSS JOIN LATERAL (
  SELECT snapshot FROM public.interview_performance_review_releases
  WHERE review_id = r.id ORDER BY revision DESC LIMIT 1
) p
WHERE r.student_id = (SELECT public.current_student_id())
  AND (SELECT public.interview_student_has_access(public.current_student_id()));

CREATE OR REPLACE VIEW public.vtutor_interview_performance_review_templates WITH (security_invoker = false) AS
SELECT id, name, body, version, title FROM public.interview_performance_review_templates
WHERE (SELECT public.interview_tutor_id((SELECT auth.uid()))) IS NOT NULL;

CREATE OR REPLACE FUNCTION public.interview_performance_review_command(p_actor_user_id uuid, p_command jsonb)
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
  review_title text := nullif(btrim(p_command->>'title'), '');
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
      INSERT INTO public.interview_performance_review_templates (id, name, body, title)
      VALUES (target, btrim(p_command->>'name'), document, review_title) ON CONFLICT DO NOTHING
      RETURNING version INTO changed;
    ELSE
      UPDATE public.interview_performance_review_templates SET name = btrim(p_command->>'name'),
        title = CASE WHEN p_command ? 'title' THEN review_title ELSE title END,
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
      title = CASE WHEN p_command ? 'title' THEN review_title ELSE title END,
      body = document, version = version + 1, updated_at = now()
    WHERE id = target RETURNING version, title INTO changed, review_title;

    IF kind = 'publishReview' THEN
      INSERT INTO public.interview_performance_review_releases (review_id, revision, snapshot)
      VALUES (target, changed, jsonb_build_object(
        'studentId', student, 'date', dated, 'template', template, 'title', review_title, 'body', document,
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
