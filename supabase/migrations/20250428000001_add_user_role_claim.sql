-- MIGRATION FOR ADDING USER_ROLE CLAIM TO USERS
-- This migration sets the user_role claim for all existing users to 'ADMINSTAFF'

-- ========================
-- CREATE FUNCTION TO SET USER ROLE
-- ========================

-- Create function to set user role claim
CREATE OR REPLACE FUNCTION set_claim(uid uuid, claim text, value jsonb)
RETURNS void AS $$
DECLARE
  user_data json;
BEGIN
  -- Get existing user metadata
  SELECT raw_user_meta_data FROM auth.users WHERE id = uid INTO user_data;
  
  -- Update user_metadata with new claim
  user_data := jsonb_set(
    coalesce(user_data::jsonb, '{}'::jsonb),
    string_to_array(claim, '.'),
    value
  );
  
  -- Update user metadata in auth.users table
  UPDATE auth.users SET raw_user_meta_data = user_data WHERE id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to make user_role mandatory for new users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  IF new.raw_user_meta_data->>'user_role' IS NULL THEN
    RAISE EXCEPTION 'user_role is required';
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to enforce user_role for new users
DROP TRIGGER IF EXISTS enforce_user_role_on_signup ON auth.users;
CREATE TRIGGER enforce_user_role_on_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ========================
-- SET USER_ROLE FOR EXISTING USERS
-- ========================

-- Set user_role claim for all existing users to 'ADMINSTAFF'
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users
  LOOP
    PERFORM set_claim(user_record.id, 'user_role', '"ADMINSTAFF"'::jsonb);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ========================
-- FINALIZE
-- ========================
-- This migration adds the user_role claim to all existing users and makes it mandatory for new users 