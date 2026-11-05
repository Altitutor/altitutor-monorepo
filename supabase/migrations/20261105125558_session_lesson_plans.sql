-- Shared preparation is distinct from confirmed Tutor logs and private iPad material.
CREATE TABLE public.session_lesson_plans (
  session_id uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES public.staff(id)
);
CREATE INDEX session_lesson_plans_updated_by_idx ON public.session_lesson_plans(updated_by);
CREATE TABLE public.session_lesson_plan_topics (
  session_id uuid NOT NULL REFERENCES public.session_lesson_plans(session_id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, topic_id)
);
CREATE INDEX session_lesson_plan_topics_topic_idx ON public.session_lesson_plan_topics(topic_id);
CREATE TABLE public.session_lesson_plan_files (
  session_id uuid NOT NULL REFERENCES public.session_lesson_plans(session_id) ON DELETE CASCADE,
  topics_file_id uuid NOT NULL REFERENCES public.topics_files(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, topics_file_id)
);
CREATE INDEX session_lesson_plan_files_file_idx ON public.session_lesson_plan_files(topics_file_id);

ALTER TABLE public.session_lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_lesson_plan_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_lesson_plan_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_lesson_plans, public.session_lesson_plan_topics,
  public.session_lesson_plan_files FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_lesson_plans,
  public.session_lesson_plan_topics, public.session_lesson_plan_files TO authenticated, service_role;
CREATE POLICY "ADMINSTAFF manage session lesson plans" ON public.session_lesson_plans
  FOR ALL TO authenticated USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));
CREATE POLICY "ADMINSTAFF manage session lesson plan topics" ON public.session_lesson_plan_topics
  FOR ALL TO authenticated USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));
CREATE POLICY "ADMINSTAFF manage session lesson plan files" ON public.session_lesson_plan_files
  FOR ALL TO authenticated USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- UUID expressions keep these flat API projections out of PostgREST relationship
-- inference; callers select explicit scoped rows, never embedded relationships.
-- Role facades intentionally use definer views: Tutors have no base-table access.
-- The assigned operational-session facade remains the authorization predicate.
CREATE VIEW public.vtutor_session_lesson_plans
WITH (security_invoker = false, security_barrier = true) AS
SELECT session.session_id::text::uuid AS session_id, COALESCE(plan.revision, 0) AS revision, plan.updated_at
FROM public.vtutor_operational_sessions session
LEFT JOIN public.session_lesson_plans plan ON plan.session_id = session.session_id
WHERE session.session_type IN ('CLASS', 'DRAFTING', 'EXAM_COURSE', 'TRIAL_SESSION');

CREATE VIEW public.vtutor_session_lesson_plan_topics
WITH (security_invoker = false, security_barrier = true) AS
SELECT plan.session_id::text::uuid AS session_id, topic.id::text::uuid AS id, topic.name, topic.code, topic.subject_id::text::uuid AS subject_id
FROM public.vtutor_session_lesson_plans plan
JOIN public.session_lesson_plan_topics link ON link.session_id = plan.session_id
JOIN public.topics topic ON topic.id = link.topic_id;

-- Session-scoped catalog metadata is available to co-assigned/substitute Tutors
-- even when their usual catalog subject permissions differ. PDF signing remains
-- in the authenticated API after selecting this exact session/document pair.
CREATE VIEW public.vtutor_session_lesson_plan_documents
WITH (security_invoker = false, security_barrier = true) AS
SELECT plan.session_id::text::uuid AS session_id, worksheet.id::text::uuid AS resource_id,
  topic.id::text::uuid AS topic_id, topic.name AS topic_name,
  subject.id::text::uuid AS subject_id, subject.name AS subject_name,
  document.id::text::uuid AS id, document.code, document.is_solutions_of_id::text::uuid AS is_solutions_of_id,
  file.filename, file.mimetype, file.bucket, file.storage_path, file.external_url
FROM public.vtutor_session_lesson_plans plan
JOIN public.session_lesson_plan_files link ON link.session_id = plan.session_id
JOIN public.topics_files worksheet ON worksheet.id = link.topics_file_id
  AND worksheet.is_solutions_of_id IS NULL AND NOT worksheet.is_solutions
JOIN public.files worksheet_file ON worksheet_file.id = worksheet.file_id AND worksheet_file.deleted_at IS NULL
JOIN public.topics topic ON topic.id = worksheet.topic_id
JOIN public.subjects subject ON subject.id = topic.subject_id
JOIN public.topics_files document ON document.id = worksheet.id OR document.is_solutions_of_id = worksheet.id
JOIN public.files file ON file.id = document.file_id AND file.deleted_at IS NULL;

REVOKE ALL ON public.vtutor_session_lesson_plans, public.vtutor_session_lesson_plan_topics,
  public.vtutor_session_lesson_plan_documents FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.vtutor_session_lesson_plans, public.vtutor_session_lesson_plan_topics,
  public.vtutor_session_lesson_plan_documents TO authenticated, service_role;

-- Service-only command: the API validates selected catalog IDs with the caller's
-- facades. This transaction rechecks staff/session assignment and the future edit
-- window, locks the session to serialize first saves, and rejects stale revisions.
CREATE FUNCTION public.save_session_lesson_plan(
  p_session_id uuid, p_actor_id uuid, p_expected_revision integer,
  p_topic_ids uuid[], p_file_ids uuid[]
) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE
  session_row public.sessions%ROWTYPE;
  current_revision integer;
  topic_ids uuid[];
  file_ids uuid[];
BEGIN
  IF p_expected_revision IS NULL OR p_expected_revision < 0
     OR COALESCE(cardinality(p_topic_ids), 0) > 100
     OR COALESCE(cardinality(p_file_ids), 0) > 50
     OR array_position(p_topic_ids, NULL) IS NOT NULL
     OR array_position(p_file_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'Choose a valid lesson plan.' USING ERRCODE = 'PT400';
  END IF;
  SELECT COALESCE(array_agg(DISTINCT id ORDER BY id), '{}'::uuid[]) INTO topic_ids FROM unnest(p_topic_ids) id;
  SELECT COALESCE(array_agg(DISTINCT id ORDER BY id), '{}'::uuid[]) INTO file_ids FROM unnest(p_file_ids) id;
  SELECT * INTO session_row FROM public.sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR session_row.status <> 'ACTIVE' OR session_row.calendar_tombstone_until IS NOT NULL
     OR session_row.type NOT IN ('CLASS', 'DRAFTING', 'EXAM_COURSE', 'TRIAL_SESSION') THEN
    RAISE EXCEPTION 'This teaching session is unavailable.' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.staff WHERE id = p_actor_id AND status = 'ACTIVE'
    AND role IN ('TUTOR', 'ADMINSTAFF') FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active tutor access required.' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.sessions_staff WHERE session_id = p_session_id AND staff_id = p_actor_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assigned tutor access required.' USING ERRCODE = '42501'; END IF;
  IF session_row.start_at IS NULL OR session_row.start_at <= now() THEN
    RAISE EXCEPTION 'This session has started. Its plan can no longer be changed.' USING ERRCODE = 'PT409';
  END IF;
  SELECT revision INTO current_revision FROM public.session_lesson_plans WHERE session_id = p_session_id FOR UPDATE;
  current_revision := COALESCE(current_revision, 0);
  IF current_revision <> p_expected_revision THEN
    RAISE EXCEPTION 'Another tutor changed this plan. Reload the saved plan before saving.' USING ERRCODE = 'PT409';
  END IF;
  IF (SELECT count(*) FROM public.topics WHERE id = ANY(topic_ids)) <> cardinality(topic_ids)
     OR (SELECT count(*) FROM public.topics_files resource JOIN public.files file ON file.id = resource.file_id
         WHERE resource.id = ANY(file_ids) AND resource.is_solutions_of_id IS NULL
           AND NOT resource.is_solutions AND file.deleted_at IS NULL) <> cardinality(file_ids) THEN
    RAISE EXCEPTION 'A selected topic or resource is no longer available.' USING ERRCODE = 'PT400';
  END IF;
  INSERT INTO public.session_lesson_plans(session_id, revision, updated_by)
  VALUES (p_session_id, current_revision + 1, p_actor_id)
  ON CONFLICT (session_id) DO UPDATE SET revision = EXCLUDED.revision, updated_at = now(), updated_by = EXCLUDED.updated_by;
  DELETE FROM public.session_lesson_plan_topics WHERE session_id = p_session_id AND NOT (topic_id = ANY(topic_ids));
  INSERT INTO public.session_lesson_plan_topics(session_id, topic_id)
    SELECT p_session_id, id FROM unnest(topic_ids) id ON CONFLICT DO NOTHING;
  DELETE FROM public.session_lesson_plan_files WHERE session_id = p_session_id AND NOT (topics_file_id = ANY(file_ids));
  INSERT INTO public.session_lesson_plan_files(session_id, topics_file_id)
    SELECT p_session_id, id FROM unnest(file_ids) id ON CONFLICT DO NOTHING;
  RETURN current_revision + 1;
END;
$function$;
REVOKE ALL ON FUNCTION public.save_session_lesson_plan(uuid, uuid, integer, uuid[], uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_session_lesson_plan(uuid, uuid, integer, uuid[], uuid[]) TO service_role;

-- Authored preparation makes a generated Session non-pristine. The restrictive
-- Session FK also protects a plan if a schedule deletion races with its creation.
DO $migration$
DECLARE definition text;
  anchor text := 'AND NOT EXISTS (SELECT 1 FROM public.sessions_files file WHERE file.session_id = session.id)';
BEGIN
  SELECT pg_get_functiondef('public.is_pristine_generated_class_session(uuid)'::regprocedure) INTO definition;
  IF strpos(definition, anchor) = 0 THEN
    RAISE EXCEPTION 'Pristine Session contract changed; review lesson-plan preservation.';
  END IF;
  EXECUTE replace(definition, anchor, anchor || E'\n      AND NOT EXISTS (SELECT 1 FROM public.session_lesson_plans plan WHERE plan.session_id = session.id)');
END;
$migration$;
COMMENT ON TABLE public.session_lesson_plans IS 'Optional shared preparation for assigned Tutors; distinct from confirmed Tutor logs and tutor-private local teaching material.';
COMMENT ON VIEW public.vtutor_session_lesson_plan_documents IS 'Only documents explicitly planned for assigned operational Sessions; API signing verifies the session/document pair, including solutions.';
