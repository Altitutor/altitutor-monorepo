-- ========================
-- STUDENT VIEWS AND RLS POLICIES
-- Create views with student-scoped RLS for student portal access
-- ========================

-- ========================
-- HELPER FUNCTIONS
-- ========================

-- Check if current user is a student
CREATE OR REPLACE FUNCTION public.is_student()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students 
    WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_student() TO authenticated;

-- Get current student's ID
CREATE OR REPLACE FUNCTION public.current_student_id()
RETURNS UUID AS $$
  SELECT id FROM public.students WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.current_student_id() TO authenticated;

-- ========================
-- STUDENT TABLE RLS POLICIES
-- ========================

-- Allow students to read their own record
CREATE POLICY "Students can view own profile" ON public.students
  FOR SELECT TO authenticated
  USING (id = public.current_student_id());

-- Allow students to update specific fields in their own profile
CREATE POLICY "Students can update own profile fields" ON public.students
  FOR UPDATE TO authenticated
  USING (id = public.current_student_id())
  WITH CHECK (
    id = public.current_student_id()
    -- Ensure they can only update allowed fields (enforced at application level)
  );

-- ========================
-- VIEW 1: vstudent_profile
-- Student's own profile information
-- ========================

CREATE OR REPLACE VIEW public.vstudent_profile
WITH (security_invoker = on)
AS
SELECT 
  s.id,
  s.first_name,
  s.last_name,
  s.email,
  s.phone,
  s.status,
  s.user_id,
  s.school,
  s.curriculum,
  s.year_level,
  s.parent_first_name,
  s.parent_last_name,
  s.availability_monday,
  s.availability_tuesday,
  s.availability_wednesday,
  s.availability_thursday,
  s.availability_friday,
  s.availability_saturday_am,
  s.availability_saturday_pm,
  s.availability_sunday_am,
  s.availability_sunday_pm,
  s.created_at,
  s.updated_at
FROM public.students s
WHERE s.id = public.current_student_id();

GRANT SELECT ON public.vstudent_profile TO authenticated;

-- ========================
-- VIEW 2: vstudent_classes
-- Student's enrolled classes (past, present, future)
-- ========================

CREATE OR REPLACE VIEW public.vstudent_classes
WITH (security_invoker = on)
AS
SELECT 
  cs.id AS enrollment_id,
  cs.student_id,
  cs.class_id,
  cs.enrolled_at,
  cs.enrolled_by,
  cs.unenrolled_at,
  cs.unenrolled_by,
  cs.created_at AS enrollment_created_at,
  cs.updated_at AS enrollment_updated_at,
  CASE 
    WHEN cs.unenrolled_at IS NULL THEN 'ACTIVE'
    ELSE 'INACTIVE'
  END AS enrollment_status,
  -- Class details
  c.day_of_week,
  c.start_time,
  c.end_time,
  c.room,
  c.level AS class_level,
  c.status AS class_status,
  c.subject_id,
  -- Subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
  sub.year_level AS subject_year_level
FROM public.classes_students cs
JOIN public.classes c ON c.id = cs.class_id
LEFT JOIN public.subjects sub ON sub.id = c.subject_id
WHERE cs.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_classes TO authenticated;

-- ========================
-- VIEW 3: vstudent_class_detail
-- Individual class with all participants (students and staff)
-- ========================

CREATE OR REPLACE VIEW public.vstudent_class_detail
WITH (security_invoker = on)
AS
SELECT 
  c.id AS class_id,
  c.day_of_week,
  c.start_time,
  c.end_time,
  c.room,
  c.level AS class_level,
  c.status AS class_status,
  c.subject_id,
  -- Subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
  -- Students in this class (limited info)
  (
    SELECT json_agg(json_build_object(
      'id', s.id,
      'first_name', s.first_name,
      'last_name', s.last_name,
      'year_level', s.year_level
    ))
    FROM public.classes_students cs2
    JOIN public.students s ON s.id = cs2.student_id
    WHERE cs2.class_id = c.id AND cs2.unenrolled_at IS NULL
  ) AS students,
  -- Staff in this class (limited info + subjects they teach)
  (
    SELECT json_agg(json_build_object(
      'id', st.id,
      'first_name', st.first_name,
      'last_name', st.last_name,
      'role', st.role,
      'subjects', (
        SELECT json_agg(json_build_object(
          'id', subj.id,
          'name', subj.name
        ))
        FROM public.staff_subjects ss
        JOIN public.subjects subj ON subj.id = ss.subject_id
        WHERE ss.staff_id = st.id
      )
    ))
    FROM public.classes_staff cst
    JOIN public.staff st ON st.id = cst.staff_id
    WHERE cst.class_id = c.id AND cst.status = 'ACTIVE'
  ) AS staff
FROM public.classes c
LEFT JOIN public.subjects sub ON sub.id = c.subject_id
WHERE EXISTS (
  SELECT 1 FROM public.classes_students cs
  WHERE cs.class_id = c.id 
    AND cs.student_id = public.current_student_id()
);

GRANT SELECT ON public.vstudent_class_detail TO authenticated;

-- ========================
-- VIEW 4: vstudent_sessions
-- Student's sessions (past, present, future)
-- ========================

CREATE OR REPLACE VIEW public.vstudent_sessions
WITH (security_invoker = on)
AS
SELECT 
  ss.id AS session_student_id,
  ss.student_id,
  ss.planned_absence,
  ss.planned_absence_logged_at,
  ss.is_rescheduled,
  ss.rescheduled_at,
  ss.is_credited,
  ss.credited_at,
  ss.created_at AS session_student_created_at,
  ss.updated_at AS session_student_updated_at,
  -- Session details
  s.id AS session_id,
  s.type AS session_type,
  s.class_id,
  s.subject_id,
  s.start_at,
  s.end_at,
  s.created_at AS session_created_at,
  s.updated_at AS session_updated_at,
  -- Class details (if applicable)
  c.day_of_week AS class_day_of_week,
  c.start_time AS class_start_time,
  c.end_time AS class_end_time,
  c.room AS class_room,
  c.level AS class_level,
  -- Subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color
FROM public.sessions_students ss
JOIN public.sessions s ON s.id = ss.session_id
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE ss.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_sessions TO authenticated;

-- ========================
-- VIEW 5: vstudent_session_base
-- Individual session detail with class and attendance info
-- ========================

CREATE OR REPLACE VIEW public.vstudent_session_base
WITH (security_invoker = on)
AS
SELECT 
  s.id AS session_id,
  s.type AS session_type,
  s.class_id,
  s.subject_id,
  s.start_at,
  s.end_at,
  s.created_at AS session_created_at,
  s.updated_at AS session_updated_at,
  -- Student's attendance info
  ss.id AS session_student_id,
  ss.planned_absence,
  ss.planned_absence_logged_at,
  ss.is_rescheduled,
  ss.rescheduled_at,
  ss.is_credited,
  ss.credited_at,
  -- Class details (reusing class detail logic)
  c.day_of_week,
  c.start_time,
  c.end_time,
  c.room,
  c.level AS class_level,
  c.status AS class_status,
  -- Subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
  -- Students in this session (limited info)
  (
    SELECT json_agg(json_build_object(
      'id', st.id,
      'first_name', st.first_name,
      'last_name', st.last_name,
      'year_level', st.year_level
    ))
    FROM public.sessions_students ss2
    JOIN public.students st ON st.id = ss2.student_id
    WHERE ss2.session_id = s.id
  ) AS students,
  -- Staff in this session (limited info + subjects they teach)
  (
    SELECT json_agg(json_build_object(
      'id', staff.id,
      'first_name', staff.first_name,
      'last_name', staff.last_name,
      'role', staff.role,
      'type', sst.type,
      'subjects', (
        SELECT json_agg(json_build_object(
          'id', subj.id,
          'name', subj.name
        ))
        FROM public.staff_subjects ss3
        JOIN public.subjects subj ON subj.id = ss3.subject_id
        WHERE ss3.staff_id = staff.id
      )
    ))
    FROM public.sessions_staff sst
    JOIN public.staff staff ON staff.id = sst.staff_id
    WHERE sst.session_id = s.id
  ) AS staff
FROM public.sessions s
JOIN public.sessions_students ss ON ss.session_id = s.id
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE ss.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_session_base TO authenticated;

-- ========================
-- VIEW 6: vstudent_tutor_log
-- Tutor log aggregate for sessions the student attended
-- ========================

CREATE OR REPLACE VIEW public.vstudent_tutor_log
WITH (security_invoker = on)
AS
SELECT 
  tl.id AS tutor_log_id,
  tl.session_id,
  tl.created_at AS tutor_log_created_at,
  tl.updated_at AS tutor_log_updated_at,
  -- Student's attendance record
  tlsa.id AS student_attendance_id,
  tlsa.attended,
  tlsa.created_at AS attendance_created_at,
  -- Staff attendance (names only)
  (
    SELECT json_agg(json_build_object(
      'id', tlsa2.id,
      'staff_id', s.id,
      'first_name', s.first_name,
      'last_name', s.last_name,
      'attended', tlsa2.attended,
      'type', tlsa2.type
    ))
    FROM public.tutor_logs_staff_attendance tlsa2
    JOIN public.staff s ON s.id = tlsa2.staff_id
    WHERE tlsa2.tutor_log_id = tl.id
  ) AS staff_attendance,
  -- Topics covered (only those linked to this student)
  (
    SELECT json_agg(json_build_object(
      'id', tlt.id,
      'topic_id', t.id,
      'topic_name', t.name,
      'topic_index', t.index,
      'parent_id', t.parent_id,
      'subject_id', t.subject_id
    ))
    FROM public.tutor_logs_topics tlt
    JOIN public.tutor_logs_topics_students tlts ON tlts.tutor_logs_topics_id = tlt.id
    JOIN public.topics t ON t.id = tlt.topic_id
    WHERE tlt.tutor_log_id = tl.id 
      AND tlts.student_id = public.current_student_id()
  ) AS topics,
  -- Files used (only those linked to this student)
  (
    SELECT json_agg(json_build_object(
      'id', tltf.id,
      'topics_files_id', tf.id,
      'topic_id', tf.topic_id,
      'file_id', f.id,
      'filename', f.filename,
      'mimetype', f.mimetype,
      'size_bytes', f.size_bytes,
      'type', tf.type,
      'is_solutions', tf.is_solutions,
      'storage_path', f.storage_path,
      'bucket', f.bucket
    ))
    FROM public.tutor_logs_topics_files tltf
    JOIN public.tutor_logs_topics_files_students tltfs ON tltfs.tutor_logs_topics_files_id = tltf.id
    JOIN public.topics_files tf ON tf.id = tltf.topics_files_id
    JOIN public.files f ON f.id = tf.file_id
    WHERE tltf.tutor_log_id = tl.id 
      AND tltfs.student_id = public.current_student_id()
  ) AS files
FROM public.tutor_logs tl
JOIN public.tutor_logs_student_attendance tlsa ON tlsa.tutor_log_id = tl.id
WHERE tlsa.student_id = public.current_student_id()
  AND tlsa.attended = true;

GRANT SELECT ON public.vstudent_tutor_log TO authenticated;

-- ========================
-- VIEW 7: vstudent_subjects
-- Student's subjects (from direct links and class enrollments)
-- ========================

CREATE OR REPLACE VIEW public.vstudent_subjects
WITH (security_invoker = on)
AS
SELECT DISTINCT
  sub.id,
  sub.name,
  sub.curriculum,
  sub.discipline,
  sub.level,
  sub.color,
  sub.year_level,
  sub.billing_type,
  sub.session_fee_cents,
  sub.currency,
  sub.created_at,
  sub.updated_at
FROM public.subjects sub
WHERE sub.id IN (
  -- Direct link via students_subjects
  SELECT ss.subject_id
  FROM public.students_subjects ss
  WHERE ss.student_id = public.current_student_id()
  
  UNION
  
  -- Indirect link via enrolled classes
  SELECT c.subject_id
  FROM public.classes_students cs
  JOIN public.classes c ON c.id = cs.class_id
  WHERE cs.student_id = public.current_student_id()
    AND c.subject_id IS NOT NULL
);

GRANT SELECT ON public.vstudent_subjects TO authenticated;

-- ========================
-- VIEW 8: vstudent_subject_resources
-- Topics tree + files for subjects student is linked to
-- ========================

CREATE OR REPLACE VIEW public.vstudent_subject_resources
WITH (security_invoker = on)
AS
WITH RECURSIVE topic_tree AS (
  -- Base case: root topics for subjects the student is linked to
  SELECT 
    t.id,
    t.subject_id,
    t.name,
    t.parent_id,
    t.index,
    t.created_at,
    t.updated_at,
    1 AS depth,
    ARRAY[t.id] AS path
  FROM public.topics t
  WHERE t.parent_id IS NULL
    AND t.subject_id IN (
      SELECT vs.id FROM public.vstudent_subjects vs
    )
  
  UNION ALL
  
  -- Recursive case: child topics
  SELECT 
    t.id,
    t.subject_id,
    t.name,
    t.parent_id,
    t.index,
    t.created_at,
    t.updated_at,
    tt.depth + 1,
    tt.path || t.id
  FROM public.topics t
  JOIN topic_tree tt ON t.parent_id = tt.id
  WHERE NOT t.id = ANY(tt.path) -- Prevent cycles
)
SELECT 
  tt.id AS topic_id,
  tt.subject_id,
  tt.name AS topic_name,
  tt.parent_id,
  tt.index AS topic_index,
  tt.depth,
  tt.path AS topic_path,
  -- Associated files for this topic
  (
    SELECT json_agg(json_build_object(
      'id', tf.id,
      'type', tf.type,
      'index', tf.index,
      'is_solutions', tf.is_solutions,
      'is_solutions_of_id', tf.is_solutions_of_id,
      'file_id', f.id,
      'filename', f.filename,
      'mimetype', f.mimetype,
      'size_bytes', f.size_bytes,
      'storage_path', f.storage_path,
      'bucket', f.bucket,
      'created_at', tf.created_at
    ) ORDER BY tf.index)
    FROM public.topics_files tf
    JOIN public.files f ON f.id = tf.file_id
    WHERE tf.topic_id = tt.id
      AND f.deleted_at IS NULL
  ) AS files
FROM topic_tree tt
ORDER BY tt.path;

GRANT SELECT ON public.vstudent_subject_resources TO authenticated;

-- ========================
-- VIEW 9: vstudent_billing
-- Student's billing information (read-only)
-- ========================

CREATE OR REPLACE VIEW public.vstudent_billing
WITH (security_invoker = on)
AS
SELECT 
  sb.student_id,
  sb.stripe_customer_id,
  sb.default_payment_method_id,
  sb.card_brand,
  sb.card_last4,
  sb.card_country,
  sb.verified_at,
  sb.created_at,
  sb.updated_at
FROM public.students_billing sb
WHERE sb.student_id = public.current_student_id();

GRANT SELECT ON public.vstudent_billing TO authenticated;

-- ========================
-- COMMENTS
-- ========================

COMMENT ON FUNCTION public.is_student() IS 'Returns true if the current authenticated user is a student';
COMMENT ON FUNCTION public.current_student_id() IS 'Returns the student ID for the current authenticated user';

COMMENT ON VIEW public.vstudent_profile IS 'Student view: Own profile information';
COMMENT ON VIEW public.vstudent_classes IS 'Student view: All enrolled classes (past, present, future)';
COMMENT ON VIEW public.vstudent_class_detail IS 'Student view: Individual class with participants (limited student/staff info)';
COMMENT ON VIEW public.vstudent_sessions IS 'Student view: All sessions linked to student';
COMMENT ON VIEW public.vstudent_session_base IS 'Student view: Individual session detail with attendance';
COMMENT ON VIEW public.vstudent_tutor_log IS 'Student view: Tutor logs for attended sessions (student-scoped topics/files)';
COMMENT ON VIEW public.vstudent_subjects IS 'Student view: All subjects linked to student (direct or via classes)';
COMMENT ON VIEW public.vstudent_subject_resources IS 'Student view: Hierarchical topic tree with files for student subjects';
COMMENT ON VIEW public.vstudent_billing IS 'Student view: Billing information (read-only)';

