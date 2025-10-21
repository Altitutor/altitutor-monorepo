-- Drop student_classes_view if it exists, regardless of being materialized or not
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'student_classes_view'
  ) THEN
    EXECUTE 'DROP MATERIALIZED VIEW IF EXISTS public.student_classes_view CASCADE';
  ELSIF EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'student_classes_view'
  ) THEN
    EXECUTE 'DROP VIEW IF EXISTS public.student_classes_view CASCADE';
  END IF;
END$$;


