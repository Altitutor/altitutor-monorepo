-- Tutor office print access setting: off | office_hours | unrestricted.
-- Default office_hours preserves current tutor behaviour (admin-shift window).
-- Admins remain unrestricted. Changing the setting does not cancel in-flight jobs.

CREATE TYPE public.tutor_office_print_access AS ENUM (
  'off',
  'office_hours',
  'unrestricted'
);

GRANT USAGE ON TYPE public.tutor_office_print_access TO authenticated;

CREATE TABLE public.office_print_settings (
  singleton boolean PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  tutor_access public.tutor_office_print_access NOT NULL DEFAULT 'office_hours',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.office_print_settings (singleton, tutor_access)
VALUES (TRUE, 'office_hours');

CREATE TRIGGER set_updated_at_office_print_settings
  BEFORE UPDATE ON public.office_print_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.office_print_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMINSTAFF select office_print_settings"
  ON public.office_print_settings
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_adminstaff_active()));

CREATE POLICY "ADMINSTAFF update office_print_settings"
  ON public.office_print_settings
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

REVOKE ALL ON public.office_print_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.office_print_settings TO authenticated;

CREATE OR REPLACE VIEW public.vtutor_office_print_settings
WITH (security_invoker = false)
AS
SELECT s.tutor_access
FROM public.office_print_settings s
WHERE public.is_tutor();

GRANT SELECT ON public.vtutor_office_print_settings TO authenticated;

CREATE OR REPLACE FUNCTION public.tutor_may_office_print()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE COALESCE(
    (SELECT s.tutor_access FROM public.office_print_settings s WHERE s.singleton),
    'office_hours'::public.tutor_office_print_access
  )
    WHEN 'off' THEN false
    WHEN 'unrestricted' THEN true
    ELSE public.is_office_print_window_open()
  END;
$$;

REVOKE ALL ON FUNCTION public.tutor_may_office_print() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tutor_may_office_print() TO authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_print_job(
  p_file_id uuid,
  p_copies integer DEFAULT 1
)
RETURNS public.print_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_staff_id uuid;
  v_is_admin boolean;
  v_file public.files;
  v_job public.print_jobs;
  v_copies integer;
  v_tutor_access public.tutor_office_print_access;
BEGIN
  v_staff_id := public.current_staff_id();
  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'Staff profile required' USING ERRCODE = '42501';
  END IF;

  v_is_admin := public.is_adminstaff_active();
  IF NOT v_is_admin AND NOT public.is_tutor() THEN
    RAISE EXCEPTION 'Active staff required' USING ERRCODE = '42501';
  END IF;

  v_copies := COALESCE(p_copies, 1);
  IF v_copies < 1 OR v_copies > 20 THEN
    RAISE EXCEPTION 'copies must be between 1 and 20';
  END IF;

  IF NOT public.is_print_connector_online() THEN
    RAISE EXCEPTION 'Office printer offline' USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_is_admin THEN
    v_tutor_access := COALESCE(
      (SELECT s.tutor_access FROM public.office_print_settings s WHERE s.singleton),
      'office_hours'::public.tutor_office_print_access
    );
    IF v_tutor_access = 'off' THEN
      RAISE EXCEPTION 'Office print is turned off for tutors'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_tutor_access IS DISTINCT FROM 'unrestricted'
       AND NOT public.is_office_print_window_open() THEN
      RAISE EXCEPTION 'Office print is only available during an admin shift'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT f.* INTO v_file
  FROM public.files f
  WHERE f.id = p_file_id
    AND f.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'File not found' USING ERRCODE = 'P0002';
  END IF;

  IF NULLIF(btrim(COALESCE(v_file.external_url, '')), '') IS NOT NULL THEN
    RAISE EXCEPTION 'External URL files cannot be office-printed';
  END IF;

  IF NULLIF(btrim(COALESCE(v_file.storage_path, '')), '') IS NULL
     OR NULLIF(btrim(COALESCE(v_file.bucket, '')), '') IS NULL THEN
    RAISE EXCEPTION 'File has no storage path';
  END IF;

  IF NOT (
    v_file.mimetype = 'application/pdf'
    OR lower(v_file.filename) LIKE '%.pdf'
  ) THEN
    RAISE EXCEPTION 'Only PDF files can be office-printed';
  END IF;

  IF v_is_admin THEN
    NULL; -- admins may print any storage PDF they can open in admin-web
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM public.vtutor_topics_files tf
      WHERE tf.file_id = p_file_id
    ) THEN
      RAISE EXCEPTION 'File is not available to print' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.print_jobs j
    WHERE j.file_id = p_file_id
      AND j.requested_by_staff_id = v_staff_id
      AND (
        j.status IN ('queued', 'claimed')
        OR (
          j.status = 'succeeded'
          AND j.completed_at IS NOT NULL
          AND j.completed_at > now() - interval '60 seconds'
        )
      )
  ) THEN
    RAISE EXCEPTION 'A print job for this file is already in progress'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.print_jobs (
    file_id,
    bucket,
    storage_path,
    filename,
    copies,
    requested_by_staff_id
  ) VALUES (
    v_file.id,
    v_file.bucket,
    v_file.storage_path,
    v_file.filename,
    v_copies,
    v_staff_id
  )
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

COMMENT ON TYPE public.tutor_office_print_access IS
  'Organisation setting for tutor office print: off, office_hours, or unrestricted.';
COMMENT ON TABLE public.office_print_settings IS
  'Singleton organisation settings for office print. Tutor access does not apply to admins.';
COMMENT ON COLUMN public.office_print_settings.tutor_access IS
  'When tutors may create office print jobs. Admins are never limited by this setting.';
COMMENT ON FUNCTION public.tutor_may_office_print() IS
  'Whether the current tutor office print access allows creating a job now. Admins should not rely on this; enqueue bypasses it for admins.';
COMMENT ON FUNCTION public.enqueue_print_job(uuid, integer) IS
  'Authenticated enqueue for office print. Tutors require tutor office print access (and the admin-shift window when set to office_hours) plus topic file access; admins bypass tutor access.';
