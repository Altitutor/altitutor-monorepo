-- Durable, independently revocable public links for In-person registration and
-- trial/subsidy booking management. Account invite tokens remain single-use.

ALTER TABLE public.students
  ADD COLUMN registration_public_token TEXT,
  ADD COLUMN legacy_registration_token UUID;

ALTER TABLE public.sessions
  ADD COLUMN booking_public_token TEXT;

ALTER TABLE public.students
  ADD CONSTRAINT students_registration_public_token_format
  CHECK (
    registration_public_token IS NULL
    OR registration_public_token ~ '^[A-Za-z0-9_-]{22}$'
  );

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_booking_public_token_format
  CHECK (
    booking_public_token IS NULL
    OR booking_public_token ~ '^[A-Za-z0-9_-]{22}$'
  );

CREATE UNIQUE INDEX students_registration_public_token_unique
  ON public.students (registration_public_token)
  WHERE registration_public_token IS NOT NULL;

CREATE UNIQUE INDEX students_legacy_registration_token_unique
  ON public.students (legacy_registration_token)
  WHERE legacy_registration_token IS NOT NULL;

CREATE UNIQUE INDEX sessions_booking_public_token_unique
  ON public.sessions (booking_public_token)
  WHERE booking_public_token IS NOT NULL;

CREATE TABLE public.public_link_revocations (
  purpose TEXT NOT NULL CHECK (purpose IN ('REGISTRATION', 'BOOKING')),
  token TEXT NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_by UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  PRIMARY KEY (purpose, token),
  CONSTRAINT public_link_revocations_owner_check CHECK (
    (purpose = 'REGISTRATION' AND student_id IS NOT NULL AND session_id IS NULL)
    OR
    (purpose = 'BOOKING' AND session_id IS NOT NULL AND student_id IS NULL)
  )
);

CREATE INDEX public_link_revocations_student_id_idx
  ON public.public_link_revocations (student_id)
  WHERE student_id IS NOT NULL;

CREATE INDEX public_link_revocations_session_id_idx
  ON public.public_link_revocations (session_id)
  WHERE session_id IS NOT NULL;

ALTER TABLE public.public_link_revocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_link_revocations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_public_journey_token()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = public, extensions
AS $$
  SELECT rtrim(
    translate(encode(gen_random_bytes(16), 'base64'), '+/', '-_'),
    '='
  );
$$;

REVOKE ALL ON FUNCTION public.generate_public_journey_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_public_journey_token() TO service_role;

-- Install bearer-field exclusions before the backfill so the existing Student
-- and Session activity triggers can never serialize credentials.
CREATE OR REPLACE FUNCTION public.get_excluded_fields_for_table(table_name TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE table_name
    WHEN 'invoices' THEN ARRAY[
      'created_at', 'updated_at', 'created_by',
      'stripe_invoice_id', 'stripe_invoice_number', 'stripe_charge_id',
      'stripe_payment_intent_id', 'receipt_url', 'hosted_invoice_url', 'invoice_pdf',
      'dispute_id', 'dispute_status', 'dispute_reason', 'dispute_amount_cents',
      'dispute_currency', 'dispute_created_at', 'dispute_updated_at', 'dispute_resolved_at',
      'finalized_at', 'paid_at'
    ]
    WHEN 'invoice_items' THEN ARRAY['created_at', 'stripe_invoice_item_id']
    WHEN 'credit_notes' THEN ARRAY['created_at', 'updated_at', 'stripe_credit_note_id']
    WHEN 'tasks' THEN ARRAY[
      'created_at', 'updated_at', 'created_by', 'description', 'search_vector',
      'source_rule_id', 'source_activity_id'
    ]
    WHEN 'issues' THEN ARRAY['created_at', 'updated_at', 'created_by', 'description', 'search_vector']
    WHEN 'projects' THEN ARRAY['created_at', 'updated_at', 'created_by', 'description', 'search_vector']
    WHEN 'notes' THEN ARRAY['created_at', 'updated_at', 'created_by', 'note', 'search_vector']
    WHEN 'students' THEN ARRAY[
      'created_at', 'updated_at', 'created_by', 'invite_token',
      'registration_public_token', 'legacy_registration_token'
    ]
    WHEN 'sessions' THEN ARRAY[
      'created_at', 'updated_at', 'created_by', 'booking_public_token'
    ]
    ELSE ARRAY['created_at', 'updated_at', 'created_by']
  END;
END;
$$;

-- Preserve every registration UUID already sent to a TRIAL Student, while
-- issuing a short token for all future sends. Do not reinterpret ACTIVE account
-- invites as registration links.
UPDATE public.students
SET
  legacy_registration_token = invite_token,
  registration_public_token = public.generate_public_journey_token()
WHERE status = 'TRIAL';

CREATE OR REPLACE FUNCTION public.issue_student_registration_public_token(
  p_student_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token TEXT;
BEGIN
  UPDATE public.students
  SET registration_public_token = COALESCE(
    registration_public_token,
    public.generate_public_journey_token()
  )
  WHERE id = p_student_id
    AND (registration_public_token IS NOT NULL OR status = 'TRIAL')
  RETURNING registration_public_token INTO v_token;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Student is not eligible for In-person registration'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_session_booking_public_token(
  p_session_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token TEXT;
BEGIN
  UPDATE public.sessions
  SET booking_public_token = COALESCE(
    booking_public_token,
    public.generate_public_journey_token()
  )
  WHERE id = p_session_id
    AND type IN ('TRIAL_SESSION', 'SUBSIDY_INTERVIEW')
  RETURNING booking_public_token INTO v_token;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Session is not a public booking'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.rotate_student_registration_public_token(
  p_student_id UUID,
  p_performed_by UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_old_token TEXT;
  v_legacy_token UUID;
  v_new_token TEXT := public.generate_public_journey_token();
BEGIN
  SELECT registration_public_token, legacy_registration_token
  INTO v_old_token, v_legacy_token
  FROM public.students
  WHERE id = p_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_old_token IS NOT NULL THEN
    INSERT INTO public.public_link_revocations (
      purpose, token, student_id, revoked_by
    ) VALUES (
      'REGISTRATION', v_old_token, p_student_id, p_performed_by
    ) ON CONFLICT DO NOTHING;
  END IF;

  IF v_legacy_token IS NOT NULL THEN
    INSERT INTO public.public_link_revocations (
      purpose, token, student_id, revoked_by
    ) VALUES (
      'REGISTRATION', v_legacy_token::TEXT, p_student_id, p_performed_by
    ) ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.students
  SET
    registration_public_token = v_new_token,
    legacy_registration_token = NULL
  WHERE id = p_student_id;

  INSERT INTO public.activity_events (
    entity_type,
    entity_id,
    event_type,
    changed_fields,
    metadata,
    student_id,
    performed_by
  ) VALUES (
    'students',
    p_student_id,
    'UPDATED',
    jsonb_build_object(
      'registration_link',
      jsonb_build_object('old', 'ACTIVE', 'new', 'REPLACED')
    ),
    jsonb_build_object('operation', 'PUBLIC_LINK_ROTATED'),
    p_student_id,
    p_performed_by
  );

  RETURN v_new_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.rotate_session_booking_public_token(
  p_session_id UUID,
  p_performed_by UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_old_token TEXT;
  v_session_type public.session_type;
  v_new_token TEXT := public.generate_public_journey_token();
BEGIN
  SELECT booking_public_token, type
  INTO v_old_token, v_session_type
  FROM public.sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND OR v_session_type NOT IN ('TRIAL_SESSION', 'SUBSIDY_INTERVIEW') THEN
    RAISE EXCEPTION 'Public booking not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_old_token IS NOT NULL THEN
    INSERT INTO public.public_link_revocations (
      purpose, token, session_id, revoked_by
    ) VALUES (
      'BOOKING', v_old_token, p_session_id, p_performed_by
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- The legacy booking URL uses the Session UUID itself as bearer authority.
  INSERT INTO public.public_link_revocations (
    purpose, token, session_id, revoked_by
  ) VALUES (
    'BOOKING', p_session_id::TEXT, p_session_id, p_performed_by
  ) ON CONFLICT DO NOTHING;

  UPDATE public.sessions
  SET booking_public_token = v_new_token
  WHERE id = p_session_id;

  INSERT INTO public.activity_events (
    entity_type,
    entity_id,
    event_type,
    changed_fields,
    metadata,
    session_id,
    performed_by
  ) VALUES (
    'sessions',
    p_session_id,
    'UPDATED',
    jsonb_build_object(
      'booking_link',
      jsonb_build_object('old', 'ACTIVE', 'new', 'REPLACED')
    ),
    jsonb_build_object('operation', 'PUBLIC_LINK_ROTATED'),
    p_session_id,
    p_performed_by
  );

  RETURN v_new_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_student_registration_public(
  p_token TEXT,
  p_student_first_name TEXT,
  p_student_last_name TEXT,
  p_student_email TEXT,
  p_student_phone TEXT,
  p_school TEXT DEFAULT NULL,
  p_curriculum TEXT DEFAULT NULL,
  p_year_level INTEGER DEFAULT NULL,
  p_availability_monday BOOLEAN DEFAULT FALSE,
  p_availability_tuesday BOOLEAN DEFAULT FALSE,
  p_availability_wednesday BOOLEAN DEFAULT FALSE,
  p_availability_thursday BOOLEAN DEFAULT FALSE,
  p_availability_friday BOOLEAN DEFAULT FALSE,
  p_availability_saturday_am BOOLEAN DEFAULT FALSE,
  p_availability_saturday_pm BOOLEAN DEFAULT FALSE,
  p_availability_sunday_am BOOLEAN DEFAULT FALSE,
  p_availability_sunday_pm BOOLEAN DEFAULT FALSE,
  p_parents JSONB DEFAULT '[]'::JSONB,
  p_subject_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student RECORD;
  v_parent JSONB;
  v_parent_id UUID;
  v_subject_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.public_link_revocations
    WHERE purpose = 'REGISTRATION' AND token = p_token
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration link was revoked');
  END IF;

  SELECT id, status, user_id
  INTO v_student
  FROM public.students
  WHERE registration_public_token = p_token
     OR legacy_registration_token::TEXT = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid registration link');
  END IF;

  IF v_student.status IS DISTINCT FROM 'TRIAL' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', CASE
        WHEN v_student.status = 'ACTIVE' THEN 'Student already registered'
        ELSE 'Registration is unavailable for this student'
      END,
      'already_registered', v_student.status = 'ACTIVE'
    );
  END IF;

  IF NOT (
    p_availability_monday OR p_availability_tuesday OR
    p_availability_wednesday OR p_availability_thursday OR
    p_availability_friday OR p_availability_saturday_am OR
    p_availability_saturday_pm OR p_availability_sunday_am OR
    p_availability_sunday_pm
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'At least one availability day must be selected'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_parents) AS parent
    WHERE NULLIF(parent->>'email', '') IS NOT NULL
      AND NULLIF(parent->>'phone', '') IS NOT NULL
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'At least one parent must have both email and phone'
    );
  END IF;

  UPDATE public.students
  SET
    first_name = p_student_first_name,
    last_name = p_student_last_name,
    email = p_student_email,
    phone = p_student_phone,
    school = p_school,
    curriculum = p_curriculum,
    year_level = p_year_level,
    availability_monday = p_availability_monday,
    availability_tuesday = p_availability_tuesday,
    availability_wednesday = p_availability_wednesday,
    availability_thursday = p_availability_thursday,
    availability_friday = p_availability_friday,
    availability_saturday_am = p_availability_saturday_am,
    availability_saturday_pm = p_availability_saturday_pm,
    availability_sunday_am = p_availability_sunday_am,
    availability_sunday_pm = p_availability_sunday_pm,
    updated_at = NOW()
  WHERE id = v_student.id;

  FOR v_parent IN SELECT * FROM jsonb_array_elements(p_parents)
  LOOP
    IF NULLIF(v_parent->>'email', '') IS NULL THEN
      CONTINUE;
    END IF;

    SELECT id INTO v_parent_id
    FROM public.parents
    WHERE LOWER(email) = LOWER(v_parent->>'email')
    LIMIT 1;

    IF v_parent_id IS NULL THEN
      INSERT INTO public.parents (id, first_name, last_name, email, phone)
      VALUES (
        gen_random_uuid(),
        v_parent->>'first_name',
        v_parent->>'last_name',
        v_parent->>'email',
        v_parent->>'phone'
      )
      RETURNING id INTO v_parent_id;
    ELSE
      UPDATE public.parents
      SET
        first_name = COALESCE(NULLIF(v_parent->>'first_name', ''), first_name),
        last_name = COALESCE(NULLIF(v_parent->>'last_name', ''), last_name),
        phone = COALESCE(NULLIF(v_parent->>'phone', ''), phone),
        updated_at = NOW()
      WHERE id = v_parent_id;
    END IF;

    INSERT INTO public.parents_students (parent_id, student_id)
    VALUES (v_parent_id, v_student.id)
    ON CONFLICT (parent_id, student_id) DO NOTHING;
  END LOOP;

  DELETE FROM public.students_subjects WHERE student_id = v_student.id;
  IF p_subject_ids IS NOT NULL THEN
    FOREACH v_subject_id IN ARRAY p_subject_ids
    LOOP
      IF EXISTS (SELECT 1 FROM public.subjects WHERE id = v_subject_id) THEN
        INSERT INTO public.students_subjects (student_id, subject_id)
        VALUES (v_student.id, v_subject_id)
        ON CONFLICT (student_id, subject_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'student_id', v_student.id,
    'message', 'Registration completed successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Registration failed: ' || SQLERRM
    );
END;
$$;

REVOKE ALL ON FUNCTION public.issue_student_registration_public_token(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_session_booking_public_token(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rotate_student_registration_public_token(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rotate_session_booking_public_token(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_student_registration_public(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER,
  BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN,
  BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, JSONB, UUID[]
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.issue_student_registration_public_token(UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_session_booking_public_token(UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.rotate_student_registration_public_token(UUID, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.rotate_session_booking_public_token(UUID, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_student_registration_public(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER,
  BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN,
  BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, JSONB, UUID[]
) TO service_role;

COMMENT ON COLUMN public.students.registration_public_token IS
  'Stable bearer token for the Student In-person registration link.';
COMMENT ON COLUMN public.students.legacy_registration_token IS
  'Previously sent invite-token UUID retained only as a legacy registration-link alias.';
COMMENT ON COLUMN public.sessions.booking_public_token IS
  'Stable bearer token for public trial/subsidy booking management.';
COMMENT ON TABLE public.public_link_revocations IS
  'Tombstones for explicitly revoked registration and booking bearer tokens.';
