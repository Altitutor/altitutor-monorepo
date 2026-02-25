-- ========================
-- UCAT: Add instructions_time_limit_seconds to ucat_sections
-- ========================

ALTER TABLE public.ucat_sections
  ADD COLUMN IF NOT EXISTS instructions_time_limit_seconds INTEGER;

-- vtutor_ucat_sections / vstudent_ucat_sections use SELECT us.* so the new column is included automatically.
