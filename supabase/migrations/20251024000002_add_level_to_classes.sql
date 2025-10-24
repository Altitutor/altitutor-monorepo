-- Migration: Add level column to classes table
-- Description: Adds a text field for level to the classes table

ALTER TABLE public.classes
ADD COLUMN level TEXT;

-- Add index for level column to improve query performance
CREATE INDEX IF NOT EXISTS idx_classes_level ON public.classes(level);

-- Add comment to explain the purpose of this column
COMMENT ON COLUMN public.classes.level IS 'Class level - e.g., HL/SL for IB, ADVANCED/STANDARD for PRESACE, etc.';

