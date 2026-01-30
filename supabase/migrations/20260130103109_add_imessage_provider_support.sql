-- ========================
-- ADD IMESSAGE PROVIDER SUPPORT
-- ========================
-- This migration adds provider support to owned_numbers to distinguish
-- between Twilio and iMessage numbers, and adds iMessage-specific fields.

-- 1. Add provider column (TWILIO or IMESSAGE)
ALTER TABLE public.owned_numbers 
ADD COLUMN provider TEXT CHECK (provider IN ('TWILIO', 'IMESSAGE')) DEFAULT 'TWILIO';

-- 2. Add iMessage-specific fields
ALTER TABLE public.owned_numbers
ADD COLUMN imessage_chat_id TEXT; -- For group chats, stores the chatId from iMessage bridge

-- 3. Add API configuration for iMessage bridge
ALTER TABLE public.owned_numbers
ADD COLUMN imessage_api_key TEXT; -- Optional: per-number API key override

-- 4. Update existing records to be TWILIO
UPDATE public.owned_numbers SET provider = 'TWILIO' WHERE provider IS NULL;

-- 5. Insert iMessage number (+61483849842) if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.owned_numbers 
    WHERE phone_e164 = '+61483849842'
  ) THEN
    INSERT INTO public.owned_numbers (
      phone_e164, 
      provider, 
      label, 
      is_default
    ) VALUES (
      '+61483849842',
      'IMESSAGE',
      'iMessage Number',
      false
    );
  ELSE
    -- Update existing record
    UPDATE public.owned_numbers
    SET provider = 'IMESSAGE',
        label = COALESCE(label, 'iMessage Number')
    WHERE phone_e164 = '+61483849842';
  END IF;
END $$;
