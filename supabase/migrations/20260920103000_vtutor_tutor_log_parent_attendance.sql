-- Expose parent attendance on the tutor tutor-log view so tutor-web can
-- render meeting/check-in parents from vtutor_* views instead of base tables.
-- New column is appended: CREATE OR REPLACE VIEW cannot insert columns in the
-- middle of an existing view's column list.

CREATE OR REPLACE VIEW public.vtutor_tutor_log
WITH (security_invoker = false)
AS
SELECT
  tl.id AS tutor_log_id,
  tl.session_id,
  tl.created_at AS tutor_log_created_at,
  tl.updated_at AS tutor_log_updated_at,
  tl.created_by,
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
  (
    SELECT json_agg(
      json_build_object(
        'id', n.id,
        'note', n.note,
        'created_at', n.created_at,
        'created_by', n.created_by
      ) ORDER BY n.created_at ASC
    )
    FROM public.notes n
    WHERE n.target_type = 'sessions'
      AND n.target_id = tl.session_id
  ) AS notes,
  tl.logged_for_staff_id,
  tl.updated_by,
  submitter.first_name AS created_by_first_name,
  submitter.last_name AS created_by_last_name,
  logged_for.first_name AS logged_for_first_name,
  logged_for.last_name AS logged_for_last_name,
  editor.first_name AS updated_by_first_name,
  editor.last_name AS updated_by_last_name,
  (
    SELECT json_agg(json_build_object(
      'parent_id', parent.id,
      'first_name', parent.first_name,
      'last_name', parent.last_name,
      'attended', attendance.attended
    ))
    FROM public.tutor_logs_parent_attendance attendance
    JOIN public.parents parent ON parent.id = attendance.parent_id
    WHERE attendance.tutor_log_id = tl.id
  ) AS parent_attendance
FROM public.tutor_logs tl
LEFT JOIN public.staff submitter ON submitter.id = tl.created_by
LEFT JOIN public.staff logged_for ON logged_for.id = tl.logged_for_staff_id
LEFT JOIN public.staff editor ON editor.id = tl.updated_by
WHERE
  tl.created_by = public.current_tutor_id()
  OR tl.logged_for_staff_id = public.current_tutor_id()
  OR tl.id IN (
    SELECT tutor_log_id
    FROM public.tutor_logs_staff_attendance
    WHERE staff_id = public.current_tutor_id()
  )
  OR tl.session_id IN (
    SELECT session_id
    FROM public.sessions_staff
    WHERE staff_id = public.current_tutor_id()
  );

GRANT SELECT ON public.vtutor_tutor_log TO authenticated;
