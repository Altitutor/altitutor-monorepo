BEGIN;
SELECT plan(2);

INSERT INTO public.flashcards (id, topic_id, cloze_text, index)
VALUES
  ('68610000-0000-4000-8000-000000000001', '30000000-0000-0000-0000-000000000001', '{{c1::One}}', 101),
  ('68610000-0000-4000-8000-000000000002', '30000000-0000-0000-0000-000000000001', '{{c1::Two}}', 102),
  ('68610000-0000-4000-8000-000000000003', '30000000-0000-0000-0000-000000000001', '{{c1::Three}}', 103);

CREATE TEMP TABLE flashcard_update_statements (captured BOOLEAN NOT NULL);

CREATE FUNCTION pg_temp.capture_flashcard_update_statement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO flashcard_update_statements VALUES (TRUE);
  RETURN NULL;
END;
$$;

CREATE TRIGGER capture_flashcard_update_statement
AFTER UPDATE ON public.flashcards
FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.capture_flashcard_update_statement();

SELECT public.tutor_reorder_topic_flashcards(
  '30000000-0000-0000-0000-000000000001',
  ARRAY[
    '68610000-0000-4000-8000-000000000003',
    '68610000-0000-4000-8000-000000000001',
    '68610000-0000-4000-8000-000000000002'
  ]::UUID[]
);

SELECT is(
  (
    SELECT array_agg(id ORDER BY index)
    FROM public.flashcards
    WHERE id::TEXT LIKE '68610000-0000-4000-8000-%'
  ),
  ARRAY[
    '68610000-0000-4000-8000-000000000003',
    '68610000-0000-4000-8000-000000000001',
    '68610000-0000-4000-8000-000000000002'
  ]::UUID[],
  'the requested flashcard order is persisted'
);

SELECT is(
  (SELECT count(*)::INTEGER FROM flashcard_update_statements),
  2,
  'reordering uses two set-based update statements regardless of card count'
);

SELECT * FROM finish();
ROLLBACK;
