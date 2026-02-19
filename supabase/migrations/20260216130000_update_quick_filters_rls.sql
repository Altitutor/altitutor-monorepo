-- Update RLS policies for quick_filters to only allow ADMINSTAFF full access
-- This migration removes previous policies and adds a single one for ADMINSTAFF

-- Drop existing policies
drop policy if exists "Adminstaff can manage all quick filters" on public.quick_filters;
drop policy if exists "Users can read global and their own quick filters" on public.quick_filters;
drop policy if exists "Users can manage their own quick filters" on public.quick_filters;

-- Create single policy for ADMINSTAFF
create policy "Adminstaff full access to quick filters"
  on public.quick_filters
  to authenticated
  using (
  ( SELECT is_adminstaff_active() AS is_adminstaff_active) 
   )
  with check (
  ( SELECT is_adminstaff_active() AS is_adminstaff_active)
    );