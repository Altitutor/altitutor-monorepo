-- Migration: Update Students Without Classes View
-- Description:
--  - Modify vadmin_reconciliation_students_without_classes to return one row per student-subject combination
--  - Filter to ACTIVE students only (not CURRENT or TRIAL)
--  - Check that student doesn't have an active class for that specific subject
--  - Drop unused views: vadmin_billing_with_payment_methods and vadmin_reconciliation_orphaned_invoice_items
-- Purpose: Enable reconciliation dashboard to show students who need classes for specific subjects

-- Drop unused views
DROP VIEW IF EXISTS public.vadmin_billing_with_payment_methods;
DROP VIEW IF EXISTS public.vadmin_reconciliation_orphaned_invoice_items;

-- Drop the old view
DROP VIEW IF EXISTS public.vadmin_reconciliation_students_without_classes;

-- Create new view with one row per student-subject combination
CREATE OR REPLACE VIEW public.vadmin_reconciliation_students_without_classes
WITH (security_invoker = false)
AS
SELECT 
  st.id AS student_id,
  st.first_name,
  st.last_name,
  st.status AS student_status,
  -- Subject information (one row per subject)
  sub.id AS subject_id,
  sub.name AS subject_name,
  sub.curriculum AS subject_curriculum,
  sub.year_level AS subject_year_level,
  -- Metadata
  st.created_at,
  st.updated_at
FROM public.students st
JOIN public.students_subjects ss ON ss.student_id = st.id
JOIN public.subjects sub ON sub.id = ss.subject_id
WHERE 
  st.status = 'ACTIVE'  -- Only ACTIVE students
  AND NOT EXISTS (
    -- Not enrolled in any active class for this specific subject
    SELECT 1 FROM public.classes_students cs
    JOIN public.classes c ON c.id = cs.class_id
    WHERE cs.student_id = st.id 
      AND cs.unenrolled_at IS NULL
      AND c.status = 'ACTIVE'
      AND c.subject_id = sub.id  -- Check for this specific subject
  );

GRANT SELECT ON public.vadmin_reconciliation_students_without_classes TO authenticated;

COMMENT ON VIEW public.vadmin_reconciliation_students_without_classes IS 
  'Admin view: One row per student-subject combination where student has subject assigned but no active class for that subject (ACTIVE students only)';
