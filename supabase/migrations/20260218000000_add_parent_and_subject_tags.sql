-- Description: Add parent_id and subject_id to issue_tags, update constraints and indexes

-- 1. Add columns
ALTER TABLE public.issue_tags 
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.parents(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE;

-- 2. Update the one-entity constraint
-- First drop the old one
ALTER TABLE public.issue_tags DROP CONSTRAINT IF EXISTS issue_tags_one_entity_check;

-- Add the new one including parent_id and subject_id
ALTER TABLE public.issue_tags ADD CONSTRAINT issue_tags_one_entity_check CHECK (
  (
    (student_id IS NOT NULL)::integer + 
    (staff_id IS NOT NULL)::integer + 
    (class_id IS NOT NULL)::integer + 
    (session_id IS NOT NULL)::integer + 
    (invoice_id IS NOT NULL)::integer + 
    (message_id IS NOT NULL)::integer + 
    (conversation_id IS NOT NULL)::integer +
    (parent_id IS NOT NULL)::integer +
    (subject_id IS NOT NULL)::integer
  ) = 1
);

-- 3. Add indexes
CREATE INDEX IF NOT EXISTS idx_issue_tags_parent_id ON public.issue_tags(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_issue_tags_subject_id ON public.issue_tags(subject_id) WHERE subject_id IS NOT NULL;
