-- Expand phone storage from AU-only E.164 to international E.164.
-- Application validates with libphonenumber-js; DB enforces E.164 shape.
-- AU local-format standardization via standardize_au_phone is preserved.

CREATE OR REPLACE FUNCTION validate_phone_e164(phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF phone IS NULL THEN
    RETURN TRUE;
  END IF;

  -- E.164: + then 7–15 digits (first digit 1–9)
  RETURN phone ~ '^\+[1-9][0-9]{6,14}$';
END;
$$;

CREATE OR REPLACE FUNCTION standardize_phone_e164(phone_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned TEXT;
  au_result TEXT;
BEGIN
  IF phone_input IS NULL THEN
    RETURN NULL;
  END IF;

  cleaned := regexp_replace(phone_input, '[^0-9+]', '', 'g');

  IF cleaned ~ '^\+[1-9]' THEN
    RETURN cleaned;
  END IF;

  au_result := standardize_au_phone(phone_input);
  IF au_result IS NOT NULL AND au_result ~ '^\+' THEN
    RETURN au_result;
  END IF;

  RETURN cleaned;
END;
$$;

CREATE OR REPLACE FUNCTION standardize_student_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := standardize_phone_e164(NEW.phone);

    IF NOT validate_phone_e164(NEW.phone) THEN
      RAISE EXCEPTION 'Invalid phone number format. Expected E.164 format (e.g., +61412345678), got: %', NEW.phone;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION standardize_staff_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.phone_number IS NOT NULL THEN
    NEW.phone_number := standardize_phone_e164(NEW.phone_number);

    IF NOT validate_phone_e164(NEW.phone_number) THEN
      RAISE EXCEPTION 'Invalid phone number format. Expected E.164 format (e.g., +61412345678), got: %', NEW.phone_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION standardize_parent_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := standardize_phone_e164(NEW.phone);

    IF NOT validate_phone_e164(NEW.phone) THEN
      RAISE EXCEPTION 'Invalid phone number format. Expected E.164 format (e.g., +61412345678), got: %', NEW.phone;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.standardize_phone_e164(phone_input TEXT) SET search_path = public;
ALTER FUNCTION public.validate_phone_e164(phone TEXT) SET search_path = public;
ALTER FUNCTION public.standardize_student_phone() SET search_path = public;
ALTER FUNCTION public.standardize_staff_phone() SET search_path = public;
ALTER FUNCTION public.standardize_parent_phone() SET search_path = public;
