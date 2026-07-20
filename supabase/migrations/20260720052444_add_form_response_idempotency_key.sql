ALTER TABLE public.form_responses
  ADD COLUMN idempotency_key uuid NULL;

CREATE UNIQUE INDEX form_responses_idempotency_key_unique_idx
  ON public.form_responses(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.form_responses.idempotency_key IS
  'Client-generated key used to make form response creation safe to retry.';
