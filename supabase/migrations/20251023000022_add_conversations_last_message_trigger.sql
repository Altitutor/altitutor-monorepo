-- Trigger to keep conversations.last_message_at updated when messages are inserted/updated
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = COALESCE(NEW.sent_at, NEW.received_at, NEW.created_at, NOW())
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  BEGIN
    CREATE TRIGGER update_conversations_last_message_at
    AFTER INSERT OR UPDATE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();
  EXCEPTION WHEN others THEN
    NULL; -- ignore if trigger already exists
  END;
END $$;

