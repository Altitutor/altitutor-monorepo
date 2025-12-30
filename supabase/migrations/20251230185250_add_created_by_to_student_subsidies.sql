-- Migration: Add created_by column to student_subsidies for audit purposes
-- Description: Adds created_by UUID column referencing staff(id) to track who created each subsidy

-- ========================
-- ADD created_by COLUMN
-- ========================

ALTER TABLE public.student_subsidies
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.staff(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_student_subsidies_created_by ON public.student_subsidies(created_by);

-- Add comment for documentation
COMMENT ON COLUMN public.student_subsidies.created_by IS 'Staff member who created this subsidy (for audit purposes)';

