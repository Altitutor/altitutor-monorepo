CREATE OR REPLACE FUNCTION public.get_student_ucat_study_plan_forecast_history(
  p_student_id UUID,
  p_today DATE
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH student_context AS (
    SELECT COALESCE(NULLIF(student.timezone, ''), 'Australia/Adelaide') AS timezone
    FROM public.students AS student
    WHERE student.id = p_student_id
  ),
  ranked_generations AS (
    SELECT
      generation.id,
      generation.generated_at,
      generation.superseded_at,
      generation.projection_snapshot,
      ROW_NUMBER() OVER (
        PARTITION BY (generation.generated_at AT TIME ZONE context.timezone)::DATE
        ORDER BY
          (generation.superseded_at IS NULL) DESC,
          generation.generated_at DESC,
          generation.id DESC
      ) AS local_day_rank
    FROM public.ucat_student_study_plan_generations AS generation
    CROSS JOIN student_context AS context
    WHERE generation.student_id = p_student_id
      AND (
        generation.superseded_at IS NULL
        OR generation.generated_at >= (
          (p_today - 63)::TIMESTAMP AT TIME ZONE context.timezone
        )
      )
  ),
  selected_generations AS (
    SELECT
      generation.id,
      generation.generated_at,
      generation.superseded_at,
      generation.projection_snapshot
    FROM ranked_generations AS generation
    WHERE generation.local_day_rank = 1
       OR generation.superseded_at IS NULL
    ORDER BY generation.generated_at DESC, generation.id DESC
    LIMIT 65
  ),
  selected_tasks AS (
    SELECT
      task.generation_id,
      task.status,
      task.scheduled_date,
      task.launch_config
    FROM public.ucat_student_study_plan_tasks AS task
    INNER JOIN selected_generations AS generation
      ON generation.id = task.generation_id
    WHERE task.scheduled_date BETWEEN p_today - 41 AND p_today
    ORDER BY task.scheduled_date DESC, task.generation_id, task.sort_order, task.id
    LIMIT 5000
  )
  SELECT jsonb_build_object(
    'generations', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', generation.id,
            'generated_at', generation.generated_at,
            'superseded_at', generation.superseded_at,
            'projection_snapshot', generation.projection_snapshot
          )
          ORDER BY generation.generated_at DESC, generation.id DESC
        )
        FROM selected_generations AS generation
      ),
      '[]'::JSONB
    ),
    'tasks', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'generation_id', task.generation_id,
            'status', task.status,
            'scheduled_date', task.scheduled_date,
            'launch_config', task.launch_config
          )
          ORDER BY task.scheduled_date DESC, task.generation_id
        )
        FROM selected_tasks AS task
      ),
      '[]'::JSONB
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_student_ucat_study_plan_forecast_history(UUID, DATE)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_student_ucat_study_plan_forecast_history(UUID, DATE)
TO service_role;

COMMENT ON FUNCTION public.get_student_ucat_study_plan_forecast_history(UUID, DATE) IS
  'Returns bounded service-only Study plan forecast history: the active generation and at most one representative generation per Student-local day.';

-- The oversized PostgREST request was persisted as "[object Object]" by the
-- previous worker. Redrive only requests whose recent generation count proves
-- they hit this exact failure shape. The delay protects the migration-first
-- deployment window from an older Vercel worker claiming the request again.
UPDATE public.ucat_student_preparation_refresh_requests AS request
SET
  attempt_count = 0,
  next_attempt_at = clock_timestamp() + INTERVAL '30 minutes',
  dead_lettered_at = NULL,
  last_error = 'redriven_after_bounded_forecast_history_deployment',
  updated_at = clock_timestamp()
WHERE request.dead_lettered_at IS NOT NULL
  AND request.last_error = '[object Object]'
  AND (
    SELECT COUNT(*)
    FROM public.ucat_student_study_plan_generations AS generation
    WHERE generation.student_id = request.student_id
      AND (
        generation.superseded_at IS NULL
        OR generation.generated_at >= clock_timestamp() - INTERVAL '63 days'
      )
  ) > 65;
