-- SQLSTATE 40001 means a genuine serialization failure. PostgREST 14 may
-- automatically replay transactions that return it, so it must not represent
-- an application-level stale revision. Use PostgREST's explicit HTTP 409 code
-- for the three flashcard command functions that predate this correction.
DO $migration$
DECLARE
  v_signature TEXT;
  v_expected_replacements INTEGER;
  v_function REGPROCEDURE;
  v_definition TEXT;
  v_occurrences INTEGER;
BEGIN
  FOR v_signature, v_expected_replacements IN
    SELECT * FROM (VALUES
      ('public.commit_flashcard_review_answer(uuid,uuid,uuid,text,bigint,timestamp with time zone,integer,text,uuid,integer,text,jsonb,jsonb)', 1),
      ('public.undo_latest_flashcard_answer(uuid,uuid,text)', 2),
      ('public.undo_flashcard_answer(uuid,uuid,uuid,text)', 2)
    ) AS command_functions(signature, expected_replacements)
  LOOP
    v_function := to_regprocedure(v_signature);
    IF v_function IS NULL THEN
      RAISE EXCEPTION 'missing_flashcard_command_function:%', v_signature;
    END IF;

    SELECT pg_get_functiondef(v_function::OID) INTO v_definition;
    v_occurrences := (
      length(v_definition) - length(replace(v_definition, '''40001''', ''))
    ) / length('''40001''');
    IF v_occurrences <> v_expected_replacements THEN
      RAISE EXCEPTION 'unexpected_flashcard_conflict_code_count:%:%', v_signature, v_occurrences;
    END IF;

    EXECUTE replace(v_definition, '''40001''', '''PT409''');
  END LOOP;
END;
$migration$;
