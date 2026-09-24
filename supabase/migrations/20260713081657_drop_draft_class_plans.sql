-- Migration: Drop draft class planner tables
-- Description:
--   Remove the unused class planner feature schema:
--   - draft_classes_staff
--   - draft_classes_students
--   - draft_classes
--   - draft_class_plan_slots
--   - draft_class_plans
--   Triggers and RLS policies are dropped with the tables.
--   public.set_updated_at() is shared and intentionally retained.

-- ========================
-- DROP DRAFT CLASS PLANNER TABLES
-- ========================
-- Drop dependent tables first, then the plan container.
DROP TABLE IF EXISTS public.draft_classes_staff CASCADE;
DROP TABLE IF EXISTS public.draft_classes_students CASCADE;
DROP TABLE IF EXISTS public.draft_classes CASCADE;
DROP TABLE IF EXISTS public.draft_class_plan_slots CASCADE;
DROP TABLE IF EXISTS public.draft_class_plans CASCADE;
