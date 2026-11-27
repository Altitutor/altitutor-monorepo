-- Include the stored question score alongside feedback in new review evidence.
CREATE OR REPLACE FUNCTION public.interview_review_mock_history(p_student_id uuid, p_review_date date DEFAULT NULL)
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
      WHERE round_id = r.id AND student_id = e.id
        AND revision > coalesce((r.data->'withdrawnResultRevisions'->>e.id::text)::integer, 0)
      ORDER BY revision DESC LIMIT 1
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
          'feedback', question_feedback.value->'value',
          'score', question_feedback.value->'score'
        ) ORDER BY q.ordinality), '[]'::jsonb)
        FROM jsonb_array_elements(station.value->'questions') WITH ORDINALITY q
        LEFT JOIN LATERAL (
          SELECT entry.value
          FROM jsonb_array_elements(mark.value->'feedback') entry
          WHERE entry.value->>'placementId' = q.value->>'id'
          LIMIT 1
        ) question_feedback ON true)
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
