-- Migration: Add area field to topics table
-- Description: Adds an 'area' text field to the topics table

-- Add the area column to topics table
ALTER TABLE public.topics
ADD COLUMN area TEXT;

-- Add comment to explain the purpose of this column
COMMENT ON COLUMN public.topics.area IS 'General area or category within the subject that this topic belongs to'; 