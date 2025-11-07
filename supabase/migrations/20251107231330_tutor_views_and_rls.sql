-- ========================
-- TUTOR VIEWS AND RLS POLICIES
-- Create security_definer views for tutor access
-- No direct RLS policies - tutors access data through views only
-- ========================

-- ========================
-- HELPER FUNCTIONS
-- ========================

-- Check if current user is a tutor or admin staff
CREATE OR REPLACE FUNCTION public.is_tutor()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff 
    WHERE user_id = auth.uid()
      AND role IN ('TUTOR', 'ADMINSTAFF')
      AND status = 'ACTIVE'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_tutor() TO authenticated;

COMMENT ON FUNCTION public.is_tutor() IS 'Returns true if the current authenticated user is an active tutor or admin staff';

-- Get current tutor's staff ID
CREATE OR REPLACE FUNCTION public.current_tutor_id()
RETURNS UUID AS $$
  SELECT id FROM public.staff 
  WHERE user_id = auth.uid()
    AND role IN ('TUTOR', 'ADMINSTAFF')
    AND status = 'ACTIVE'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.current_tutor_id() TO authenticated;

COMMENT ON FUNCTION public.current_tutor_id() IS 'Returns the staff ID for the current authenticated tutor or admin staff';

-- ========================
-- VIEW 1: vtutor_classes
-- All classes linked to the tutor through classes_staff
-- ========================

CREATE OR REPLACE VIEW public.vtutor_classes
WITH (security_invoker = false)
AS
SELECT 
  c.id,
  c.day_of_week,
  c.start_time,
  c.end_time,
  c.room,
  c.level,
  c.status,
  c.subject_id,
  c.created_at,
  c.updated_at,
  -- Subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
  sub.year_level AS subject_year_level
FROM public.classes c
LEFT JOIN public.subjects sub ON sub.id = c.subject_id
WHERE c.id IN (
  SELECT class_id 
  FROM public.classes_staff 
  WHERE staff_id = public.current_tutor_id() 
    AND status = 'ACTIVE'
)
AND c.status = 'ACTIVE';

GRANT SELECT ON public.vtutor_classes TO authenticated;

COMMENT ON VIEW public.vtutor_classes IS 'Tutor view: All active classes linked to the tutor via classes_staff';

-- ========================
-- VIEW 2: vtutor_class_detail
-- Detailed view of a single class with students and staff
-- ========================

CREATE OR REPLACE VIEW public.vtutor_class_detail
WITH (security_invoker = false)
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
  c.created_at,
  c.updated_at,
  -- Subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
  sub.year_level AS subject_year_level,
  -- Students in this class (scoped fields only)
  (
    SELECT json_agg(json_build_object(
      'id', s.id,
      'first_name', s.first_name,
      'last_name', s.last_name,
      'status', s.status,
      'school', s.school,
      'curriculum', s.curriculum,
      'year_level', s.year_level,
      'availability_monday', s.availability_monday,
      'availability_tuesday', s.availability_tuesday,
      'availability_wednesday', s.availability_wednesday,
      'availability_thursday', s.availability_thursday,
      'availability_friday', s.availability_friday,
      'availability_saturday_am', s.availability_saturday_am,
      'availability_saturday_pm', s.availability_saturday_pm,
      'availability_sunday_am', s.availability_sunday_am,
      'availability_sunday_pm', s.availability_sunday_pm,
      'enrollment_id', cs.id,
      'enrolled_at', cs.enrolled_at,
      'unenrolled_at', cs.unenrolled_at
    ))
    FROM public.classes_students cs
    JOIN public.students s ON s.id = cs.student_id
    WHERE cs.class_id = c.id 
      AND cs.unenrolled_at IS NULL
  ) AS students,
  -- Staff in this class (all fields for coordination)
  (
    SELECT json_agg(json_build_object(
      'id', st.id,
      'first_name', st.first_name,
      'last_name', st.last_name,
      'email', st.email,
      'phone', st.phone_number,
      'role', st.role,
      'status', st.status,
      'classes_staff_id', cst.id,
      'classes_staff_status', cst.status
    ))
    FROM public.classes_staff cst
    JOIN public.staff st ON st.id = cst.staff_id
    WHERE cst.class_id = c.id 
      AND cst.status = 'ACTIVE'
  ) AS staff
FROM public.classes c
LEFT JOIN public.subjects sub ON sub.id = c.subject_id
WHERE c.id IN (
  SELECT class_id 
  FROM public.classes_staff 
  WHERE staff_id = public.current_tutor_id() 
    AND status = 'ACTIVE'
);

GRANT SELECT ON public.vtutor_class_detail TO authenticated;

COMMENT ON VIEW public.vtutor_class_detail IS 'Tutor view: Detailed class information with students (scoped) and staff';

-- ========================
-- VIEW 3: vtutor_sessions
-- All sessions linked to the tutor through sessions_staff
-- ========================

CREATE OR REPLACE VIEW public.vtutor_sessions
WITH (security_invoker = false)
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
  -- Class details (if applicable)
  c.day_of_week AS class_day_of_week,
  c.start_time AS class_start_time,
  c.end_time AS class_end_time,
  c.room AS class_room,
  c.level AS class_level,
  c.status AS class_status,
  -- Subject details
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.discipline AS subject_discipline,
  sub.level AS subject_level,
  sub.color AS subject_color,
  sub.year_level AS subject_year_level
FROM public.sessions s
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE s.id IN (
  SELECT session_id 
  FROM public.sessions_staff 
  WHERE staff_id = public.current_tutor_id()
);

GRANT SELECT ON public.vtutor_sessions TO authenticated;

COMMENT ON VIEW public.vtutor_sessions IS 'Tutor view: All sessions linked to the tutor via sessions_staff';

-- ========================
-- VIEW 4: vtutor_session_detail
-- Detailed view of a single session with students and staff
-- ========================

CREATE OR REPLACE VIEW public.vtutor_session_detail
WITH (security_invoker = false)
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
  -- Class details
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
  sub.year_level AS subject_year_level,
  -- Students in this session (scoped fields only)
  (
    SELECT json_agg(json_build_object(
      'id', st.id,
      'first_name', st.first_name,
      'last_name', st.last_name,
      'status', st.status,
      'school', st.school,
      'curriculum', st.curriculum,
      'year_level', st.year_level,
      'availability_monday', st.availability_monday,
      'availability_tuesday', st.availability_tuesday,
      'availability_wednesday', st.availability_wednesday,
      'availability_thursday', st.availability_thursday,
      'availability_friday', st.availability_friday,
      'availability_saturday_am', st.availability_saturday_am,
      'availability_saturday_pm', st.availability_saturday_pm,
      'availability_sunday_am', st.availability_sunday_am,
      'availability_sunday_pm', st.availability_sunday_pm,
      'session_student_id', ss.id,
      'planned_absence', ss.planned_absence,
      'is_rescheduled', ss.is_rescheduled,
      'is_credited', ss.is_credited
    ))
    FROM public.sessions_students ss
    JOIN public.students st ON st.id = ss.student_id
    WHERE ss.session_id = s.id
  ) AS students,
  -- Staff in this session (scoped fields)
  (
    SELECT json_agg(json_build_object(
      'id', staff.id,
      'first_name', staff.first_name,
      'last_name', staff.last_name,
      'role', staff.role,
      'status', staff.status,
      'availability_monday', staff.availability_monday,
      'availability_tuesday', staff.availability_tuesday,
      'availability_wednesday', staff.availability_wednesday,
      'availability_thursday', staff.availability_thursday,
      'availability_friday', staff.availability_friday,
      'availability_saturday_am', staff.availability_saturday_am,
      'availability_saturday_pm', staff.availability_saturday_pm,
      'availability_sunday_am', staff.availability_sunday_am,
      'availability_sunday_pm', staff.availability_sunday_pm,
      'session_staff_id', sst.id,
      'type', sst.type,
      'planned_absence', sst.planned_absence,
      'is_swapped', sst.is_swapped
    ))
    FROM public.sessions_staff sst
    JOIN public.staff staff ON staff.id = sst.staff_id
    WHERE sst.session_id = s.id
  ) AS staff
FROM public.sessions s
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE s.id IN (
  SELECT session_id 
  FROM public.sessions_staff 
  WHERE staff_id = public.current_tutor_id()
);

GRANT SELECT ON public.vtutor_session_detail TO authenticated;

COMMENT ON VIEW public.vtutor_session_detail IS 'Tutor view: Detailed session information with students (scoped) and staff (scoped)';

-- ========================
-- VIEW 5: vtutor_tutor_log
-- Tutor logs where tutor is involved (created, attended, or session linked)
-- ========================

CREATE OR REPLACE VIEW public.vtutor_tutor_log
WITH (security_invoker = false)
AS
SELECT 
  tl.id AS tutor_log_id,
  tl.session_id,
  tl.created_at AS tutor_log_created_at,
  tl.updated_at AS tutor_log_updated_at,
  tl.created_by,
  -- Staff attendance (scoped fields)
  (
    SELECT json_agg(json_build_object(
      'id', tlsa.id,
      'staff_id', s.id,
      'first_name', s.first_name,
      'last_name', s.last_name,
      'role', s.role,
      'status', s.status,
      'availability_monday', s.availability_monday,
      'availability_tuesday', s.availability_tuesday,
      'availability_wednesday', s.availability_wednesday,
      'availability_thursday', s.availability_thursday,
      'availability_friday', s.availability_friday,
      'availability_saturday_am', s.availability_saturday_am,
      'availability_saturday_pm', s.availability_saturday_pm,
      'availability_sunday_am', s.availability_sunday_am,
      'availability_sunday_pm', s.availability_sunday_pm,
      'attended', tlsa.attended,
      'type', tlsa.type
    ))
    FROM public.tutor_logs_staff_attendance tlsa
    JOIN public.staff s ON s.id = tlsa.staff_id
    WHERE tlsa.tutor_log_id = tl.id
  ) AS staff_attendance,
  -- Student attendance (scoped fields)
  (
    SELECT json_agg(json_build_object(
      'id', tlsa.id,
      'student_id', st.id,
      'first_name', st.first_name,
      'last_name', st.last_name,
      'status', st.status,
      'school', st.school,
      'curriculum', st.curriculum,
      'year_level', st.year_level,
      'availability_monday', st.availability_monday,
      'availability_tuesday', st.availability_tuesday,
      'availability_wednesday', st.availability_wednesday,
      'availability_thursday', st.availability_thursday,
      'availability_friday', st.availability_friday,
      'availability_saturday_am', st.availability_saturday_am,
      'availability_saturday_pm', st.availability_saturday_pm,
      'availability_sunday_am', st.availability_sunday_am,
      'availability_sunday_pm', st.availability_sunday_pm,
      'attended', tlsa.attended
    ))
    FROM public.tutor_logs_student_attendance tlsa
    JOIN public.students st ON st.id = tlsa.student_id
    WHERE tlsa.tutor_log_id = tl.id
  ) AS student_attendance,
  -- Topics covered
  (
    SELECT json_agg(json_build_object(
      'id', tlt.id,
      'topic_id', t.id,
      'topic_name', t.name,
      'topic_index', t.index,
      'parent_id', t.parent_id,
      'subject_id', t.subject_id,
      'student_ids', (
        SELECT json_agg(tlts.student_id)
        FROM public.tutor_logs_topics_students tlts
        WHERE tlts.tutor_logs_topics_id = tlt.id
      )
    ))
    FROM public.tutor_logs_topics tlt
    JOIN public.topics t ON t.id = tlt.topic_id
    WHERE tlt.tutor_log_id = tl.id
  ) AS topics,
  -- Files used
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
      'bucket', f.bucket,
      'student_ids', (
        SELECT json_agg(tltfs.student_id)
        FROM public.tutor_logs_topics_files_students tltfs
        WHERE tltfs.tutor_logs_topics_files_id = tltf.id
      )
    ))
    FROM public.tutor_logs_topics_files tltf
    JOIN public.topics_files tf ON tf.id = tltf.topics_files_id
    JOIN public.files f ON f.id = tf.file_id
    WHERE tltf.tutor_log_id = tl.id
  ) AS files,
  -- Notes
  (
    SELECT json_agg(json_build_object(
      'id', n.id,
      'note', n.note,
      'created_at', n.created_at,
      'created_by', n.created_by
    ))
    FROM public.notes n
    WHERE n.target_type = 'tutor_logs'
      AND n.target_id = tl.id
  ) AS notes
FROM public.tutor_logs tl
WHERE 
  -- Created by this tutor
  tl.created_by = public.current_tutor_id()
  OR
  -- Tutor is in staff attendance
  tl.id IN (
    SELECT tutor_log_id 
    FROM public.tutor_logs_staff_attendance 
    WHERE staff_id = public.current_tutor_id()
  )
  OR
  -- Session is linked to tutor
  tl.session_id IN (
    SELECT session_id 
    FROM public.sessions_staff 
    WHERE staff_id = public.current_tutor_id()
  );

GRANT SELECT ON public.vtutor_tutor_log TO authenticated;

COMMENT ON VIEW public.vtutor_tutor_log IS 'Tutor view: Tutor logs where tutor is involved (created, attended, or session linked)';

-- ========================
-- VIEW 6: vtutor_profile
-- Tutor's own staff record (all fields)
-- ========================

CREATE OR REPLACE VIEW public.vtutor_profile
WITH (security_invoker = false)
AS
SELECT 
  s.id,
  s.first_name,
  s.last_name,
  s.email,
  s.phone_number as phone,
  s.role,
  s.status,
  s.user_id,
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
FROM public.staff s
WHERE s.id = public.current_tutor_id();

GRANT SELECT ON public.vtutor_profile TO authenticated;

COMMENT ON VIEW public.vtutor_profile IS 'Tutor view: Own staff record (all fields)';

-- ========================
-- VIEW 7: vtutor_subjects
-- All subjects the tutor is authorized to access
-- ========================

CREATE OR REPLACE VIEW public.vtutor_subjects
WITH (security_invoker = false)
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
  -- Direct via staff_subjects
  SELECT subject_id 
  FROM public.staff_subjects 
  WHERE staff_id = public.current_tutor_id()
  
  UNION
  
  -- Indirect via classes (classes.subject_id is direct FK)
  SELECT c.subject_id 
  FROM public.classes c
  JOIN public.classes_staff cs ON cs.class_id = c.id
  WHERE cs.staff_id = public.current_tutor_id()
    AND cs.status = 'ACTIVE'
    AND c.subject_id IS NOT NULL
);

GRANT SELECT ON public.vtutor_subjects TO authenticated;

COMMENT ON VIEW public.vtutor_subjects IS 'Tutor view: All subjects the tutor is authorized to access (direct or via classes)';

-- ========================
-- VIEW 8: vtutor_topics
-- All topics for the tutor's authorized subjects
-- ========================

CREATE OR REPLACE VIEW public.vtutor_topics
WITH (security_invoker = false)
AS
SELECT 
  t.id,
  t.subject_id,
  t.name,
  t.parent_id,
  t.index,
  t.created_at,
  t.updated_at,
  t.created_by
FROM public.topics t
WHERE t.subject_id IN (
  SELECT id FROM public.vtutor_subjects
)
ORDER BY t.subject_id, t.parent_id NULLS FIRST, t.index;

GRANT SELECT ON public.vtutor_topics TO authenticated;

COMMENT ON VIEW public.vtutor_topics IS 'Tutor view: All topics for authorized subjects';

-- ========================
-- VIEW 9: vtutor_topics_files
-- All topics_files for the tutor's authorized topics
-- ========================

CREATE OR REPLACE VIEW public.vtutor_topics_files
WITH (security_invoker = false)
AS
SELECT 
  tf.id,
  tf.topic_id,
  tf.type,
  tf.index,
  tf.file_id,
  tf.is_solutions,
  tf.is_solutions_of_id,
  tf.created_at,
  tf.updated_at,
  tf.created_by,
  -- File details
  f.filename,
  f.mimetype,
  f.size_bytes,
  f.storage_path,
  f.bucket,
  f.storage_provider,
  f.metadata AS file_metadata,
  f.deleted_at
FROM public.topics_files tf
JOIN public.files f ON f.id = tf.file_id
WHERE tf.topic_id IN (
  SELECT id FROM public.vtutor_topics
)
AND f.deleted_at IS NULL
ORDER BY tf.topic_id, tf.type, tf.index;

GRANT SELECT ON public.vtutor_topics_files TO authenticated;

COMMENT ON VIEW public.vtutor_topics_files IS 'Tutor view: All topics_files with file details for authorized topics';

-- ========================
-- SUMMARY
-- ========================

-- Created 2 helper functions:
-- - is_tutor()
-- - current_tutor_id()

-- Created 9 security_definer views:
-- - vtutor_classes
-- - vtutor_class_detail
-- - vtutor_sessions
-- - vtutor_session_detail
-- - vtutor_tutor_log
-- - vtutor_profile
-- - vtutor_subjects
-- - vtutor_topics
-- - vtutor_topics_files

-- All views granted SELECT to authenticated role
-- No direct RLS policies for tutors on base tables
-- Tutors access data through views only (security_definer handles permissions)

