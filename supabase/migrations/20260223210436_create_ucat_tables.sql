-- ========================
-- UCAT System - Base Tables
-- Question domain, sets, mocks, progress tracking, in-person management
-- ========================

-- Question type enum for questions table
DO $$ BEGIN
  CREATE TYPE public.ucat_question_type AS ENUM ('multiple_choice', 'syllogism');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ========================
-- ucat_sections
-- ========================
CREATE TABLE IF NOT EXISTS public.ucat_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description JSONB,
  display_columns INTEGER NOT NULL CHECK (display_columns IN (1, 2)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id)
);

CREATE INDEX IF NOT EXISTS idx_ucat_sections_section_number ON public.ucat_sections(section_number);

-- ========================
-- question_stem_categories (self-hierarchical, scoped to section)
-- ========================
CREATE TABLE IF NOT EXISTS public.question_stem_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description JSONB,
  ucat_section_id UUID REFERENCES public.ucat_sections(id) ON DELETE CASCADE,
  parent_question_stem_category_id UUID REFERENCES public.question_stem_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id)
);

CREATE INDEX IF NOT EXISTS idx_question_stem_categories_section ON public.question_stem_categories(ucat_section_id);
CREATE INDEX IF NOT EXISTS idx_question_stem_categories_parent ON public.question_stem_categories(parent_question_stem_category_id);

-- ========================
-- question_stems
-- ========================
CREATE TABLE IF NOT EXISTS public.question_stems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.ucat_sections(id) ON DELETE CASCADE,
  stem_text JSONB NOT NULL,
  question_stem_category_id UUID REFERENCES public.question_stem_categories(id) ON DELETE SET NULL,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id)
);

CREATE INDEX IF NOT EXISTS idx_question_stems_section ON public.question_stems(section_id);
CREATE INDEX IF NOT EXISTS idx_question_stems_category ON public.question_stems(question_stem_category_id);
CREATE INDEX IF NOT EXISTS idx_question_stems_is_private ON public.question_stems(is_private);

-- ========================
-- questions
-- ========================
CREATE TABLE IF NOT EXISTS public.ucat_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_stem_id UUID NOT NULL REFERENCES public.question_stems(id) ON DELETE CASCADE,
  question_text JSONB NOT NULL,
  index INTEGER NOT NULL,
  difficulty NUMERIC(3,2) CHECK (difficulty >= 0 AND difficulty <= 1),
  time_burden_seconds INTEGER,
  question_type public.ucat_question_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id)
);

CREATE INDEX IF NOT EXISTS idx_ucat_questions_stem ON public.ucat_questions(question_stem_id);

-- ========================
-- question_answer_options
-- ========================
CREATE TABLE IF NOT EXISTS public.question_answer_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.ucat_questions(id) ON DELETE CASCADE,
  answer_text JSONB NOT NULL,
  answer_explanation JSONB,
  index INTEGER NOT NULL,
  is_answer BOOLEAN NOT NULL DEFAULT false,
  image_file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id)
);

CREATE INDEX IF NOT EXISTS idx_question_answer_options_question ON public.question_answer_options(question_id);

-- ========================
-- question_tags (self-hierarchical)
-- ========================
CREATE TABLE IF NOT EXISTS public.question_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description JSONB,
  parent_question_tag_id UUID REFERENCES public.question_tags(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id)
);

CREATE INDEX IF NOT EXISTS idx_question_tags_parent ON public.question_tags(parent_question_tag_id);

-- ========================
-- questions_question_tags (join)
-- ========================
CREATE TABLE IF NOT EXISTS public.questions_question_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.ucat_questions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.question_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  UNIQUE(question_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_questions_question_tags_question ON public.questions_question_tags(question_id);
CREATE INDEX IF NOT EXISTS idx_questions_question_tags_tag ON public.questions_question_tags(tag_id);

-- ========================
-- questions_files (trigger-maintained join: which files belong to which questions)
-- ========================
CREATE TABLE IF NOT EXISTS public.questions_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.ucat_questions(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  UNIQUE(question_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_questions_files_question ON public.questions_files(question_id);
CREATE INDEX IF NOT EXISTS idx_questions_files_file ON public.questions_files(file_id);

-- ========================
-- question_sets
-- ========================
CREATE TABLE IF NOT EXISTS public.question_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description JSONB,
  time_limit_seconds INTEGER,
  is_student_generated BOOLEAN NOT NULL DEFAULT false,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id)
);

-- ========================
-- questions_sets (questions in a set with order)
-- ========================
CREATE TABLE IF NOT EXISTS public.questions_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.ucat_questions(id) ON DELETE CASCADE,
  question_set_id UUID NOT NULL REFERENCES public.question_sets(id) ON DELETE CASCADE,
  index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id)
);

CREATE INDEX IF NOT EXISTS idx_questions_sets_set ON public.questions_sets(question_set_id);
CREATE INDEX IF NOT EXISTS idx_questions_sets_question ON public.questions_sets(question_id);

-- ========================
-- ucat_mocks (mock = 3 consecutive sets)
-- ========================
CREATE TABLE IF NOT EXISTS public.ucat_mocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id)
);

-- ========================
-- question_sets_ucat_mocks (sets in a mock with order)
-- ========================
CREATE TABLE IF NOT EXISTS public.question_sets_ucat_mocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_set_id UUID NOT NULL REFERENCES public.question_sets(id) ON DELETE CASCADE,
  ucat_mock_id UUID NOT NULL REFERENCES public.ucat_mocks(id) ON DELETE CASCADE,
  index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id)
);

CREATE INDEX IF NOT EXISTS idx_question_sets_ucat_mocks_mock ON public.question_sets_ucat_mocks(ucat_mock_id);
CREATE INDEX IF NOT EXISTS idx_question_sets_ucat_mocks_set ON public.question_sets_ucat_mocks(question_set_id);

-- ========================
-- Progress / live set taking
-- ========================

-- student_ucat_mock_attempts
CREATE TABLE IF NOT EXISTS public.student_ucat_mock_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  ucat_mock_id UUID NOT NULL REFERENCES public.ucat_mocks(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_student_ucat_mock_attempts_student ON public.student_ucat_mock_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_student_ucat_mock_attempts_mock ON public.student_ucat_mock_attempts(ucat_mock_id);

-- student_question_set_attempts
CREATE TABLE IF NOT EXISTS public.student_question_set_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  question_set_id UUID NOT NULL REFERENCES public.question_sets(id) ON DELETE CASCADE,
  score_points NUMERIC,
  total_points NUMERIC,
  scaled_score NUMERIC,
  time_taken_seconds INTEGER,
  student_ucat_mock_attempt_id UUID REFERENCES public.student_ucat_mock_attempts(id) ON DELETE SET NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_student_question_set_attempts_student ON public.student_question_set_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_student_question_set_attempts_set ON public.student_question_set_attempts(question_set_id);
CREATE INDEX IF NOT EXISTS idx_student_question_set_attempts_mock ON public.student_question_set_attempts(student_ucat_mock_attempt_id);

-- student_question_attempts
CREATE TABLE IF NOT EXISTS public.student_question_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_question_set_attempt_id UUID NOT NULL REFERENCES public.student_question_set_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.ucat_questions(id) ON DELETE CASCADE,
  question_answer_option_id UUID REFERENCES public.question_answer_options(id) ON DELETE SET NULL,
  answer_snapshot JSONB,
  score NUMERIC NOT NULL DEFAULT 0,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  is_submitted BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_spent_seconds INTEGER
);

CREATE INDEX IF NOT EXISTS idx_student_question_attempts_student ON public.student_question_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_student_question_attempts_set_attempt ON public.student_question_attempts(student_question_set_attempt_id);
CREATE INDEX IF NOT EXISTS idx_student_question_attempts_question ON public.student_question_attempts(question_id);

-- ========================
-- In-person management: assign sets/mocks to sessions
-- ========================

-- question_sets_sessions
CREATE TABLE IF NOT EXISTS public.question_sets_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_set_id UUID NOT NULL REFERENCES public.question_sets(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id),
  UNIQUE(question_set_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_question_sets_sessions_set ON public.question_sets_sessions(question_set_id);
CREATE INDEX IF NOT EXISTS idx_question_sets_sessions_session ON public.question_sets_sessions(session_id);

-- mocks_sessions
CREATE TABLE IF NOT EXISTS public.mocks_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ucat_mock_id UUID NOT NULL REFERENCES public.ucat_mocks(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.staff(id),
  UNIQUE(ucat_mock_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_mocks_sessions_mock ON public.mocks_sessions(ucat_mock_id);
CREATE INDEX IF NOT EXISTS idx_mocks_sessions_session ON public.mocks_sessions(session_id);

-- ========================
-- updated_at triggers (function already exists from earlier migrations)
-- ========================

-- Apply update_updated_at to UCAT tables with updated_at
CREATE TRIGGER set_updated_at_ucat_sections
  BEFORE UPDATE ON public.ucat_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_question_stem_categories
  BEFORE UPDATE ON public.question_stem_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_question_stems
  BEFORE UPDATE ON public.question_stems FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_ucat_questions
  BEFORE UPDATE ON public.ucat_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_question_answer_options
  BEFORE UPDATE ON public.question_answer_options FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_question_tags
  BEFORE UPDATE ON public.question_tags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_questions_sets
  BEFORE UPDATE ON public.questions_sets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_question_sets
  BEFORE UPDATE ON public.question_sets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_ucat_mocks
  BEFORE UPDATE ON public.ucat_mocks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_question_sets_ucat_mocks
  BEFORE UPDATE ON public.question_sets_ucat_mocks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_question_sets_sessions
  BEFORE UPDATE ON public.question_sets_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_updated_at_mocks_sessions
  BEFORE UPDATE ON public.mocks_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
