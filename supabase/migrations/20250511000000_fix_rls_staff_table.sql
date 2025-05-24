-- Migration: Fix RLS on staff table
-- Description: Enables Row Level Security (RLS) on the staff table to fix security warnings

-- Enable RLS on staff table
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
 
-- Add comment to confirm RLS is enabled
COMMENT ON TABLE public.staff IS 'Staff table with Row Level Security enabled'; 