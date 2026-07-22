CREATE TABLE public.ucat_public_interest_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  reason text,
  contact_consent boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'ucat_landing_page',
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ucat_public_interest_submissions_kind_check
    CHECK (kind IN ('supported_access', 'online_tutoring_waitlist')),
  CONSTRAINT ucat_public_interest_submissions_status_check
    CHECK (status IN ('new', 'contacted', 'interview_scheduled', 'approved', 'declined', 'closed')),
  CONSTRAINT ucat_public_interest_submissions_name_check
    CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  CONSTRAINT ucat_public_interest_submissions_email_check
    CHECK (char_length(btrim(email)) BETWEEN 3 AND 320),
  CONSTRAINT ucat_public_interest_submissions_phone_check
    CHECK (char_length(btrim(phone)) BETWEEN 6 AND 40),
  CONSTRAINT ucat_public_interest_submissions_reason_check
    CHECK (
      (kind = 'supported_access' AND char_length(btrim(COALESCE(reason, ''))) BETWEEN 20 AND 3000)
      OR (kind = 'online_tutoring_waitlist' AND reason IS NULL)
    )
);

CREATE INDEX ucat_public_interest_submissions_queue_idx
  ON public.ucat_public_interest_submissions (kind, status, created_at DESC);

ALTER TABLE public.ucat_public_interest_submissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ucat_public_interest_submissions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ucat_public_interest_submissions TO service_role;

COMMENT ON TABLE public.ucat_public_interest_submissions IS
  'Private enquiries submitted through the public Altitutor UCAT landing page. Accessible only to server-side service-role workflows.';

COMMENT ON COLUMN public.ucat_public_interest_submissions.contact_consent IS
  'The submitter explicitly asked Altitutor to contact them about the selected application or waitlist. This is not general marketing consent.';
