-- The initial UCAT cohort is too small for a 10% holdout to produce useful
-- evidence. Launch consistently for every opted-in student while preserving
-- the schema's ability to run a deliberately powered experiment later.
UPDATE public.ucat_email_program_settings
SET holdout_percentage = 0,
    updated_at = NOW()
WHERE singleton = TRUE;

-- Preference rows created before the email-program migration never fired the
-- assignment trigger. Backfill every missing row deterministically so no
-- opted-in student is silently excluded from lifecycle selection.
INSERT INTO public.ucat_email_program_assignments (
  student_id,
  cohort,
  bucket
)
SELECT
  preferences.student_id,
  'treatment',
  (
    GET_BYTE(
      extensions.digest(preferences.student_id::TEXT, 'sha256'),
      0
    )::INTEGER * 256
    + GET_BYTE(
      extensions.digest(preferences.student_id::TEXT, 'sha256'),
      1
    )::INTEGER
  ) % 100
FROM public.ucat_communication_preferences AS preferences
LEFT JOIN public.ucat_email_program_assignments AS assignment
  ON assignment.student_id = preferences.student_id
WHERE assignment.student_id IS NULL
ON CONFLICT (student_id) DO NOTHING;

UPDATE public.ucat_email_program_assignments
SET cohort = 'treatment'
WHERE cohort = 'holdout';
