-- Migration: Fix staff creation permissions
-- Description: This migration updates functions to work with local staff creation

-- Fix auth.is_adminstaff function to look in staff table for current user
CREATE OR REPLACE FUNCTION auth.is_adminstaff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff
    WHERE user_id = auth.uid() AND role = 'ADMINSTAFF'
  );
$$ LANGUAGE sql STABLE;

-- Fix auth.is_tutor function to look in staff table for current user
CREATE OR REPLACE FUNCTION auth.is_tutor()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff
    WHERE user_id = auth.uid() AND role = 'TUTOR'
  );
$$ LANGUAGE sql STABLE;

-- Fix auth.is_staff function to look in staff table for current user
CREATE OR REPLACE FUNCTION auth.is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff
    WHERE user_id = auth.uid() AND (role = 'ADMINSTAFF' OR role = 'TUTOR')
  );
$$ LANGUAGE sql STABLE;

-- Drop the trigger that enforces user_role on signup
DROP TRIGGER IF EXISTS enforce_user_role_on_signup ON auth.users; 