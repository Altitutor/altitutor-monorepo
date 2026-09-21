-- Founder codes are no longer required to start with F-. Lookup, not prefix,
-- distinguishes them from student referral codes.
ALTER TABLE public.ucat_founder_offers
  DROP CONSTRAINT IF EXISTS ucat_founder_offers_code_check;
ALTER TABLE public.ucat_founder_offers
  ADD CONSTRAINT ucat_founder_offers_code_check
  CHECK (code ~ '^[A-Z0-9][A-Z0-9-]{2,41}$');
