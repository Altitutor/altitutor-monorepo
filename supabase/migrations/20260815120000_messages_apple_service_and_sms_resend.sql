-- Persist Apple service on Canonical messages and link SMS resends to the
-- Failed/Ambiguous Mac-bridge row they recover.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS apple_service TEXT
    CHECK (apple_service IS NULL OR apple_service IN ('iMessage', 'SMS'));

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS resent_from_message_id UUID
    REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_resent_from_message_id
  ON public.messages(resent_from_message_id)
  WHERE resent_from_message_id IS NOT NULL;
