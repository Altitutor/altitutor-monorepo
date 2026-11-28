-- Analytics use released assessments and the station assignment frozen for the round.
CREATE VIEW public.vtutor_interview_statistics WITH (security_barrier = true, security_invoker = false) AS
WITH caller AS MATERIALIZED (
  SELECT (SELECT public.interview_tutor_id((SELECT auth.uid()))) AS id
), eligible_tutors AS MATERIALIZED (
  SELECT st.id, concat_ws(' ', st.first_name, st.last_name) AS name
  FROM caller
  JOIN public.staff st ON public.interview_tutor_id(st.user_id) = st.id
  WHERE caller.id IS NOT NULL
), released AS (
  SELECT DISTINCT ON (r.id, rr.student_id) r.id AS round_id, r.interview_id, r.data,
    rr.student_id, rr.snapshot, concat_ws(' ', student.first_name, student.last_name) AS student_name
  FROM caller
  JOIN public.interview_rounds r ON r.data->>'phase' = 'completed' AND r.data->>'deletedAt' IS NULL
  JOIN public.interview_result_releases rr ON rr.round_id = r.id
  JOIN public.students student ON student.id = rr.student_id
  WHERE caller.id IS NOT NULL AND public.interview_student_has_access(student.id)
    AND rr.revision > coalesce((r.data->'withdrawnResultRevisions'->>student.id::text)::integer, 0)
  ORDER BY r.id, rr.student_id, rr.revision DESC
), attempts AS (
  SELECT released.round_id, released.interview_id, released.student_id, released.student_name,
    station.value->>'stationId' AS bank_station_id, station.value->>'name' AS station_name,
    staff.id AS tutor_id, concat_ws(' ', staff.first_name, staff.last_name) AS tutor_name,
    (mark.value->>'score')::numeric AS score, (station.value->>'maximumPoints')::numeric AS maximum,
    (released.snapshot->>'score')::numeric AS mock_score, (released.snapshot->>'possiblePoints')::numeric AS mock_maximum
  FROM released
  CROSS JOIN LATERAL jsonb_array_elements(released.snapshot->'attempts') mark
  JOIN LATERAL jsonb_array_elements(released.data->'stations') station ON station.value->>'id' = mark.value->>'stationId'
  JOIN LATERAL jsonb_array_elements(released.data->'assignments') assignment ON assignment.value->>'stationId' = mark.value->>'stationId'
  JOIN public.staff staff ON staff.id::text = assignment.value->>'tutorId'
  WHERE mark.value->>'studentId'=released.student_id::text
    AND mark.value->>'notAssessedReason' IS NULL AND jsonb_typeof(mark.value->'score')='number'
    AND (station.value->>'maximumPoints')::numeric > 0
), tutor_attribution AS (
  SELECT tutor.id, tutor.name,
    (SELECT count(DISTINCT attempt.round_id) FROM attempts attempt WHERE attempt.tutor_id=tutor.id) AS interviews,
    (SELECT count(*) FROM public.interview_performance_reviews review WHERE review.author_id=tutor.id
      AND EXISTS (SELECT 1 FROM public.interview_performance_review_releases published WHERE published.review_id=review.id)) AS reviews,
    (SELECT count(DISTINCT se.id)
      FROM public.tutor_logs_staff_attendance attendance
      JOIN public.tutor_logs log ON log.id=attendance.tutor_log_id
      JOIN public.sessions se ON se.id=log.session_id
      JOIN public.subjects subject ON subject.id=se.subject_id
      WHERE attendance.staff_id=tutor.id AND attendance.attended
        AND lower(btrim(subject.name))='medicine interview' AND se.deleted_at IS NULL AND se.status<>'CANCELLED') AS sessions
  FROM eligible_tutors tutor
)
SELECT jsonb_build_object(
  'tutors', coalesce((SELECT jsonb_agg(to_jsonb(tutor) ORDER BY tutor.name, tutor.id) FROM tutor_attribution tutor),'[]'),
  'attempts', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'roundId', a.round_id, 'interviewId', a.interview_id, 'stationId', a.bank_station_id,
    'stationName', a.station_name, 'studentId', a.student_id, 'studentName', a.student_name,
    'tutorId', a.tutor_id, 'tutorName', a.tutor_name, 'score', a.score, 'maximum', a.maximum,
    'mockScore', a.mock_score, 'mockMaximum', a.mock_maximum
  ) ORDER BY a.round_id, a.student_id, a.bank_station_id) FROM attempts a),'[]')
) AS data
FROM caller
WHERE caller.id IS NOT NULL;

REVOKE ALL ON public.vtutor_interview_statistics FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vtutor_interview_statistics TO authenticated;
