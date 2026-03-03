-- Migration: Add needs_follow_up to conversations
-- Description:
--   When we send an outbound message containing '?', mark conversation as needs_follow_up.
--   When an inbound message arrives, clear needs_follow_up (they replied).
-- Purpose: Help admin staff track conversations awaiting response to questions
-- Author: AI Assistant
-- Date: 2026-03-04

-- Add column
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS needs_follow_up BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.conversations.needs_follow_up IS 'True when last outbound message contains ? and no inbound message exists after it. Cleared when inbound message arrives.';

-- Backfill: compute needs_follow_up for existing conversations
WITH last_question_outbound AS (
  SELECT m.conversation_id, MAX(m.created_at) AS question_at
  FROM public.messages m
  WHERE m.direction = 'OUTBOUND'
    AND m.body LIKE '%?%'
  GROUP BY m.conversation_id
),
has_inbound_after AS (
  SELECT lq.conversation_id
  FROM last_question_outbound lq
  WHERE EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.conversation_id = lq.conversation_id
      AND m.direction = 'INBOUND'
      AND m.created_at > lq.question_at
  )
)
UPDATE public.conversations c
SET needs_follow_up = true
WHERE c.id IN (SELECT conversation_id FROM last_question_outbound)
  AND c.id NOT IN (SELECT conversation_id FROM has_inbound_after);

-- Trigger function
CREATE OR REPLACE FUNCTION public.set_conversations_needs_follow_up()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.direction = 'OUTBOUND' AND NEW.body LIKE '%?%' THEN
    UPDATE public.conversations
    SET needs_follow_up = true
    WHERE id = NEW.conversation_id;
  ELSIF NEW.direction = 'INBOUND' THEN
    UPDATE public.conversations
    SET needs_follow_up = false
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger
DROP TRIGGER IF EXISTS trg_messages_set_needs_follow_up ON public.messages;
CREATE TRIGGER trg_messages_set_needs_follow_up
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_conversations_needs_follow_up();
