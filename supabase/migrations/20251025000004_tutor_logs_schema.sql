-- Migration: Create tutor logs schema
-- Description:
--  - Create tutor_logs table and all related tables
--  - Add indexes, triggers, and RLS policies
--  - Create/update notes table to support tutor_logs target_type

-- ========================
-- CREATE tutor_logs TABLE
-- ========================
CREATE TABLE public.tutor_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL UNIQUE REFERENCES public.sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.staff(id)
);

CREATE INDEX idx_tutor_logs_session_id ON public.tutor_logs(session_id);
CREATE INDEX idx_tutor_logs_created_by ON public.tutor_logs(created_by);
CREATE INDEX idx_tutor_logs_created_at ON public.tutor_logs(created_at);

-- ========================
-- CREATE tutor_logs_staff_attendance TABLE
-- ========================
CREATE TABLE public.tutor_logs_staff_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_log_id UUID NOT NULL REFERENCES public.tutor_logs(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  attended BOOLEAN NOT NULL DEFAULT FALSE,
  type TEXT NOT NULL CHECK (type IN ('PRIMARY', 'ASSISTANT', 'TRIAL')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tutor_logs_staff_attendance_unique UNIQUE(tutor_log_id, staff_id)
);

CREATE INDEX idx_tutor_logs_staff_attendance_tutor_log_id ON public.tutor_logs_staff_attendance(tutor_log_id);
CREATE INDEX idx_tutor_logs_staff_attendance_staff_id ON public.tutor_logs_staff_attendance(staff_id);
CREATE INDEX idx_tutor_logs_staff_attendance_attended ON public.tutor_logs_staff_attendance(attended);

-- ========================
-- CREATE tutor_logs_student_attendance TABLE
-- ========================
CREATE TABLE public.tutor_logs_student_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_log_id UUID NOT NULL REFERENCES public.tutor_logs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attended BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.staff(id),
  CONSTRAINT tutor_logs_student_attendance_unique UNIQUE(tutor_log_id, student_id)
);

CREATE INDEX idx_tutor_logs_student_attendance_tutor_log_id ON public.tutor_logs_student_attendance(tutor_log_id);
CREATE INDEX idx_tutor_logs_student_attendance_student_id ON public.tutor_logs_student_attendance(student_id);
CREATE INDEX idx_tutor_logs_student_attendance_attended ON public.tutor_logs_student_attendance(attended);

-- ========================
-- CREATE tutor_logs_topics TABLE
-- ========================
CREATE TABLE public.tutor_logs_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_log_id UUID NOT NULL REFERENCES public.tutor_logs(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.staff(id),
  CONSTRAINT tutor_logs_topics_unique UNIQUE(tutor_log_id, topic_id)
);

CREATE INDEX idx_tutor_logs_topics_tutor_log_id ON public.tutor_logs_topics(tutor_log_id);
CREATE INDEX idx_tutor_logs_topics_topic_id ON public.tutor_logs_topics(topic_id);

-- ========================
-- CREATE tutor_logs_topics_students TABLE
-- ========================
CREATE TABLE public.tutor_logs_topics_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_logs_topics_id UUID NOT NULL REFERENCES public.tutor_logs_topics(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.staff(id),
  CONSTRAINT tutor_logs_topics_students_unique UNIQUE(tutor_logs_topics_id, student_id)
);

CREATE INDEX idx_tutor_logs_topics_students_tutor_logs_topics_id ON public.tutor_logs_topics_students(tutor_logs_topics_id);
CREATE INDEX idx_tutor_logs_topics_students_student_id ON public.tutor_logs_topics_students(student_id);

-- ========================
-- CREATE tutor_logs_topics_files TABLE
-- ========================
CREATE TABLE public.tutor_logs_topics_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_log_id UUID NOT NULL REFERENCES public.tutor_logs(id) ON DELETE CASCADE,
  topics_files_id UUID NOT NULL REFERENCES public.topics_files(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.staff(id),
  CONSTRAINT tutor_logs_topics_files_unique UNIQUE(tutor_log_id, topics_files_id)
);

CREATE INDEX idx_tutor_logs_topics_files_tutor_log_id ON public.tutor_logs_topics_files(tutor_log_id);
CREATE INDEX idx_tutor_logs_topics_files_topics_files_id ON public.tutor_logs_topics_files(topics_files_id);

-- ========================
-- CREATE tutor_logs_topics_files_students TABLE
-- ========================
CREATE TABLE public.tutor_logs_topics_files_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_logs_topics_files_id UUID NOT NULL REFERENCES public.tutor_logs_topics_files(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.staff(id),
  CONSTRAINT tutor_logs_topics_files_students_unique UNIQUE(tutor_logs_topics_files_id, student_id)
);

CREATE INDEX idx_tutor_logs_topics_files_students_tutor_logs_topics_files_id ON public.tutor_logs_topics_files_students(tutor_logs_topics_files_id);
CREATE INDEX idx_tutor_logs_topics_files_students_student_id ON public.tutor_logs_topics_files_students(student_id);

-- ========================
-- CREATE OR UPDATE notes TABLE
-- ========================
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.staff(id)
);

-- Add indexes if table was just created
CREATE INDEX IF NOT EXISTS idx_notes_target_type_target_id ON public.notes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_by ON public.notes(created_by);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON public.notes(created_at);

-- ========================
-- CREATE updated_at TRIGGERS
-- ========================
DROP TRIGGER IF EXISTS set_updated_at_tutor_logs ON public.tutor_logs;
CREATE TRIGGER set_updated_at_tutor_logs
BEFORE UPDATE ON public.tutor_logs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_tutor_logs_staff_attendance ON public.tutor_logs_staff_attendance;
CREATE TRIGGER set_updated_at_tutor_logs_staff_attendance
BEFORE UPDATE ON public.tutor_logs_staff_attendance
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_tutor_logs_student_attendance ON public.tutor_logs_student_attendance;
CREATE TRIGGER set_updated_at_tutor_logs_student_attendance
BEFORE UPDATE ON public.tutor_logs_student_attendance
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_tutor_logs_topics ON public.tutor_logs_topics;
CREATE TRIGGER set_updated_at_tutor_logs_topics
BEFORE UPDATE ON public.tutor_logs_topics
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_tutor_logs_topics_students ON public.tutor_logs_topics_students;
CREATE TRIGGER set_updated_at_tutor_logs_topics_students
BEFORE UPDATE ON public.tutor_logs_topics_students
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_tutor_logs_topics_files ON public.tutor_logs_topics_files;
CREATE TRIGGER set_updated_at_tutor_logs_topics_files
BEFORE UPDATE ON public.tutor_logs_topics_files
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_tutor_logs_topics_files_students ON public.tutor_logs_topics_files_students;
CREATE TRIGGER set_updated_at_tutor_logs_topics_files_students
BEFORE UPDATE ON public.tutor_logs_topics_files_students
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_notes ON public.notes;
CREATE TRIGGER set_updated_at_notes
BEFORE UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ========================
-- ENABLE RLS AND CREATE POLICIES
-- ========================

-- tutor_logs
ALTER TABLE public.tutor_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutors can view their own tutor logs" ON public.tutor_logs;
CREATE POLICY "Tutors can view their own tutor logs" ON public.tutor_logs
  FOR SELECT TO authenticated
  USING (
    created_by IN (
      SELECT id FROM public.staff 
      WHERE user_id = auth.uid() AND role = 'TUTOR' AND status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "Tutors can insert their own tutor logs" ON public.tutor_logs;
CREATE POLICY "Tutors can insert their own tutor logs" ON public.tutor_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by IN (
      SELECT id FROM public.staff 
      WHERE user_id = auth.uid() AND role = 'TUTOR' AND status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "ADMINSTAFF full access to tutor_logs" ON public.tutor_logs;
CREATE POLICY "ADMINSTAFF full access to tutor_logs" ON public.tutor_logs
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- tutor_logs_staff_attendance
ALTER TABLE public.tutor_logs_staff_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutors can access staff attendance for their logs" ON public.tutor_logs_staff_attendance;
CREATE POLICY "Tutors can access staff attendance for their logs" ON public.tutor_logs_staff_attendance
  FOR ALL TO authenticated
  USING (
    tutor_log_id IN (
      SELECT id FROM public.tutor_logs 
      WHERE created_by IN (
        SELECT id FROM public.staff 
        WHERE user_id = auth.uid() AND role = 'TUTOR' AND status = 'ACTIVE'
      )
    )
  )
  WITH CHECK (
    tutor_log_id IN (
      SELECT id FROM public.tutor_logs 
      WHERE created_by IN (
        SELECT id FROM public.staff 
        WHERE user_id = auth.uid() AND role = 'TUTOR' AND status = 'ACTIVE'
      )
    )
  );

DROP POLICY IF EXISTS "ADMINSTAFF full access to tutor_logs_staff_attendance" ON public.tutor_logs_staff_attendance;
CREATE POLICY "ADMINSTAFF full access to tutor_logs_staff_attendance" ON public.tutor_logs_staff_attendance
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- tutor_logs_student_attendance
ALTER TABLE public.tutor_logs_student_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutors can access student attendance for their logs" ON public.tutor_logs_student_attendance;
CREATE POLICY "Tutors can access student attendance for their logs" ON public.tutor_logs_student_attendance
  FOR ALL TO authenticated
  USING (
    tutor_log_id IN (
      SELECT id FROM public.tutor_logs 
      WHERE created_by IN (
        SELECT id FROM public.staff 
        WHERE user_id = auth.uid() AND role = 'TUTOR' AND status = 'ACTIVE'
      )
    )
  )
  WITH CHECK (
    tutor_log_id IN (
      SELECT id FROM public.tutor_logs 
      WHERE created_by IN (
        SELECT id FROM public.staff 
        WHERE user_id = auth.uid() AND role = 'TUTOR' AND status = 'ACTIVE'
      )
    )
  );

DROP POLICY IF EXISTS "ADMINSTAFF full access to tutor_logs_student_attendance" ON public.tutor_logs_student_attendance;
CREATE POLICY "ADMINSTAFF full access to tutor_logs_student_attendance" ON public.tutor_logs_student_attendance
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- tutor_logs_topics
ALTER TABLE public.tutor_logs_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutors can access topics for their logs" ON public.tutor_logs_topics;
CREATE POLICY "Tutors can access topics for their logs" ON public.tutor_logs_topics
  FOR ALL TO authenticated
  USING (
    tutor_log_id IN (
      SELECT id FROM public.tutor_logs 
      WHERE created_by IN (
        SELECT id FROM public.staff 
        WHERE user_id = auth.uid() AND role = 'TUTOR' AND status = 'ACTIVE'
      )
    )
  )
  WITH CHECK (
    tutor_log_id IN (
      SELECT id FROM public.tutor_logs 
      WHERE created_by IN (
        SELECT id FROM public.staff 
        WHERE user_id = auth.uid() AND role = 'TUTOR' AND status = 'ACTIVE'
      )
    )
  );

DROP POLICY IF EXISTS "ADMINSTAFF full access to tutor_logs_topics" ON public.tutor_logs_topics;
CREATE POLICY "ADMINSTAFF full access to tutor_logs_topics" ON public.tutor_logs_topics
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- tutor_logs_topics_students
ALTER TABLE public.tutor_logs_topics_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutors can access topic students for their logs" ON public.tutor_logs_topics_students;
CREATE POLICY "Tutors can access topic students for their logs" ON public.tutor_logs_topics_students
  FOR ALL TO authenticated
  USING (
    tutor_logs_topics_id IN (
      SELECT id FROM public.tutor_logs_topics 
      WHERE tutor_log_id IN (
        SELECT id FROM public.tutor_logs 
        WHERE created_by IN (
          SELECT id FROM public.staff 
          WHERE user_id = auth.uid() AND role = 'TUTOR' AND status = 'ACTIVE'
        )
      )
    )
  )
  WITH CHECK (
    tutor_logs_topics_id IN (
      SELECT id FROM public.tutor_logs_topics 
      WHERE tutor_log_id IN (
        SELECT id FROM public.tutor_logs 
        WHERE created_by IN (
          SELECT id FROM public.staff 
          WHERE user_id = auth.uid() AND role = 'TUTOR' AND status = 'ACTIVE'
        )
      )
    )
  );

DROP POLICY IF EXISTS "ADMINSTAFF full access to tutor_logs_topics_students" ON public.tutor_logs_topics_students;
CREATE POLICY "ADMINSTAFF full access to tutor_logs_topics_students" ON public.tutor_logs_topics_students
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- tutor_logs_topics_files
ALTER TABLE public.tutor_logs_topics_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutors can access topic files for their logs" ON public.tutor_logs_topics_files;
CREATE POLICY "Tutors can access topic files for their logs" ON public.tutor_logs_topics_files
  FOR ALL TO authenticated
  USING (
    tutor_log_id IN (
      SELECT id FROM public.tutor_logs 
      WHERE created_by IN (
        SELECT id FROM public.staff 
        WHERE user_id = auth.uid() AND role = 'TUTOR' AND status = 'ACTIVE'
      )
    )
  )
  WITH CHECK (
    tutor_log_id IN (
      SELECT id FROM public.tutor_logs 
      WHERE created_by IN (
        SELECT id FROM public.staff 
        WHERE user_id = auth.uid() AND role = 'TUTOR' AND status = 'ACTIVE'
      )
    )
  );

DROP POLICY IF EXISTS "ADMINSTAFF full access to tutor_logs_topics_files" ON public.tutor_logs_topics_files;
CREATE POLICY "ADMINSTAFF full access to tutor_logs_topics_files" ON public.tutor_logs_topics_files
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- tutor_logs_topics_files_students
ALTER TABLE public.tutor_logs_topics_files_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutors can access topic file students for their logs" ON public.tutor_logs_topics_files_students;
CREATE POLICY "Tutors can access topic file students for their logs" ON public.tutor_logs_topics_files_students
  FOR ALL TO authenticated
  USING (
    tutor_logs_topics_files_id IN (
      SELECT id FROM public.tutor_logs_topics_files 
      WHERE tutor_log_id IN (
        SELECT id FROM public.tutor_logs 
        WHERE created_by IN (
          SELECT id FROM public.staff 
          WHERE user_id = auth.uid() AND role = 'TUTOR' AND status = 'ACTIVE'
        )
      )
    )
  )
  WITH CHECK (
    tutor_logs_topics_files_id IN (
      SELECT id FROM public.tutor_logs_topics_files 
      WHERE tutor_log_id IN (
        SELECT id FROM public.tutor_logs 
        WHERE created_by IN (
          SELECT id FROM public.staff 
          WHERE user_id = auth.uid() AND role = 'TUTOR' AND status = 'ACTIVE'
        )
      )
    )
  );

DROP POLICY IF EXISTS "ADMINSTAFF full access to tutor_logs_topics_files_students" ON public.tutor_logs_topics_files_students;
CREATE POLICY "ADMINSTAFF full access to tutor_logs_topics_files_students" ON public.tutor_logs_topics_files_students
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- notes (add policies if they don't exist)
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to notes" ON public.notes;
CREATE POLICY "ADMINSTAFF full access to notes" ON public.notes
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());


