-- ========================
-- MAKE from_number_e164 NULLABLE FOR ALPHANUMERIC SENDERS
-- ========================
-- This migration makes from_number_e164 nullable in the messages table
-- to support alphanumeric sender IDs (like 'ALTITUTOR') which don't have phone numbers.

-- Make from_number_e164 nullable
ALTER TABLE public.messages 
ALTER COLUMN from_number_e164 DROP NOT NULL;

-- Add a check constraint to ensure either from_number_e164 is set OR
-- the message is from an alphanumeric sender (we'll check this via conversation -> owned_number)
-- Actually, we can't easily check this at the table level since we'd need to join,
-- so we'll rely on application logic to ensure proper values.
-- The constraint is: for OUTBOUND messages, either from_number_e164 must be set (phone sender)
-- or it can be NULL (alphanumeric sender). For INBOUND messages, from_number_e164 should always be set.

-- Note: We're not adding a CHECK constraint here because:
-- 1. For OUTBOUND messages: from_number_e164 can be NULL (alphanumeric) or set (phone)
-- 2. For INBOUND messages: from_number_e164 should always be set (incoming from phone)
-- This logic is better enforced at the application/edge function level.

