-- Scope server-authorized In-person registration to its one Student.
-- Keep existing account-invite and tokenless signup behavior unchanged.
CREATE OR REPLACE FUNCTION public.link_precreated_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Only the registration server sets app metadata after validating the
  -- Student's durable bearer link. Never authorize this from user metadata.
  IF NEW.raw_app_meta_data ? 'registration_student_id' THEN
    UPDATE public.students st
      SET user_id = NEW.id
      WHERE st.id = (NEW.raw_app_meta_data ->> 'registration_student_id')::uuid
        AND st.user_id IS NULL
        AND st.status = 'TRIAL'
        AND LOWER(st.email) = LOWER(NEW.email);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Registration Student is unavailable for account linking'
        USING ERRCODE = '23514';
    END IF;
    -- Do not fall through to email matching, including a matching staff row.
    RETURN NEW;
  END IF;

  -- Auth admin.createUser applies custom app metadata AFTER inserting the user,
  -- inside the same transaction. An untrusted hint can defer opportunistic
  -- matching, but cannot choose or grant access to any Student. The metadata
  -- update trigger below performs the actual server-authorized link.
  IF TG_OP = 'UPDATE' OR NEW.raw_user_meta_data ? 'registration_student_id' THEN
    RETURN NEW;
  END IF;

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

CREATE TRIGGER on_auth_registration_metadata_updated
  AFTER UPDATE OF raw_app_meta_data ON auth.users
  FOR EACH ROW
  WHEN (
    (OLD.raw_app_meta_data -> 'registration_student_id') IS DISTINCT FROM
    (NEW.raw_app_meta_data -> 'registration_student_id')
  )
  EXECUTE FUNCTION public.link_precreated_user();

