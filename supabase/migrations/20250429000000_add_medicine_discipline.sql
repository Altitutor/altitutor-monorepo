-- Migration: Add MEDICINE to subject_discipline enum type
-- Description: Adds MEDICINE as a valid value to the subject_discipline enum type

-- Alter the subject_discipline enum type to add MEDICINE
ALTER TYPE public.subject_discipline ADD VALUE IF NOT EXISTS 'MEDICINE';

-- Add comment to explain the update
COMMENT ON TYPE public.subject_discipline IS 'Subject discipline categories: MATHEMATICS, SCIENCE, HUMANITIES, ENGLISH, ART, LANGUAGE, MEDICINE'; 