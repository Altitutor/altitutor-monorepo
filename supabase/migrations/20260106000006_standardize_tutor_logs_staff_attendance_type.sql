-- Migration: Standardize tutor_logs_staff_attendance.type to match sessions_staff.type
-- Description:
--   - Change tutor_logs_staff_attendance.type constraint from ('PRIMARY', 'ASSISTANT', 'TRIAL')
--     to ('MAIN_TUTOR', 'SECONDARY_TUTOR', 'TRIAL_TUTOR') to match sessions_staff.type
--   - Migrate existing data:
--     - 'PRIMARY' -> 'MAIN_TUTOR'
--     - 'ASSISTANT' -> 'SECONDARY_TUTOR'
--     - 'TRIAL' -> 'TRIAL_TUTOR'
--   - This eliminates the need for mapping logic in frontend code

-- ========================
-- 1. DROP CONSTRAINT FIRST (to allow data migration)
-- ========================
ALTER TABLE public.tutor_logs_staff_attendance
DROP CONSTRAINT IF EXISTS tutor_logs_staff_attendance_type_check;

-- ========================
-- 2. MIGRATE EXISTING DATA
-- ========================
UPDATE public.tutor_logs_staff_attendance
SET type = CASE
  WHEN type = 'PRIMARY' THEN 'MAIN_TUTOR'
  WHEN type = 'ASSISTANT' THEN 'SECONDARY_TUTOR'
  WHEN type = 'TRIAL' THEN 'TRIAL_TUTOR'
  ELSE type -- Keep any unexpected values as-is (shouldn't happen)
END
WHERE type IN ('PRIMARY', 'ASSISTANT', 'TRIAL');

-- ========================
-- 3. ADD NEW CONSTRAINT
-- ========================

ALTER TABLE public.tutor_logs_staff_attendance
ADD CONSTRAINT tutor_logs_staff_attendance_type_check
CHECK (type IN ('MAIN_TUTOR', 'SECONDARY_TUTOR', 'TRIAL_TUTOR'));

-- ========================
-- 4. VERIFY MIGRATION
-- ========================
-- Check that all records were migrated successfully
DO $$
DECLARE
  v_old_count INTEGER;
  v_new_count INTEGER;
BEGIN
  -- Count records with old values (should be 0)
  SELECT COUNT(*) INTO v_old_count
  FROM public.tutor_logs_staff_attendance
  WHERE type IN ('PRIMARY', 'ASSISTANT', 'TRIAL');
  
  -- Count records with new values
  SELECT COUNT(*) INTO v_new_count
  FROM public.tutor_logs_staff_attendance
  WHERE type IN ('MAIN_TUTOR', 'SECONDARY_TUTOR', 'TRIAL_TUTOR');
  
  -- If there are any old values remaining, raise an error
  IF v_old_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % records still have old type values', v_old_count;
  END IF;
  
  -- Log success (if there are any records)
  IF v_new_count > 0 THEN
    RAISE NOTICE 'Migration successful: % records migrated to new type values', v_new_count;
  END IF;
END $$;

