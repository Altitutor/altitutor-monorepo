-- Migration: Remove student RLS policies
-- Description:
--  Remove RLS policies that allow students direct access to base tables.
--  Students should only access data through views and write through API routes.

-- ================================================
-- REMOVE STUDENT RLS POLICIES ON STUDENTS TABLE
-- ================================================

DROP POLICY IF EXISTS "Students can view own profile" ON public.students;
DROP POLICY IF EXISTS "Students can update own profile fields" ON public.students;

-- ================================================
-- REMOVE STUDENT RLS POLICIES ON STUDENT_PAYMENT_METHODS TABLE
-- ================================================

DROP POLICY IF EXISTS "Students can view own payment methods" ON public.student_payment_methods;

-- ================================================
-- COMMENTS
-- ================================================

COMMENT ON TABLE public.students IS 'Students table - only ADMINSTAFF can access directly. Students access via vstudent_* views and write via API routes.';
COMMENT ON TABLE public.student_payment_methods IS 'Student payment methods - only ADMINSTAFF can access directly. Students access via vstudent_billing view.';

