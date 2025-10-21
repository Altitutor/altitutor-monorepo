-- Fix: Ensure helper functions and policies can resolve current user's staff role
-- Context: After migrating to role-based RLS, policies rely on checking the
-- current user's role via the staff table. Without a self-read policy on staff,
-- these checks may fail and appear as if ADMINSTAFF is not recognized, which
-- then hides staff in nested joins (e.g., classes_staff → staff).

-- Idempotent: enable RLS if not already enabled (safe if already enabled)
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to read their own staff row. This unblocks
-- role resolution for helper functions (public.is_adminstaff/is_tutor) and
-- for policies that do EXISTS() checks against staff.
CREATE POLICY IF NOT EXISTS "Self can read own staff row" ON public.staff
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Optional note: ADMINSTAFF full-access staff policy remains in place to allow
-- ADMINSTAFF to see all staff once the above self-read check confirms their role.


