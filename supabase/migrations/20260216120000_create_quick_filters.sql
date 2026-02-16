-- Create quick_filters table
create table public.quick_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- null = global
  target_entity text not null,                              -- e.g., 'tasks', 'students'
  name text not null,                                       -- e.g., 'Active assigned to me'
  config jsonb not null,                                    -- e.g., {"assigned_to": ["$ME$"], "status": ["todo", "in_progress"]}
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Add indexes
create index quick_filters_target_entity_idx on public.quick_filters (target_entity);
create index quick_filters_user_id_idx on public.quick_filters (user_id);

-- Enable RLS
alter table public.quick_filters enable row level security;

-- RLS Policies

-- ADMINSTAFF can do everything
create policy "Adminstaff can manage all quick filters"
  on public.quick_filters
  for all
  to authenticated
  using (
    (select role from public.staff where id = (select auth.uid())) = 'ADMINSTAFF'
  )
  with check (
    (select role from public.staff where id = (select auth.uid())) = 'ADMINSTAFF'
  );

-- Regular users can read global filters and their own filters
create policy "Users can read global and their own quick filters"
  on public.quick_filters
  for select
  to authenticated
  using (
    user_id is null or user_id = (select auth.uid())
  );

-- Regular users can manage their own filters
create policy "Users can manage their own quick filters"
  on public.quick_filters
  for all
  to authenticated
  using (
    user_id = (select auth.uid())
  )
  with check (
    user_id = (select auth.uid())
  );

-- Trigger for updated_at
create trigger update_quick_filters_updated_at
  before update on public.quick_filters
  for each row
  execute function public.update_updated_at();
