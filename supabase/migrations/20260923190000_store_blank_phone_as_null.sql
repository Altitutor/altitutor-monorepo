-- A blank phone means there is no phone number. Store it as NULL so the
-- E.164 check does not reject an empty string.

CREATE OR REPLACE FUNCTION standardize_student_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.phone IS NULL OR btrim(NEW.phone) = '' THEN
    NEW.phone := NULL;
    RETURN NEW;
  END IF;

  NEW.phone := standardize_phone_e164(NEW.phone);

  IF NOT validate_phone_e164(NEW.phone) THEN
    RAISE EXCEPTION 'Invalid phone number format. Expected E.164 format (e.g., +61412345678), got: %', NEW.phone;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION standardize_staff_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.phone_number IS NULL OR btrim(NEW.phone_number) = '' THEN
    NEW.phone_number := NULL;
    RETURN NEW;
  END IF;

  NEW.phone_number := standardize_phone_e164(NEW.phone_number);

  IF NOT validate_phone_e164(NEW.phone_number) THEN
    RAISE EXCEPTION 'Invalid phone number format. Expected E.164 format (e.g., +61412345678), got: %', NEW.phone_number;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION standardize_parent_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.phone IS NULL OR btrim(NEW.phone) = '' THEN
    NEW.phone := NULL;
    RETURN NEW;
  END IF;

  NEW.phone := standardize_phone_e164(NEW.phone);

  IF NOT validate_phone_e164(NEW.phone) THEN
    RAISE EXCEPTION 'Invalid phone number format. Expected E.164 format (e.g., +61412345678), got: %', NEW.phone;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.standardize_student_phone() SET search_path = public;
ALTER FUNCTION public.standardize_staff_phone() SET search_path = public;
ALTER FUNCTION public.standardize_parent_phone() SET search_path = public;
