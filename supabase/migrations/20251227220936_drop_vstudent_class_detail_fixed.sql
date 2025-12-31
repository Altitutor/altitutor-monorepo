-- Migration: Drop deprecated vstudent_class_detail_fixed view
-- Description:
--  vstudent_class_detail_fixed is redundant with vstudent_class_detail and is not referenced by the app.
--  Drop without CASCADE so we fail loudly if anything still depends on it.

DROP VIEW IF EXISTS public.vstudent_class_detail_fixed;




