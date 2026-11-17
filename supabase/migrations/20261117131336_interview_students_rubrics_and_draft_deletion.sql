-- DEV-463: retain actor/release guards and expose marking guidance only in released results.
DO $migration$
DECLARE definition text; previous text;
BEGIN
 SELECT pg_get_functiondef('public.interview_student_round_json(public.interview_rounds,uuid)'::regprocedure) INTO definition;
 previous := $old$p.value - 'rubric' - 'rubricVersion' || jsonb_build_object('rubric',NULL,'rubricVersion',0)$old$;
 IF strpos(definition, previous) = 0 THEN RAISE EXCEPTION 'Unrecognized student result rubric projection'; END IF;
 EXECUTE replace(definition, previous, 'p.value');

 SELECT pg_get_functiondef('public.interview_performance_review_command(uuid,jsonb)'::regprocedure) INTO definition;
 previous := $old$IF kind IS DISTINCT FROM 'createReview' AND (document IS NULL$old$;
 IF strpos(definition, previous) = 0 THEN RAISE EXCEPTION 'Unrecognized review document guard'; END IF;
 definition := replace(definition, previous, $new$IF kind NOT IN ('createReview', 'deleteReview') AND (document IS NULL$new$);
 previous := $old$IF kind = 'createReview' THEN$old$;
 IF strpos(definition, previous) = 0 THEN RAISE EXCEPTION 'Unrecognized review creation guard'; END IF;
 definition := replace(definition, previous, $new$IF kind = 'deleteReview' THEN
    SELECT * INTO review FROM public.interview_performance_reviews WHERE id = target AND author_id = actor FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Only the author can delete this draft.' USING ERRCODE = '42501'; END IF;
    IF review.version IS DISTINCT FROM expected THEN RAISE EXCEPTION 'The review changed. Reload before deleting.' USING ERRCODE = 'PT409'; END IF;
    IF EXISTS (SELECT 1 FROM public.interview_performance_review_releases WHERE review_id = target) THEN
      RAISE EXCEPTION 'Published reviews cannot be deleted.' USING ERRCODE = '22023'; END IF;
    DELETE FROM public.interview_performance_reviews WHERE id = target;
    changed := expected;
  ELSIF kind = 'createReview' THEN
    IF student IS NOT NULL AND NOT public.interview_student_has_access(student) THEN
      RAISE EXCEPTION 'Select a student with active Medicine interview enrolment.' USING ERRCODE = '22023'; END IF;$new$);
 previous := $old$INSERT INTO public.interview_performance_reviews (id, author_id, review_date)
    VALUES (target, actor, dated)$old$;
 IF strpos(definition, previous) = 0 THEN RAISE EXCEPTION 'Unrecognized review insertion'; END IF;
 definition := replace(definition, previous, $new$INSERT INTO public.interview_performance_reviews (id, author_id, review_date, student_id)
    VALUES (target, actor, dated, student)$new$);
 EXECUTE definition;
END;
$migration$;
GRANT DELETE ON public.interview_performance_reviews TO service_role;

-- The existing tutor facade defines the current eligible student population.
-- Keep student information behind this capability-checked view, never base-table reads.
CREATE OR REPLACE VIEW public.vtutor_interview_performance_review_students WITH (security_invoker = false) AS
SELECT s.id::text AS id, concat_ws(' ', s.first_name, s.last_name) AS name,
  jsonb_build_object(
    'classIds', (SELECT coalesce(jsonb_agg(DISTINCT c.id), '[]'::jsonb)
      FROM public.classes_students cs JOIN public.classes c ON c.id = cs.class_id
      JOIN public.subjects sub ON sub.id = c.subject_id
      WHERE cs.student_id = s.id AND cs.enrolled_at <= now() AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at > now())
        AND lower(btrim(sub.name)) = 'medicine interview'),
    'mocks', public.interview_review_mock_history(s.id),
    'sessions', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', se.id, 'name', coalesce(se.long_name, se.short_name, 'Interview session'),
        'startAt', se.start_at, 'attended', attendance.attended) ORDER BY se.start_at DESC), '[]'::jsonb)
      FROM public.sessions se
      JOIN public.subjects sub ON sub.id = se.subject_id
      LEFT JOIN public.tutor_logs tl ON tl.session_id = se.id
      LEFT JOIN public.tutor_logs_student_attendance attendance ON attendance.tutor_log_id = tl.id AND attendance.student_id = s.id
      WHERE se.deleted_at IS NULL AND se.status <> 'CANCELLED' AND lower(btrim(sub.name)) = 'medicine interview'
        AND (attendance.id IS NOT NULL OR EXISTS (SELECT 1 FROM public.sessions_students ss WHERE ss.session_id = se.id AND ss.student_id = s.id)))
  ) AS details
FROM public.students s
WHERE (SELECT public.interview_tutor_id((SELECT auth.uid()))) IS NOT NULL
  AND public.interview_student_has_access(s.id);
