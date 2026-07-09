CREATE TYPE public.form_access_type AS ENUM ('public_link', 'authenticated');
CREATE TYPE public.form_submission_limit AS ENUM (
  'one_per_token',
  'one_per_authenticated_respondent',
  'unlimited'
);
CREATE TYPE public.form_status AS ENUM ('draft', 'published', 'archived');

CREATE TABLE public.forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  purpose text NOT NULL DEFAULT 'other',
  status public.form_status NOT NULL DEFAULT 'draft',
  access_type public.form_access_type NOT NULL DEFAULT 'public_link',
  submission_limit public.form_submission_limit NOT NULL DEFAULT 'unlimited',
  draft_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  draft_thank_you_message text NOT NULL DEFAULT 'Thanks for your response.',
  latest_published_version_id uuid NULL,
  created_by uuid NULL REFERENCES public.staff(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz NULL,
  CONSTRAINT forms_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT forms_purpose_slug CHECK (purpose ~ '^[a-z0-9_:-]+$'),
  CONSTRAINT forms_draft_blocks_array CHECK (jsonb_typeof(draft_blocks) = 'array')
);

CREATE TABLE public.form_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  blocks jsonb NOT NULL,
  thank_you_message text NOT NULL DEFAULT 'Thanks for your response.',
  published_by uuid NULL REFERENCES public.staff(id) ON DELETE SET NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT form_versions_blocks_array CHECK (jsonb_typeof(blocks) = 'array'),
  CONSTRAINT form_versions_version_positive CHECK (version_number > 0),
  CONSTRAINT form_versions_form_version_unique UNIQUE (form_id, version_number)
);

ALTER TABLE public.forms
  ADD CONSTRAINT forms_latest_published_version_id_fkey
  FOREIGN KEY (latest_published_version_id)
  REFERENCES public.form_versions(id)
  ON DELETE SET NULL;

CREATE TABLE public.form_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  form_version_id uuid NOT NULL REFERENCES public.form_versions(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  access_type public.form_access_type NOT NULL,
  submission_limit public.form_submission_limit NOT NULL,
  expires_at timestamptz NULL,
  revoked_at timestamptz NULL,
  created_by uuid NULL REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT form_tokens_hash_not_blank CHECK (length(trim(token_hash)) > 0),
  CONSTRAINT form_tokens_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE public.form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  form_version_id uuid NOT NULL REFERENCES public.form_versions(id) ON DELETE RESTRICT,
  form_token_id uuid NULL REFERENCES public.form_tokens(id) ON DELETE SET NULL,
  respondent_type text NOT NULL DEFAULT 'anonymous',
  respondent_student_id uuid NULL REFERENCES public.students(id) ON DELETE SET NULL,
  respondent_staff_id uuid NULL REFERENCES public.staff(id) ON DELETE SET NULL,
  respondent_parent_id uuid NULL REFERENCES public.parents(id) ON DELETE SET NULL,
  subject_type text NOT NULL DEFAULT 'none',
  subject_student_id uuid NULL REFERENCES public.students(id) ON DELETE SET NULL,
  subject_staff_id uuid NULL REFERENCES public.staff(id) ON DELETE SET NULL,
  subject_parent_id uuid NULL REFERENCES public.parents(id) ON DELETE SET NULL,
  submitted_by_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  response_json jsonb NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  deleted_by uuid NULL REFERENCES public.staff(id) ON DELETE SET NULL,
  delete_reason text NULL,
  CONSTRAINT form_responses_response_object CHECK (jsonb_typeof(response_json) = 'object'),
  CONSTRAINT form_responses_respondent_type_slug CHECK (respondent_type ~ '^[a-z0-9_:-]+$'),
  CONSTRAINT form_responses_subject_type_slug CHECK (subject_type ~ '^[a-z0-9_:-]+$')
);

CREATE TABLE public.form_response_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_response_id uuid NOT NULL REFERENCES public.form_responses(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  form_version_id uuid NOT NULL REFERENCES public.form_versions(id) ON DELETE RESTRICT,
  question_id text NOT NULL,
  question_label_snapshot text NOT NULL,
  question_type text NOT NULL,
  choice_value text NULL,
  choice_label_snapshot text NULL,
  choice_values jsonb NULL,
  text_value text NULL,
  number_value numeric NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT form_response_answers_question_id_not_blank CHECK (length(trim(question_id)) > 0),
  CONSTRAINT form_response_answers_choice_values_array CHECK (
    choice_values IS NULL OR jsonb_typeof(choice_values) = 'array'
  )
);

CREATE INDEX forms_status_idx ON public.forms(status);
CREATE INDEX forms_purpose_idx ON public.forms(purpose);
CREATE INDEX form_versions_form_id_idx ON public.form_versions(form_id);
CREATE INDEX form_tokens_form_version_id_idx ON public.form_tokens(form_version_id);
CREATE INDEX form_responses_form_version_submitted_idx ON public.form_responses(form_version_id, submitted_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX form_responses_respondent_student_idx ON public.form_responses(respondent_student_id)
  WHERE respondent_student_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX form_responses_respondent_staff_idx ON public.form_responses(respondent_staff_id)
  WHERE respondent_staff_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX form_response_answers_form_version_question_idx
  ON public.form_response_answers(form_version_id, question_id);

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_response_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMINSTAFF full access to forms" ON public.forms
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

CREATE POLICY "ADMINSTAFF full access to form_versions" ON public.form_versions
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

CREATE POLICY "ADMINSTAFF full access to form_tokens" ON public.form_tokens
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

CREATE POLICY "ADMINSTAFF full access to form_responses" ON public.form_responses
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

CREATE POLICY "ADMINSTAFF full access to form_response_answers" ON public.form_response_answers
  FOR ALL TO authenticated
  USING (public.is_adminstaff())
  WITH CHECK (public.is_adminstaff());

COMMENT ON TABLE public.forms IS 'Staff-defined forms. Draft content is mutable; published content is stored immutably in form_versions.';
COMMENT ON TABLE public.form_versions IS 'Immutable published form definitions answered by respondents.';
COMMENT ON TABLE public.form_tokens IS 'Hashed respondent route tokens for /form/[token]. Raw tokens are never stored.';
COMMENT ON TABLE public.form_responses IS 'Submitted form responses. Answers are immutable; admin deletion is soft-delete only.';
COMMENT ON TABLE public.form_response_answers IS 'Normalized answer rows for filtering and reports, derived from form_responses.response_json.';
