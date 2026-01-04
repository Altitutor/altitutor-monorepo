-- Migration: Make staff email column optional (nullable)
-- Description:
--  - Remove NOT NULL constraint from staff.email column
--  - Update link_precreated_user() function to handle NULL emails
--  - This allows creating staff members without email addresses

-- ========================
-- 1) Make email column nullable
-- ========================
ALTER TABLE public.staff
  ALTER COLUMN email DROP NOT NULL;

-- ========================
-- 2) Update link_precreated_user function to handle NULL emails
-- ========================
CREATE OR REPLACE FUNCTION public.link_precreated_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Prefer invite token if present in raw_user_meta_data
  IF (NEW.raw_user_meta_data ? 'invite_token') THEN
    UPDATE public.staff s
      SET user_id = NEW.id
      WHERE s.user_id IS NULL
        AND s.invite_token = (NEW.raw_user_meta_data ->> 'invite_token')::uuid;
    IF FOUND THEN
      RETURN NEW;
    END IF;

    UPDATE public.students st
      SET user_id = NEW.id
      WHERE st.user_id IS NULL
        AND st.invite_token = (NEW.raw_user_meta_data ->> 'invite_token')::uuid;
    RETURN NEW;
  END IF;

  -- Fallback: link by email address (only if email is not NULL)
  UPDATE public.staff s
    SET user_id = NEW.id
    WHERE s.user_id IS NULL
      AND s.email IS NOT NULL
      AND LOWER(s.email) = LOWER(NEW.email);
  IF FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE public.students st
    SET user_id = NEW.id
    WHERE st.user_id IS NULL
      AND st.email IS NOT NULL
      AND LOWER(st.email) = LOWER(NEW.email);

  RETURN NEW;
END;$function$;

-- Note: The trigger on_auth_user_created already exists and will automatically use the updated function
