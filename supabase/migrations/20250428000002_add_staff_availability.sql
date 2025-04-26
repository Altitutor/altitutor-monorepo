-- Migration: Add availability columns to staff table
-- Description: Adds availability columns for each day of the week to the staff table,
-- mirroring the availability columns in the students table

-- Add availability columns to staff table
ALTER TABLE public.staff
ADD COLUMN availability_monday BOOLEAN DEFAULT false,
ADD COLUMN availability_tuesday BOOLEAN DEFAULT false,
ADD COLUMN availability_wednesday BOOLEAN DEFAULT false,
ADD COLUMN availability_thursday BOOLEAN DEFAULT false,
ADD COLUMN availability_friday BOOLEAN DEFAULT false,
ADD COLUMN availability_saturday_am BOOLEAN DEFAULT false,
ADD COLUMN availability_saturday_pm BOOLEAN DEFAULT false,
ADD COLUMN availability_sunday_am BOOLEAN DEFAULT false,
ADD COLUMN availability_sunday_pm BOOLEAN DEFAULT false;

-- Add comment to explain the purpose of these columns
COMMENT ON COLUMN public.staff.availability_monday IS 'Staff availability on Monday';
COMMENT ON COLUMN public.staff.availability_tuesday IS 'Staff availability on Tuesday';
COMMENT ON COLUMN public.staff.availability_wednesday IS 'Staff availability on Wednesday';
COMMENT ON COLUMN public.staff.availability_thursday IS 'Staff availability on Thursday';
COMMENT ON COLUMN public.staff.availability_friday IS 'Staff availability on Friday';
COMMENT ON COLUMN public.staff.availability_saturday_am IS 'Staff availability on Saturday morning';
COMMENT ON COLUMN public.staff.availability_saturday_pm IS 'Staff availability on Saturday afternoon';
COMMENT ON COLUMN public.staff.availability_sunday_am IS 'Staff availability on Sunday morning';
COMMENT ON COLUMN public.staff.availability_sunday_pm IS 'Staff availability on Sunday afternoon'; 