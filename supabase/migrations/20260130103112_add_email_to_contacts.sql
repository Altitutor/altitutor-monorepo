-- ========================
-- ADD EMAIL SUPPORT TO CONTACTS
-- ========================
-- This migration adds email field to contacts for iMessage email matching.

-- Add email field to contacts (for iMessage email matching)
ALTER TABLE public.contacts
ADD COLUMN email TEXT;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email) WHERE email IS NOT NULL;

-- Note: phone_e164 unique constraint remains, but email can be NULL
-- We'll match contacts by phone OR email in application logic
