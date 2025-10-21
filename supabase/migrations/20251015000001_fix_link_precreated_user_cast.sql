-- Fix: cast raw_user_meta_data invite_token (text) to uuid in linking function

CREATE OR REPLACE FUNCTION public.link_precreated_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Prefer invite token if present in raw_user_meta_data
  IF (NEW.raw_user_meta_data ? 'invite_token') THEN
    UPDATE public.staff s
      SET user_id = NEW.id
      WHERE s.user_id IS NULL
        AND s.invite_token = ((NEW.raw_user_meta_data ->> 'invite_token')::uuid);
    IF FOUND THEN
      RETURN NEW;
    END IF;

    UPDATE public.students st
      SET user_id = NEW.id
      WHERE st.user_id IS NULL
        AND st.invite_token = ((NEW.raw_user_meta_data ->> 'invite_token')::uuid);
    RETURN NEW;
  END IF;

  -- Fallback: link by email address
  UPDATE public.staff s
    SET user_id = NEW.id
    WHERE s.user_id IS NULL
      AND LOWER(s.email) = LOWER(NEW.email);
  IF FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE public.students st
    SET user_id = NEW.id
    WHERE st.user_id IS NULL
      AND LOWER(st.student_email) = LOWER(NEW.email);

  RETURN NEW;
END;$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.link_precreated_user();


