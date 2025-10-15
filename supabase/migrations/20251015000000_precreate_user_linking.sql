-- Pre-create staff/students with nullable FK to auth.users
-- - Allow pre-created rows by dropping NOT NULL on user_id
-- - Add invite_token columns for robust linking
-- - Add FKs to auth.users(id) with ON DELETE CASCADE
-- - Add partial-unique indexes on user_id and active-state
-- - Create trigger to auto-link precreated rows on auth.users insert
-- - Create triggers to prevent dual active roles across students and staff

-- ========================
-- 1) Allow NULL user_id for pre-created entities
-- ========================
ALTER TABLE public.students
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.staff
  ALTER COLUMN user_id DROP NOT NULL;

-- ========================
-- 2) Add invite_token columns (optional linking mechanism)
-- ========================
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS invite_token UUID;

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS invite_token UUID;

-- Make tokens unique when provided
CREATE UNIQUE INDEX IF NOT EXISTS students_invite_token_unique
  ON public.students(invite_token)
  WHERE invite_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS staff_invite_token_unique
  ON public.staff(invite_token)
  WHERE invite_token IS NOT NULL;

-- ========================
-- 3) Enforce referential integrity to auth.users
-- ========================
ALTER TABLE public.students
  ADD CONSTRAINT students_user_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.staff
  ADD CONSTRAINT staff_user_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Ensure at most one row per user per table (when user_id is set)
CREATE UNIQUE INDEX IF NOT EXISTS students_user_nn_unique
  ON public.students(user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS staff_user_nn_unique
  ON public.staff(user_id)
  WHERE user_id IS NOT NULL;

-- Prevent duplicates among active rows within the same table
CREATE UNIQUE INDEX IF NOT EXISTS students_active_user_unique
  ON public.students(user_id)
  WHERE user_id IS NOT NULL AND status IN ('CURRENT','TRIAL');

CREATE UNIQUE INDEX IF NOT EXISTS staff_active_user_unique
  ON public.staff(user_id)
  WHERE user_id IS NOT NULL AND status IN ('ACTIVE','TRIAL');

-- ========================
-- 4) Trigger to link pre-created rows when auth user is created
-- ========================
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
        AND s.invite_token = (NEW.raw_user_meta_data ->> 'invite_token');
    IF FOUND THEN
      RETURN NEW;
    END IF;

    UPDATE public.students st
      SET user_id = NEW.id
      WHERE st.user_id IS NULL
        AND st.invite_token = (NEW.raw_user_meta_data ->> 'invite_token');
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
      AND LOWER(st.email) = LOWER(NEW.email);

  RETURN NEW;
END;$$;

-- Recreate trigger to avoid duplicates
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.link_precreated_user();

-- ========================
-- 5) Triggers to prevent dual active roles across staff/students
-- ========================
CREATE OR REPLACE FUNCTION public.prevent_dual_active_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_other_active BOOLEAN;
BEGIN
  IF TG_TABLE_NAME = 'students' THEN
    IF (NEW.user_id IS NOT NULL AND NEW.status IN ('CURRENT','TRIAL')) THEN
      SELECT EXISTS (
        SELECT 1 FROM public.staff
        WHERE user_id = NEW.user_id
          AND status IN ('ACTIVE','TRIAL')
      ) INTO v_other_active;
      IF v_other_active THEN
        RAISE EXCEPTION 'User has an active staff record';
      END IF;
    END IF;
  ELSE
    IF (NEW.user_id IS NOT NULL AND NEW.status IN ('ACTIVE','TRIAL')) THEN
      SELECT EXISTS (
        SELECT 1 FROM public.students
        WHERE user_id = NEW.user_id
          AND status IN ('CURRENT','TRIAL')
      ) INTO v_other_active;
      IF v_other_active THEN
        RAISE EXCEPTION 'User has an active student record';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;$$;

-- Recreate role-guard triggers
DROP TRIGGER IF EXISTS students_role_guard ON public.students;
CREATE TRIGGER students_role_guard
  BEFORE INSERT OR UPDATE ON public.students
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_dual_active_roles();

DROP TRIGGER IF EXISTS staff_role_guard ON public.staff;
CREATE TRIGGER staff_role_guard
  BEFORE INSERT OR UPDATE ON public.staff
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_dual_active_roles();


