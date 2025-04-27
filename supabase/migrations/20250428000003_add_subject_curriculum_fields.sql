-- Migration: Add curriculum, discipline, and level fields to subjects table
-- Description: Adds fields for curriculum type, discipline category, and level to the subjects table

-- Add ENUM types for curriculum and discipline
CREATE TYPE public.subject_curriculum AS ENUM ('SACE', 'IB', 'PRESACE', 'PRIMARY');
CREATE TYPE public.subject_discipline AS ENUM ('MATHEMATICS', 'SCIENCE', 'HUMANITIES', 'ENGLISH', 'ART', 'LANGUAGE');

-- Add new columns to subjects table
ALTER TABLE public.subjects
ADD COLUMN curriculum public.subject_curriculum,
ADD COLUMN discipline public.subject_discipline,
ADD COLUMN level TEXT;

-- Add constraints to ensure valid level values for IB and PRESACE subjects
ALTER TABLE public.subjects
ADD CONSTRAINT valid_ib_level CHECK (
    (curriculum != 'IB') OR
    (curriculum = 'IB' AND (level = 'HL' OR level = 'SL'))
);

ALTER TABLE public.subjects
ADD CONSTRAINT valid_presace_level CHECK (
    (curriculum != 'PRESACE') OR
    (curriculum = 'PRESACE' AND (level = 'ADVANCED' OR level = 'STANDARD'))
);

-- Add comments to explain the purpose of these columns
COMMENT ON COLUMN public.subjects.curriculum IS 'Subject curriculum type: SACE, IB, PRESACE, or PRIMARY';
COMMENT ON COLUMN public.subjects.discipline IS 'Subject discipline category: MATHEMATICS, SCIENCE, HUMANITIES, ENGLISH, ART, or LANGUAGE';
COMMENT ON COLUMN public.subjects.level IS 'Subject level - HL/SL for IB, ADVANCED/STANDARD for PRESACE, NULL for SACE/PRIMARY'; 