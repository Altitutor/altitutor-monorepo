-- A Study plan set launch starts from a planned task. The existing AFTER INSERT
-- activation trigger transitions that task to in_progress atomically, so the
-- timing snapshot created by the earlier BEFORE INSERT trigger must accept the
-- same pre-activation state.
CREATE OR REPLACE FUNCTION public.ucat_set_attempt_snapshot_and_speed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_time_limit INTEGER;
  v_exam_time INTEGER;
  v_default_mode public.ucat_question_set_timing_mode;
  v_default_pace NUMERIC;
  v_task_pace NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_exam_time := public.ucat_question_set_exam_time_seconds(NEW.question_set_id);

    IF NEW.study_plan_task_id IS NOT NULL THEN
      IF NEW.student_ucat_mock_attempt_id IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Mock set timing cannot be prescribed by a Study plan task';
      END IF;

      SELECT CASE
        WHEN jsonb_typeof(task.launch_config -> 'prescribedPace') = 'number'
          THEN (task.launch_config ->> 'prescribedPace')::NUMERIC
        ELSE NULL
      END
      INTO v_task_pace
      FROM public.ucat_student_study_plan_tasks task
      WHERE task.id = NEW.study_plan_task_id
        AND task.student_id = NEW.student_id
        AND task.question_set_id = NEW.question_set_id
        AND task.task_type = 'section_benchmark'
        AND task.status IN ('planned', 'in_progress', 'partial')
        AND task.launch_config ->> 'kind' = 'set';

      IF v_task_pace IS NULL OR v_task_pace < 0.5 OR v_task_pace > 1 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid Study plan set pace prescription';
      END IF;
      IF v_exam_time IS NULL OR v_exam_time <= 0 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Question set has no exam-time reference';
      END IF;

      v_time_limit := CEIL(v_exam_time::NUMERIC / v_task_pace)::INTEGER;
      NEW.effective_timing_mode := 'pace';
      NEW.effective_pace_multiplier := v_task_pace;
      NEW.timing_source := 'study_plan';
      NEW.was_timed := TRUE;
    ELSE
      SELECT question_set.timing_mode, question_set.pace_multiplier
      INTO v_default_mode, v_default_pace
      FROM public.question_sets question_set
      WHERE question_set.id = NEW.question_set_id;

      v_time_limit := public.ucat_question_set_time_limit_seconds(NEW.question_set_id);
      IF NEW.student_ucat_mock_attempt_id IS NOT NULL THEN
        NEW.effective_timing_mode := 'pace';
        NEW.effective_pace_multiplier := 1;
        NEW.timing_source := 'mock_blueprint';
      ELSE
        NEW.effective_timing_mode := v_default_mode;
        NEW.effective_pace_multiplier := CASE WHEN v_default_mode = 'pace' THEN v_default_pace ELSE NULL END;
        NEW.timing_source := 'set_default';
      END IF;
      NEW.was_timed := v_time_limit IS NOT NULL AND v_time_limit > 0;
    END IF;

    NEW.set_time_limit_seconds := v_time_limit;
    NEW.set_time_limit_at_exam_speed_seconds := v_exam_time;
    NEW.set_speed := CASE WHEN v_time_limit > 0 AND v_exam_time > 0
      THEN v_exam_time::NUMERIC / v_time_limit ELSE NULL END;

    IF NEW.engine_snapshot IS NOT NULL AND NEW.study_plan_task_id IS NOT NULL THEN
      NEW.engine_snapshot := jsonb_set(
        NEW.engine_snapshot,
        '{examTiming}',
        COALESCE(NEW.engine_snapshot -> 'examTiming', '{}'::JSONB)
          || jsonb_build_object(
            'setModeTiming',
            COALESCE(NEW.engine_snapshot #> '{examTiming,setModeTiming}', '{}'::JSONB)
              || jsonb_build_object('setTimeLimitSeconds', v_time_limit)
          ),
        TRUE
      );
    END IF;
  END IF;

  IF NEW.time_taken_seconds IS NOT NULL AND NEW.time_taken_seconds > 0 THEN
    IF NEW.student_set_speed IS NULL AND NEW.set_time_limit_seconds > 0 THEN
      NEW.student_set_speed := NEW.set_time_limit_seconds::NUMERIC / NEW.time_taken_seconds;
    END IF;
    IF NEW.student_exam_speed IS NULL AND NEW.set_time_limit_at_exam_speed_seconds > 0 THEN
      NEW.student_exam_speed := NEW.set_time_limit_at_exam_speed_seconds / NEW.time_taken_seconds;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
