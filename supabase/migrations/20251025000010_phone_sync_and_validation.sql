-- This migration handles syncing contacts with students/staff/parents phone numbers
-- AND enforces E.164 format

-- ============================================================================
-- PART 1: Phone Number Standardization Function
-- ============================================================================

-- Function to standardize Australian phone numbers to E.164 format
CREATE OR REPLACE FUNCTION standardize_au_phone(phone_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned TEXT;
BEGIN
  IF phone_input IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Remove all spaces, hyphens, parentheses
  cleaned := regexp_replace(phone_input, '[^0-9+]', '', 'g');
  
  -- Handle different Australian number formats
  IF cleaned ~ '^\+61[1-9][0-9]{8}$' THEN
    -- Already in correct E.164 format: +61XXXXXXXXX (no leading 0)
    RETURN cleaned;
  ELSIF cleaned ~ '^\+610[1-9][0-9]{8}$' THEN
    -- E.164 with erroneous leading 0: +610XXXXXXXXX -> +61XXXXXXXXX
    RETURN '+61' || substring(cleaned from 5);
  ELSIF cleaned ~ '^61[1-9][0-9]{8}$' THEN
    -- Missing + prefix: 61XXXXXXXXX -> +61XXXXXXXXX
    RETURN '+' || cleaned;
  ELSIF cleaned ~ '^610[1-9][0-9]{8}$' THEN
    -- Missing + and has leading 0: 610XXXXXXXXX -> +61XXXXXXXXX
    RETURN '+61' || substring(cleaned from 4);
  ELSIF cleaned ~ '^0[1-9][0-9]{8}$' THEN
    -- Australian format with leading 0: 0XXXXXXXXX -> +61XXXXXXXXX
    RETURN '+61' || substring(cleaned from 2);
  ELSIF cleaned ~ '^[1-9][0-9]{8}$' THEN
    -- No prefix, no leading 0: XXXXXXXXX -> +61XXXXXXXXX
    RETURN '+61' || cleaned;
  ELSE
    -- Invalid format, return original
    RETURN phone_input;
  END IF;
END;
$$;

-- ============================================================================
-- PART 2: Phone Number Validation Function
-- ============================================================================

-- Function to validate E.164 format
CREATE OR REPLACE FUNCTION validate_phone_e164(phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF phone IS NULL THEN
    RETURN TRUE; -- NULL is valid
  END IF;
  
  -- Check if phone matches E.164 format: +[country code][number]
  -- For Australian numbers: +61XXXXXXXXX (10 digits after +61)
  RETURN phone ~ '^\+61[1-9][0-9]{8}$';
END;
$$;

-- ============================================================================
-- PART 3: Add Phone Validation Constraints
-- ============================================================================

-- Add check constraints to ensure E.164 format
ALTER TABLE public.students
DROP CONSTRAINT IF EXISTS students_phone_e164_check;

ALTER TABLE public.students
ADD CONSTRAINT students_phone_e164_check
CHECK (validate_phone_e164(phone));

ALTER TABLE public.staff
DROP CONSTRAINT IF EXISTS staff_phone_e164_check;

ALTER TABLE public.staff
ADD CONSTRAINT staff_phone_e164_check
CHECK (validate_phone_e164(phone_number));

ALTER TABLE public.parents
DROP CONSTRAINT IF EXISTS parents_phone_e164_check;

ALTER TABLE public.parents
ADD CONSTRAINT parents_phone_e164_check
CHECK (validate_phone_e164(phone));

-- ============================================================================
-- PART 4: Remove display_name from contacts
-- ============================================================================

-- Remove display_name column since we'll rely on joins to get names
ALTER TABLE public.contacts
DROP COLUMN IF EXISTS display_name;

-- ============================================================================
-- PART 5: BEFORE Trigger Functions (Standardization)
-- ============================================================================

-- BEFORE trigger: Standardize and validate phone for students
CREATE OR REPLACE FUNCTION standardize_student_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := standardize_au_phone(NEW.phone);
    
    -- Validate the standardized phone
    IF NOT validate_phone_e164(NEW.phone) THEN
      RAISE EXCEPTION 'Invalid phone number format. Expected E.164 format (e.g., +61XXXXXXXXX), got: %', NEW.phone;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- BEFORE trigger: Standardize and validate phone for staff
CREATE OR REPLACE FUNCTION standardize_staff_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.phone_number IS NOT NULL THEN
    NEW.phone_number := standardize_au_phone(NEW.phone_number);
    
    -- Validate the standardized phone
    IF NOT validate_phone_e164(NEW.phone_number) THEN
      RAISE EXCEPTION 'Invalid phone number format. Expected E.164 format (e.g., +61XXXXXXXXX), got: %', NEW.phone_number;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- BEFORE trigger: Standardize and validate phone for parents
CREATE OR REPLACE FUNCTION standardize_parent_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := standardize_au_phone(NEW.phone);
    
    -- Validate the standardized phone
    IF NOT validate_phone_e164(NEW.phone) THEN
      RAISE EXCEPTION 'Invalid phone number format. Expected E.164 format (e.g., +61XXXXXXXXX), got: %', NEW.phone;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- PART 6: AFTER Trigger Functions (Contact Sync)
-- ============================================================================

-- AFTER trigger: Sync student phone to contacts
CREATE OR REPLACE FUNCTION sync_student_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_contact_id UUID;
  conflict_student_id UUID;
  conflict_staff_id UUID;
  conflict_parent_id UUID;
BEGIN
  -- On UPDATE: If phone changed, orphan the old contact
  IF TG_OP = 'UPDATE' AND OLD.phone IS DISTINCT FROM NEW.phone THEN
    UPDATE public.contacts
    SET student_id = NULL,
        contact_type = CASE 
          WHEN staff_id IS NOT NULL THEN 'STAFF'
          WHEN parent_id IS NOT NULL THEN 'PARENT'
          ELSE 'LEAD'
        END
    WHERE student_id = OLD.id;
  END IF;

  -- If new phone is NULL, we're done
  IF NEW.phone IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if this phone is already linked to a different person
  SELECT student_id, staff_id, parent_id, id
  INTO conflict_student_id, conflict_staff_id, conflict_parent_id, existing_contact_id
  FROM public.contacts
  WHERE phone_e164 = NEW.phone;

  -- If contact exists, check for conflicts
  IF existing_contact_id IS NOT NULL THEN
    -- Check if phone is already used by another student
    IF conflict_student_id IS NOT NULL AND conflict_student_id != NEW.id THEN
      RAISE EXCEPTION 'Phone number % is already associated with another student (ID: %)', NEW.phone, conflict_student_id;
    END IF;
    
    -- Check if phone is already used by a staff member
    IF conflict_staff_id IS NOT NULL THEN
      RAISE EXCEPTION 'Phone number % is already associated with a staff member (ID: %)', NEW.phone, conflict_staff_id;
    END IF;
    
    -- Check if phone is already used by a parent
    IF conflict_parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Phone number % is already associated with a parent (ID: %)', NEW.phone, conflict_parent_id;
    END IF;

    -- No conflict, update the contact
    UPDATE public.contacts
    SET student_id = NEW.id,
        contact_type = 'STUDENT'
    WHERE id = existing_contact_id;
  ELSE
    -- Create new contact with ON CONFLICT handling for race conditions
    INSERT INTO public.contacts (phone_e164, student_id, contact_type)
    VALUES (NEW.phone, NEW.id, 'STUDENT')
    ON CONFLICT (phone_e164) DO UPDATE
    SET student_id = EXCLUDED.student_id,
        contact_type = EXCLUDED.contact_type
    WHERE contacts.student_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- AFTER trigger: Sync staff phone to contacts
CREATE OR REPLACE FUNCTION sync_staff_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_contact_id UUID;
  conflict_student_id UUID;
  conflict_staff_id UUID;
  conflict_parent_id UUID;
BEGIN
  -- On UPDATE: If phone changed, orphan the old contact
  IF TG_OP = 'UPDATE' AND OLD.phone_number IS DISTINCT FROM NEW.phone_number THEN
    UPDATE public.contacts
    SET staff_id = NULL,
        contact_type = CASE 
          WHEN student_id IS NOT NULL THEN 'STUDENT'
          WHEN parent_id IS NOT NULL THEN 'PARENT'
          ELSE 'LEAD'
        END
    WHERE staff_id = OLD.id;
  END IF;

  -- If new phone is NULL, we're done
  IF NEW.phone_number IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if this phone is already linked to a different person
  SELECT student_id, staff_id, parent_id, id
  INTO conflict_student_id, conflict_staff_id, conflict_parent_id, existing_contact_id
  FROM public.contacts
  WHERE phone_e164 = NEW.phone_number;

  -- If contact exists, check for conflicts
  IF existing_contact_id IS NOT NULL THEN
    -- Check if phone is already used by a student
    IF conflict_student_id IS NOT NULL THEN
      RAISE EXCEPTION 'Phone number % is already associated with a student (ID: %)', NEW.phone_number, conflict_student_id;
    END IF;
    
    -- Check if phone is already used by another staff member
    IF conflict_staff_id IS NOT NULL AND conflict_staff_id != NEW.id THEN
      RAISE EXCEPTION 'Phone number % is already associated with another staff member (ID: %)', NEW.phone_number, conflict_staff_id;
    END IF;
    
    -- Check if phone is already used by a parent
    IF conflict_parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Phone number % is already associated with a parent (ID: %)', NEW.phone_number, conflict_parent_id;
    END IF;

    -- No conflict, update the contact
    UPDATE public.contacts
    SET staff_id = NEW.id,
        contact_type = 'STAFF'
    WHERE id = existing_contact_id;
  ELSE
    -- Create new contact with ON CONFLICT handling for race conditions
    INSERT INTO public.contacts (phone_e164, staff_id, contact_type)
    VALUES (NEW.phone_number, NEW.id, 'STAFF')
    ON CONFLICT (phone_e164) DO UPDATE
    SET staff_id = EXCLUDED.staff_id,
        contact_type = EXCLUDED.contact_type
    WHERE contacts.staff_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- AFTER trigger: Sync parent phone to contacts
CREATE OR REPLACE FUNCTION sync_parent_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_contact_id UUID;
  conflict_student_id UUID;
  conflict_staff_id UUID;
  conflict_parent_id UUID;
BEGIN
  -- On UPDATE: If phone changed, orphan the old contact
  IF TG_OP = 'UPDATE' AND OLD.phone IS DISTINCT FROM NEW.phone THEN
    UPDATE public.contacts
    SET parent_id = NULL,
        contact_type = CASE 
          WHEN student_id IS NOT NULL THEN 'STUDENT'
          WHEN staff_id IS NOT NULL THEN 'STAFF'
          ELSE 'LEAD'
        END
    WHERE parent_id = OLD.id;
  END IF;

  -- If new phone is NULL, we're done
  IF NEW.phone IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if this phone is already linked to a different person
  SELECT student_id, staff_id, parent_id, id
  INTO conflict_student_id, conflict_staff_id, conflict_parent_id, existing_contact_id
  FROM public.contacts
  WHERE phone_e164 = NEW.phone;

  -- If contact exists, check for conflicts
  IF existing_contact_id IS NOT NULL THEN
    -- Check if phone is already used by a student
    IF conflict_student_id IS NOT NULL THEN
      RAISE EXCEPTION 'Phone number % is already associated with a student (ID: %)', NEW.phone, conflict_student_id;
    END IF;
    
    -- Check if phone is already used by a staff member
    IF conflict_staff_id IS NOT NULL THEN
      RAISE EXCEPTION 'Phone number % is already associated with a staff member (ID: %)', NEW.phone, conflict_staff_id;
    END IF;
    
    -- Check if phone is already used by another parent
    IF conflict_parent_id IS NOT NULL AND conflict_parent_id != NEW.id THEN
      RAISE EXCEPTION 'Phone number % is already associated with another parent (ID: %)', NEW.phone, conflict_parent_id;
    END IF;

    -- No conflict, update the contact
    UPDATE public.contacts
    SET parent_id = NEW.id,
        contact_type = 'PARENT'
    WHERE id = existing_contact_id;
  ELSE
    -- Create new contact with ON CONFLICT handling for race conditions
    INSERT INTO public.contacts (phone_e164, parent_id, contact_type)
    VALUES (NEW.phone, NEW.id, 'PARENT')
    ON CONFLICT (phone_e164) DO UPDATE
    SET parent_id = EXCLUDED.parent_id,
        contact_type = EXCLUDED.contact_type
    WHERE contacts.parent_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- PART 7: Orphan Trigger Functions (on DELETE)
-- ============================================================================

-- Orphan contact when student is deleted
CREATE OR REPLACE FUNCTION orphan_contact_on_student_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.contacts
  SET student_id = NULL,
      contact_type = CASE 
        WHEN staff_id IS NOT NULL THEN 'STAFF'
        WHEN parent_id IS NOT NULL THEN 'PARENT'
        ELSE 'LEAD'
      END
  WHERE student_id = OLD.id;
  
  RETURN OLD;
END;
$$;

-- Orphan contact when staff is deleted
CREATE OR REPLACE FUNCTION orphan_contact_on_staff_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.contacts
  SET staff_id = NULL,
      contact_type = CASE 
        WHEN student_id IS NOT NULL THEN 'STUDENT'
        WHEN parent_id IS NOT NULL THEN 'PARENT'
        ELSE 'LEAD'
      END
  WHERE staff_id = OLD.id;
  
  RETURN OLD;
END;
$$;

-- Orphan contact when parent is deleted
CREATE OR REPLACE FUNCTION orphan_contact_on_parent_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.contacts
  SET parent_id = NULL,
      contact_type = CASE 
        WHEN student_id IS NOT NULL THEN 'STUDENT'
        WHEN staff_id IS NOT NULL THEN 'STAFF'
        ELSE 'LEAD'
      END
  WHERE parent_id = OLD.id;
  
  RETURN OLD;
END;
$$;

-- ============================================================================
-- PART 8: Create Triggers
-- ============================================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS standardize_student_phone_trigger ON public.students;
DROP TRIGGER IF EXISTS standardize_staff_phone_trigger ON public.staff;
DROP TRIGGER IF EXISTS standardize_parent_phone_trigger ON public.parents;
DROP TRIGGER IF EXISTS sync_student_contact_trigger ON public.students;
DROP TRIGGER IF EXISTS sync_staff_contact_trigger ON public.staff;
DROP TRIGGER IF EXISTS sync_parent_contact_trigger ON public.parents;
DROP TRIGGER IF EXISTS orphan_student_contact_trigger ON public.students;
DROP TRIGGER IF EXISTS orphan_staff_contact_trigger ON public.staff;
DROP TRIGGER IF EXISTS orphan_parent_contact_trigger ON public.parents;

-- Create BEFORE triggers for phone standardization
CREATE TRIGGER standardize_student_phone_trigger
  BEFORE INSERT OR UPDATE OF phone ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION standardize_student_phone();

CREATE TRIGGER standardize_staff_phone_trigger
  BEFORE INSERT OR UPDATE OF phone_number ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION standardize_staff_phone();

CREATE TRIGGER standardize_parent_phone_trigger
  BEFORE INSERT OR UPDATE OF phone ON public.parents
  FOR EACH ROW
  EXECUTE FUNCTION standardize_parent_phone();

-- Create AFTER triggers for contact sync
CREATE TRIGGER sync_student_contact_trigger
  AFTER INSERT OR UPDATE OF phone ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION sync_student_contact();

CREATE TRIGGER sync_staff_contact_trigger
  AFTER INSERT OR UPDATE OF phone_number ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION sync_staff_contact();

CREATE TRIGGER sync_parent_contact_trigger
  AFTER INSERT OR UPDATE OF phone ON public.parents
  FOR EACH ROW
  EXECUTE FUNCTION sync_parent_contact();

-- Create BEFORE DELETE triggers for orphaning
CREATE TRIGGER orphan_student_contact_trigger
  BEFORE DELETE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION orphan_contact_on_student_delete();

CREATE TRIGGER orphan_staff_contact_trigger
  BEFORE DELETE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION orphan_contact_on_staff_delete();

CREATE TRIGGER orphan_parent_contact_trigger
  BEFORE DELETE ON public.parents
  FOR EACH ROW
  EXECUTE FUNCTION orphan_contact_on_parent_delete();

-- ============================================================================
-- PART 9: Backfill Existing Data
-- ============================================================================

-- Temporarily disable triggers for bulk update
ALTER TABLE public.students DISABLE TRIGGER standardize_student_phone_trigger;
ALTER TABLE public.students DISABLE TRIGGER sync_student_contact_trigger;
ALTER TABLE public.staff DISABLE TRIGGER standardize_staff_phone_trigger;
ALTER TABLE public.staff DISABLE TRIGGER sync_staff_contact_trigger;
ALTER TABLE public.parents DISABLE TRIGGER standardize_parent_phone_trigger;
ALTER TABLE public.parents DISABLE TRIGGER sync_parent_contact_trigger;

-- Standardize existing phone numbers
UPDATE public.students
SET phone = standardize_au_phone(phone)
WHERE phone IS NOT NULL;

UPDATE public.staff
SET phone_number = standardize_au_phone(phone_number)
WHERE phone_number IS NOT NULL;

UPDATE public.parents
SET phone = standardize_au_phone(phone)
WHERE phone IS NOT NULL;

-- Re-enable triggers
ALTER TABLE public.students ENABLE TRIGGER standardize_student_phone_trigger;
ALTER TABLE public.students ENABLE TRIGGER sync_student_contact_trigger;
ALTER TABLE public.staff ENABLE TRIGGER standardize_staff_phone_trigger;
ALTER TABLE public.staff ENABLE TRIGGER sync_staff_contact_trigger;
ALTER TABLE public.parents ENABLE TRIGGER standardize_parent_phone_trigger;
ALTER TABLE public.parents ENABLE TRIGGER sync_parent_contact_trigger;

-- Now create/link contacts for all existing phone numbers
-- Link students
INSERT INTO public.contacts (phone_e164, student_id, contact_type)
SELECT 
  s.phone,
  s.id,
  'STUDENT'
FROM public.students s
WHERE s.phone IS NOT NULL
ON CONFLICT (phone_e164) DO UPDATE
SET student_id = EXCLUDED.student_id,
    contact_type = EXCLUDED.contact_type
WHERE contacts.student_id IS NULL; -- Only update if not already linked

-- Link staff
INSERT INTO public.contacts (phone_e164, staff_id, contact_type)
SELECT 
  s.phone_number,
  s.id,
  'STAFF'
FROM public.staff s
WHERE s.phone_number IS NOT NULL
ON CONFLICT (phone_e164) DO UPDATE
SET staff_id = EXCLUDED.staff_id,
    contact_type = EXCLUDED.contact_type
WHERE contacts.staff_id IS NULL; -- Only update if not already linked

-- Link parents
INSERT INTO public.contacts (phone_e164, parent_id, contact_type)
SELECT 
  p.phone,
  p.id,
  'PARENT'
FROM public.parents p
WHERE p.phone IS NOT NULL
ON CONFLICT (phone_e164) DO UPDATE
SET parent_id = EXCLUDED.parent_id,
    contact_type = EXCLUDED.contact_type
WHERE contacts.parent_id IS NULL; -- Only update if not already linked
