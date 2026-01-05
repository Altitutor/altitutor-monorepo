-- ========================
-- ADD ALPHANUMERIC SENDER SUPPORT
-- ========================
-- This migration adds support for alphanumeric sender IDs (like 'ALTITUTOR')
-- in addition to phone number senders.

-- 1. Add sender_type column to distinguish phone vs alphanumeric
ALTER TABLE public.owned_numbers 
ADD COLUMN IF NOT EXISTS sender_type TEXT CHECK (sender_type IN ('PHONE', 'ALPHANUMERIC')) DEFAULT 'PHONE';

-- 2. Make phone_e164 nullable (alphanumeric senders don't have phone numbers)
ALTER TABLE public.owned_numbers 
ALTER COLUMN phone_e164 DROP NOT NULL;

-- 3. Add alphanumeric_sender_id field to store sender IDs like 'ALTITUTOR'
ALTER TABLE public.owned_numbers
ADD COLUMN IF NOT EXISTS alphanumeric_sender_id TEXT;

-- 4. Add constraint: if sender_type is ALPHANUMERIC, alphanumeric_sender_id must be set
--    if sender_type is PHONE, phone_e164 must be set
ALTER TABLE public.owned_numbers
DROP CONSTRAINT IF EXISTS owned_numbers_sender_check;

ALTER TABLE public.owned_numbers
ADD CONSTRAINT owned_numbers_sender_check 
CHECK (
  (sender_type = 'PHONE' AND phone_e164 IS NOT NULL) OR
  (sender_type = 'ALPHANUMERIC' AND alphanumeric_sender_id IS NOT NULL)
);

-- 5. Update unique constraint - need unique on (phone_e164) OR (alphanumeric_sender_id)
--    Drop existing unique constraint on phone_e164
ALTER TABLE public.owned_numbers
DROP CONSTRAINT IF EXISTS owned_numbers_phone_e164_key;

-- Create partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS owned_numbers_phone_unique 
ON public.owned_numbers(phone_e164) 
WHERE phone_e164 IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS owned_numbers_alphanumeric_unique 
ON public.owned_numbers(alphanumeric_sender_id) 
WHERE alphanumeric_sender_id IS NOT NULL;

-- 6. Update existing records to ensure they have sender_type = 'PHONE'
UPDATE public.owned_numbers
SET sender_type = 'PHONE'
WHERE sender_type IS NULL OR (phone_e164 IS NOT NULL AND sender_type != 'PHONE');

-- 7. Insert ALTITUTOR alphanumeric sender (if not exists)
-- Note: Using DO block to handle conflict check since partial unique index doesn't work directly with ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.owned_numbers 
    WHERE alphanumeric_sender_id = 'ALTITUTOR'
  ) THEN
    INSERT INTO public.owned_numbers (
      phone_e164,
      alphanumeric_sender_id,
      sender_type,
      label,
      is_default
    ) VALUES (
      NULL,
      'ALTITUTOR',
      'ALPHANUMERIC',
      'ALTITUTOR',
      false
    );
  END IF;
END $$;

