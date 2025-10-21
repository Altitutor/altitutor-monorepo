-- Drop student_classes_view if it exists (handles both regular and materialized)

DROP MATERIALIZED VIEW IF EXISTS public.student_classes_view CASCADE;
DROP VIEW IF EXISTS public.student_classes_view CASCADE;


