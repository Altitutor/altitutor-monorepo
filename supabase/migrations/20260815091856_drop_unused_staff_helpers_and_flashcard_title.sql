-- Drop leftover role helpers that the Oct 2025 ADMINSTAFF/tutor facade
-- cutover replaced, and remove the flashcards.title column that
-- 20260623133000 already dropped on a clean replay.
--
-- Live access checks are public.is_adminstaff_active() and public.is_tutor().
-- This migration is idempotent on both development (missing public.is_staff)
-- and production (already missing auth.* leftovers).

-- ---------------------------------------------------------------------------
-- 1. Unused public helpers. Production still has these; development does not.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.is_staff();
DROP FUNCTION IF EXISTS public.is_adminstaff();

-- ---------------------------------------------------------------------------
-- 2. Pre-20250720 auth-schema leftovers. Development still has these.
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS enforce_user_role_on_signup ON auth.users;

DROP FUNCTION IF EXISTS auth.is_staff();
DROP FUNCTION IF EXISTS auth.is_adminstaff();
DROP FUNCTION IF EXISTS auth.is_tutor();
DROP FUNCTION IF EXISTS auth.is_student();
DROP FUNCTION IF EXISTS auth.current_staff_id();
DROP FUNCTION IF EXISTS auth.current_student_id();
DROP FUNCTION IF EXISTS auth.user_role();
DROP FUNCTION IF EXISTS auth.debug_user_info();
DROP FUNCTION IF EXISTS auth.set_email_templates();

DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.set_claim(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.map_day_to_number(text);
DROP FUNCTION IF EXISTS public.map_subject_to_id(text);
DROP FUNCTION IF EXISTS public.verify_email(text);

-- ---------------------------------------------------------------------------
-- 3. flashcards.title leftover. Recreate the staff facade because it uses f.*.
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.vstaff_flashcards;

ALTER TABLE public.flashcards
  DROP COLUMN IF EXISTS title;

CREATE OR REPLACE VIEW public.vstaff_flashcards
WITH (security_invoker = false)
AS
SELECT
  f.*,
  image_file.storage_path AS image_storage_path,
  image_file.mimetype AS image_mimetype,
  (
    SELECT COUNT(*)::INTEGER
    FROM public.flashcard_review_cards rc
    WHERE rc.flashcard_id = f.id AND rc.deleted_at IS NULL
  ) AS review_card_count
FROM public.flashcards f
LEFT JOIN public.files image_file ON image_file.id = f.image_file_id
WHERE f.deleted_at IS NULL
  AND ((SELECT public.is_adminstaff_active()) OR (SELECT public.is_tutor()));

GRANT SELECT ON public.vstaff_flashcards TO authenticated;
