create table public.admin_ai_chat_settings (
  id boolean primary key default true check (id),
  model_profile_id uuid references public.ucat_ai_generation_model_profiles(id) on delete set null,
  system_prompt text not null check (char_length(trim(system_prompt)) between 1 and 8000)
);

insert into public.admin_ai_chat_settings (system_prompt)
values ('You are Altitutor’s assistant for staff. Use the available tools when an answer depends on Altitutor records. Explain data gaps, distinguish missing data from zero, and link to relevant records when available.');

alter table public.admin_ai_chat_settings enable row level security;
revoke all on public.admin_ai_chat_settings from public, anon, authenticated;
grant select, update on public.admin_ai_chat_settings to authenticated;

create policy admin_ai_chat_settings_read on public.admin_ai_chat_settings
for select to authenticated
using ((select public.is_adminstaff_active()) and nullif((select auth.jwt())->>'client_id', '') is null);

create policy admin_ai_chat_settings_update on public.admin_ai_chat_settings
for update to authenticated
using ((select public.is_adminstaff_active()) and nullif((select auth.jwt())->>'client_id', '') is null)
with check ((select public.is_adminstaff_active()) and nullif((select auth.jwt())->>'client_id', '') is null);

create table public.admin_ai_chat_threads (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 120),
  messages jsonb not null check (
    jsonb_typeof(messages) = 'array' and jsonb_array_length(messages) <= 40
    and octet_length(messages::text) <= 512000
  ),
  updated_at timestamptz not null default now()
);

create index admin_ai_chat_threads_user_updated_idx
on public.admin_ai_chat_threads (user_id, updated_at desc);

alter table public.admin_ai_chat_threads enable row level security;
revoke all on public.admin_ai_chat_threads from public, anon, authenticated;
grant select, insert, update, delete on public.admin_ai_chat_threads to authenticated;

create policy admin_ai_chat_threads_owner on public.admin_ai_chat_threads
for all to authenticated
using (
  user_id = (select auth.uid()) and (select public.is_adminstaff_active())
  and nullif((select auth.jwt())->>'client_id', '') is null
)
with check (
  user_id = (select auth.uid()) and (select public.is_adminstaff_active())
  and nullif((select auth.jwt())->>'client_id', '') is null
);
