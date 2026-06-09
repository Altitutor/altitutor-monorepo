-- Optional section link for root-level question tags only.
-- Child tags inherit section from their root ancestor in application logic.

ALTER TABLE public.question_tags
  ADD COLUMN IF NOT EXISTS ucat_section_id UUID REFERENCES public.ucat_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_question_tags_section ON public.question_tags(ucat_section_id);

ALTER TABLE public.question_tags
  DROP CONSTRAINT IF EXISTS question_tags_section_root_only;

ALTER TABLE public.question_tags
  ADD CONSTRAINT question_tags_section_root_only
  CHECK (
    parent_question_tag_id IS NULL
    OR ucat_section_id IS NULL
  );

COMMENT ON COLUMN public.question_tags.ucat_section_id IS
  'Optional UCAT section for root tags only. Child tags inherit via parent chain.';

-- Preserve prior name-matched section grouping for existing root tags.
UPDATE public.question_tags qt
SET ucat_section_id = us.id
FROM public.ucat_sections us
WHERE qt.parent_question_tag_id IS NULL
  AND qt.ucat_section_id IS NULL
  AND qt.name = us.name;
