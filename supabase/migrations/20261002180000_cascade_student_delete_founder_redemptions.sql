-- Admin student delete expects related rows to cascade. Founder redemptions
-- referenced students with the default NO ACTION, so deleting a student who
-- had claimed a founder offer failed with 23503.

ALTER TABLE public.ucat_founder_redemptions
  DROP CONSTRAINT ucat_founder_redemptions_student_id_fkey;

ALTER TABLE public.ucat_founder_redemptions
  ADD CONSTRAINT ucat_founder_redemptions_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
