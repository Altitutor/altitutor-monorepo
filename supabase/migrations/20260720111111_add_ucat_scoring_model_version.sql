alter table public.student_question_set_attempts
  add column if not exists scoring_model_version text;

alter table public.student_ucat_mock_attempts
  add column if not exists scoring_model_version text;

comment on column public.student_question_set_attempts.scoring_model_version is
  'Version of the shared UCAT scoring authority that produced scaled_score; null for historical, unscored, or multi-section attempts.';

comment on column public.student_ucat_mock_attempts.scoring_model_version is
  'Version of the shared UCAT scoring authority used by the constituent section estimates; null for historical or unscored attempts.';
