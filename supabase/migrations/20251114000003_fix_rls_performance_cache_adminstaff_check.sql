-- ========================
-- FIX RLS PERFORMANCE: Cache is_adminstaff_active() calls
-- ========================
-- 
-- Problem: is_adminstaff_active() was being called once PER ROW in nested queries,
-- causing hundreds of staff table queries per page load
--
-- Solution: Wrap function calls in SELECT to cache result once per query
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#performance
--
-- Impact: Reduces staff table queries from 500+ to ~10 per communications page load

-- ========================
-- PARENTS TABLE
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to parents" ON public.parents;
CREATE POLICY "ADMINSTAFF full access to parents" ON public.parents
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- ========================
-- PARENTS_STUDENTS TABLE
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to parents_students" ON public.parents_students;
CREATE POLICY "ADMINSTAFF full access to parents_students" ON public.parents_students
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- ========================
-- CONTACTS TABLE
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to contacts" ON public.contacts;
CREATE POLICY "ADMINSTAFF full access to contacts" ON public.contacts
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- ========================
-- OWNED_NUMBERS TABLE
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to owned_numbers" ON public.owned_numbers;
CREATE POLICY "ADMINSTAFF full access to owned_numbers" ON public.owned_numbers
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- ========================
-- CONVERSATIONS TABLE
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to conversations" ON public.conversations;
CREATE POLICY "ADMINSTAFF full access to conversations" ON public.conversations
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- ========================
-- MESSAGES TABLE
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to messages" ON public.messages;
CREATE POLICY "ADMINSTAFF full access to messages" ON public.messages
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- ========================
-- CONVERSATION_READS TABLE
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to conversation_reads" ON public.conversation_reads;
CREATE POLICY "ADMINSTAFF full access to conversation_reads" ON public.conversation_reads
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- ========================
-- MESSAGE_TEMPLATES TABLE (if exists)
-- ========================
DROP POLICY IF EXISTS "ADMINSTAFF full access to message_templates" ON public.message_templates;
CREATE POLICY "ADMINSTAFF full access to message_templates" ON public.message_templates
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

-- ========================
-- VERIFICATION
-- ========================
-- To verify the fix works, run:
-- EXPLAIN ANALYZE SELECT * FROM conversations WHERE id = 'some-uuid';
-- 
-- Before fix: Many nested loops with staff table lookups
-- After fix: Single staff table lookup at query start


