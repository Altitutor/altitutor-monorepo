-- Migration: Auto-link subjects when students/staff are enrolled/assigned to classes
-- Description:
--   When a student is enrolled in a class with a subject they don't have, auto-add that subject
--   When a staff member is assigned to a class with a subject they don't have, auto-add that subject

-- ========================
-- FUNCTION: Auto-link subject to student on class enrollment
-- ========================
CREATE OR REPLACE FUNCTION auto_link_student_subject_on_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_subject_id UUID;
BEGIN
  -- Get the subject_id from the class
  SELECT subject_id INTO v_class_subject_id
  FROM classes
  WHERE id = NEW.class_id;
  
  -- If class has a subject and student doesn't have it, add it
  IF v_class_subject_id IS NOT NULL THEN
    INSERT INTO students_subjects (student_id, subject_id, created_by)
    VALUES (NEW.student_id, v_class_subject_id, NEW.enrolled_by)
    ON CONFLICT (student_id, subject_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ========================
-- TRIGGER: Auto-link subject to student on enrollment
-- ========================
DROP TRIGGER IF EXISTS trigger_auto_link_student_subject_on_enrollment ON classes_students;

CREATE TRIGGER trigger_auto_link_student_subject_on_enrollment
  AFTER INSERT ON classes_students
  FOR EACH ROW
  WHEN (NEW.unenrolled_at IS NULL)
  EXECUTE FUNCTION auto_link_student_subject_on_enrollment();

-- ========================
-- FUNCTION: Auto-link subject to staff on class assignment
-- ========================
CREATE OR REPLACE FUNCTION auto_link_staff_subject_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_subject_id UUID;
BEGIN
  -- Get the subject_id from the class
  SELECT subject_id INTO v_class_subject_id
  FROM classes
  WHERE id = NEW.class_id;
  
  -- If class has a subject and staff doesn't have it, add it
  IF v_class_subject_id IS NOT NULL THEN
    INSERT INTO staff_subjects (staff_id, subject_id)
    VALUES (NEW.staff_id, v_class_subject_id)
    ON CONFLICT (staff_id, subject_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ========================
-- TRIGGER: Auto-link subject to staff on assignment
-- ========================
DROP TRIGGER IF EXISTS trigger_auto_link_staff_subject_on_assignment ON classes_staff;

CREATE TRIGGER trigger_auto_link_staff_subject_on_assignment
  AFTER INSERT ON classes_staff
  FOR EACH ROW
  WHEN (NEW.unassigned_at IS NULL)
  EXECUTE FUNCTION auto_link_staff_subject_on_assignment();

COMMENT ON FUNCTION auto_link_student_subject_on_enrollment() IS 'Automatically adds a subject to a student when they are enrolled in a class with that subject';
COMMENT ON FUNCTION auto_link_staff_subject_on_assignment() IS 'Automatically adds a subject to a staff member when they are assigned to a class with that subject';

