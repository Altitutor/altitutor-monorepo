create table public.ucat_score_projection_snapshots (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  snapshot_date date not null,
  current_estimate integer not null,
  confidence text not null,
  uncertainty integer not null,
  effective_evidence_weight double precision not null,
  section_estimates jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ucat_score_projection_snapshots_student_date_key
    unique (student_id, snapshot_date),
  constraint ucat_score_projection_snapshots_estimate_check
    check (current_estimate between 900 and 2700),
  constraint ucat_score_projection_snapshots_confidence_check
    check (confidence in ('low', 'medium', 'high')),
  constraint ucat_score_projection_snapshots_uncertainty_check
    check (uncertainty >= 0),
  constraint ucat_score_projection_snapshots_evidence_check
    check (effective_evidence_weight >= 0),
  constraint ucat_score_projection_snapshots_sections_check
    check (jsonb_typeof(section_estimates) = 'object')
);

create index ucat_score_projection_snapshots_student_history_idx
  on public.ucat_score_projection_snapshots (student_id, snapshot_date desc);

comment on table public.ucat_score_projection_snapshots is
  'One trusted daily snapshot of the total UCAT score estimate shown to a student. Used for honest historical trajectory charts instead of recomputing past predictions with today''s model.';
comment on column public.ucat_score_projection_snapshots.section_estimates is
  'Cognitive-section estimates keyed by section ID at the time of the snapshot.';

alter table public.ucat_score_projection_snapshots enable row level security;

-- Projection snapshots are written and read through the authenticated server
-- route with the service role. Students never write projection history through
-- the Data API, which prevents a browser client from fabricating its trend.
revoke all on table public.ucat_score_projection_snapshots from anon, authenticated;
grant select, insert, update, delete on table public.ucat_score_projection_snapshots to service_role;

create trigger update_ucat_score_projection_snapshots_updated_at
  before update on public.ucat_score_projection_snapshots
  for each row
  execute function public.update_updated_at();
