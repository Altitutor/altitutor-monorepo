-- Stem delivery has its own optimistic-concurrency boundary. Session
-- last_activity_at also changes for answer/timing autosaves, so using it as a
-- stem-delivery token causes unrelated writes to reject the next stem.
alter table public.student_practice_sessions
add column stem_delivery_revision bigint not null default 0;

alter table public.student_practice_sessions
add constraint student_practice_sessions_stem_delivery_revision_nonnegative
check (stem_delivery_revision >= 0);
