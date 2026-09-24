-- The service-role answer and management RPCs are SECURITY INVOKER and call
-- this serializer. Grant only the internal caller role access; students and
-- other authenticated clients continue to have no direct execute privilege.
GRANT EXECUTE ON FUNCTION public.flashcard_review_state_json(public.student_flashcard_review_states)
  TO service_role;
