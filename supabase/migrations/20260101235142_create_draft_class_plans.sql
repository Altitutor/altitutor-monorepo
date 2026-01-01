-- Migration: Create Draft Class Planner Tables
-- Description:
--   Create tables for draft class planning system:
--   - draft_class_plans: Main plan container
--   - draft_class_plan_slots: Time slots configuration per day
--   - draft_classes: Draft classes within a plan
--   - draft_classes_students: Student enrollments in draft classes
--   - draft_classes_staff: Staff assignments to draft classes
--   All tables are ADMINSTAFF only with RLS policies

-- ========================
-- CREATE DRAFT_CLASS_PLANS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS public.draft_class_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  default_class_length_hours DECIMAL(4,2) DEFAULT 1.5,
  status TEXT CHECK (status IN ('DRAFT', 'APPLIED', 'ARCHIVED')) DEFAULT 'DRAFT',
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES public.staff(id),
  created_by UUID REFERENCES public.staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draft_class_plans_year_status 
  ON public.draft_class_plans(year, status);
CREATE INDEX IF NOT EXISTS idx_draft_class_plans_created_by 
  ON public.draft_class_plans(created_by);

-- ========================
-- CREATE DRAFT_CLASS_PLAN_SLOTS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS public.draft_class_plan_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_class_plan_id UUID REFERENCES public.draft_class_plans(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6) NOT NULL,
  start_time TEXT NOT NULL, -- Format: 'HH24:MI'
  end_time TEXT NOT NULL,   -- Format: 'HH24:MI'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(draft_class_plan_id, day_of_week, start_time, end_time)
);

CREATE INDEX IF NOT EXISTS idx_draft_class_plan_slots_plan_id_day 
  ON public.draft_class_plan_slots(draft_class_plan_id, day_of_week);

-- ========================
-- CREATE DRAFT_CLASSES TABLE
-- ========================
CREATE TABLE IF NOT EXISTS public.draft_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_class_plan_id UUID REFERENCES public.draft_class_plans(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TEXT NOT NULL, -- Format: 'HH24:MI'
  end_time TEXT NOT NULL,   -- Format: 'HH24:MI'
  room TEXT,
  level TEXT,
  status TEXT CHECK (status IN ('ACTIVE', 'INACTIVE')) DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draft_classes_plan_id_day 
  ON public.draft_classes(draft_class_plan_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_draft_classes_subject_id 
  ON public.draft_classes(subject_id);

-- ========================
-- CREATE DRAFT_CLASSES_STUDENTS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS public.draft_classes_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_class_id UUID REFERENCES public.draft_classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(draft_class_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_draft_classes_students_class_id 
  ON public.draft_classes_students(draft_class_id);
CREATE INDEX IF NOT EXISTS idx_draft_classes_students_student_id 
  ON public.draft_classes_students(student_id);

-- ========================
-- CREATE DRAFT_CLASSES_STAFF TABLE
-- ========================
CREATE TABLE IF NOT EXISTS public.draft_classes_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_class_id UUID REFERENCES public.draft_classes(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('MAIN_TUTOR', 'SECONDARY_TUTOR')) DEFAULT 'MAIN_TUTOR',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(draft_class_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_draft_classes_staff_class_id 
  ON public.draft_classes_staff(draft_class_id);
CREATE INDEX IF NOT EXISTS idx_draft_classes_staff_staff_id 
  ON public.draft_classes_staff(staff_id);

-- ========================
-- CREATE UPDATED_AT TRIGGERS
-- ========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_draft_class_plans
  BEFORE UPDATE ON public.draft_class_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_draft_class_plan_slots
  BEFORE UPDATE ON public.draft_class_plan_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_draft_classes
  BEFORE UPDATE ON public.draft_classes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_draft_classes_students
  BEFORE UPDATE ON public.draft_classes_students
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_draft_classes_staff
  BEFORE UPDATE ON public.draft_classes_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ========================
-- ENABLE ROW LEVEL SECURITY
-- ========================
ALTER TABLE public.draft_class_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_class_plan_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_classes_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_classes_staff ENABLE ROW LEVEL SECURITY;

-- ========================
-- CREATE RLS POLICIES
-- ========================
CREATE POLICY "ADMINSTAFF full access to draft_class_plans" 
  ON public.draft_class_plans 
  FOR ALL TO authenticated 
  USING ((SELECT public.is_adminstaff_active())) 
  WITH CHECK ((SELECT public.is_adminstaff_active()));

CREATE POLICY "ADMINSTAFF full access to draft_class_plan_slots" 
  ON public.draft_class_plan_slots 
  FOR ALL TO authenticated 
  USING ((SELECT public.is_adminstaff_active())) 
  WITH CHECK ((SELECT public.is_adminstaff_active()));

CREATE POLICY "ADMINSTAFF full access to draft_classes" 
  ON public.draft_classes 
  FOR ALL TO authenticated 
  USING ((SELECT public.is_adminstaff_active())) 
  WITH CHECK ((SELECT public.is_adminstaff_active()));

CREATE POLICY "ADMINSTAFF full access to draft_classes_students" 
  ON public.draft_classes_students 
  FOR ALL TO authenticated 
  USING ((SELECT public.is_adminstaff_active())) 
  WITH CHECK ((SELECT public.is_adminstaff_active()));

CREATE POLICY "ADMINSTAFF full access to draft_classes_staff" 
  ON public.draft_classes_staff 
  FOR ALL TO authenticated 
  USING ((SELECT public.is_adminstaff_active())) 
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- ========================
-- COMMENTS
-- ========================
COMMENT ON TABLE public.draft_class_plans IS 'Draft class plans for planning class schedules before applying to production';
COMMENT ON TABLE public.draft_class_plan_slots IS 'Time slots configuration for each day of the week in a draft plan';
COMMENT ON TABLE public.draft_classes IS 'Draft classes within a plan';
COMMENT ON TABLE public.draft_classes_students IS 'Student enrollments in draft classes';
COMMENT ON TABLE public.draft_classes_staff IS 'Staff assignments to draft classes';
