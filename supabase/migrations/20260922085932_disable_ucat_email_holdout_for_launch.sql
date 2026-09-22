-- The initial UCAT cohort is too small for a 10% holdout to produce useful
-- evidence. Launch consistently for every opted-in student while preserving
-- the schema's ability to run a deliberately powered experiment later.
UPDATE public.ucat_email_program_settings
SET holdout_percentage = 0,
    updated_at = NOW()
WHERE singleton = TRUE;

UPDATE public.ucat_email_program_assignments
SET cohort = 'treatment'
WHERE cohort = 'holdout';
