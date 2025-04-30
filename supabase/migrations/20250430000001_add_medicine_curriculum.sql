-- Migration: Add MEDICINE to subject_curriculum enum type
-- Description: Adds MEDICINE as a valid value to the subject_curriculum enum type

-- Alter the subject_curriculum enum type to add MEDICINE
ALTER TYPE public.subject_curriculum ADD VALUE IF NOT EXISTS 'MEDICINE';

-- Add comment to explain the update
COMMENT ON TYPE public.subject_curriculum IS 'Subject curriculum types: SACE, IB, PRESACE, PRIMARY, MEDICINE'; 