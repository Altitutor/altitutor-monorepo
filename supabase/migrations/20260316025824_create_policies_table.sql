-- Migration: Create policies table for configurable policy documents (e.g. billing policy)
-- Description: Stores policy content as Tiptap/ProseMirror JSONB for rich text editing
-- Policies are managed by admin staff and displayed to students during registration

CREATE TABLE public.policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  content jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for key lookups
CREATE INDEX idx_policies_key ON public.policies(key);

-- Trigger to update updated_at on row change
CREATE OR REPLACE FUNCTION public.set_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER policies_updated_at
  BEFORE UPDATE ON public.policies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_policies_updated_at();

-- Enable RLS
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

-- Admin staff can manage all policies
CREATE POLICY "Admin staff can manage policies"
  ON public.policies
  FOR ALL
  TO authenticated
  USING (
    (SELECT auth.uid()) IN (
      SELECT user_id FROM staff WHERE role = 'ADMINSTAFF'
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) IN (
      SELECT user_id FROM staff WHERE role = 'ADMINSTAFF'
    )
  );

-- Seed default billing policy (Tiptap JSON structure)
INSERT INTO public.policies (key, content) VALUES (
  'billing_policy',
  '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"BILLING POLICY"}]},{"type":"paragraph","content":[{"type":"text","text":"By registering as a student at Altitutor, I understand the following:"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Once Altitutor receives my registration, I will be added to classes for each of the subjects I have selected. I will be informed of which classes I am added to via text message, as well as the student portal updating with my timetable"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Once enrolled in each class, I will automatically be added to all weekly sessions for that class, after the start date"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"My card will be charged for all sessions which I am added to, unless I have informed Altitutor of my absence prior."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"I understand that absences must be informed no later than 24 hours before the start date of the session, otherwise Altitutor reserves the right to charge my card for the session. Exceptions for unforseen events may be made at Altitutor''s discretion. Examples of unforseen events include but are not limited to personal illness and family issues"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"I understand that once a session is charged, refunds cannot be offered, but at Altitutor''s discretion, we may offer a free replacement session"}]}]}]},{"type":"paragraph","content":[{"type":"text","text":"By agreeing to this billing policy, I agree to pay for each session on or before the day before the session."}]}]}'::jsonb
);
