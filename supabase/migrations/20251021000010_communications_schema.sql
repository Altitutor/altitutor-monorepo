-- Migration: Communications (SMS-only) data model and parents entities
-- Description:
--  - Create parents and parents_students tables
--  - Create contacts (polymorphic one-of to student/parent/staff)
--  - Create owned_numbers, conversations, messages, conversation_reads (no media)
--  - Enable admin-only RLS on new tables
--  - Add indexes and updated_at triggers
--  - Backfill parents/parents_students and contacts from existing data
--  - Refactor students: rename student_email -> email, student_phone -> phone; drop parent_* and notes
--  - Update link_precreated_user() to use students.email after rename

-- ========================
-- PARENTS
-- ========================
CREATE TABLE IF NOT EXISTS public.parents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_token UUID,
  created_by UUID REFERENCES public.staff(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT parents_invite_token_unique UNIQUE (invite_token)
);

-- updated_at trigger for parents
DROP TRIGGER IF EXISTS set_updated_at_parents ON public.parents;
CREATE TRIGGER set_updated_at_parents
BEFORE UPDATE ON public.parents
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================
-- PARENTS_STUDENTS
-- ========================
CREATE TABLE IF NOT EXISTS public.parents_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT parents_students_unique UNIQUE (parent_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_parents_students_parent ON public.parents_students(parent_id);
CREATE INDEX IF NOT EXISTS idx_parents_students_student ON public.parents_students(student_id);

-- updated_at trigger for parents_students
DROP TRIGGER IF EXISTS set_updated_at_parents_students ON public.parents_students;
CREATE TRIGGER set_updated_at_parents_students
BEFORE UPDATE ON public.parents_students
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================
-- CONTACTS (polymorphic one-of)
-- ========================
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_name TEXT,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('PARENT','STUDENT','STAFF','LEAD','OTHER')),
  phone_e164 TEXT NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.parents(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  is_opted_out BOOLEAN NOT NULL DEFAULT FALSE,
  opted_out_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT contacts_phone_unique UNIQUE (phone_e164),
  CONSTRAINT contacts_one_of_fk CHECK (
    CASE contact_type
      WHEN 'STUDENT' THEN student_id IS NOT NULL AND parent_id IS NULL AND staff_id IS NULL
      WHEN 'PARENT' THEN parent_id IS NOT NULL AND student_id IS NULL AND staff_id IS NULL
      WHEN 'STAFF' THEN staff_id IS NOT NULL AND student_id IS NULL AND parent_id IS NULL
      ELSE student_id IS NULL AND parent_id IS NULL AND staff_id IS NULL
    END
  )
);

CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone_e164);
CREATE INDEX IF NOT EXISTS idx_contacts_student ON public.contacts(student_id);
CREATE INDEX IF NOT EXISTS idx_contacts_parent ON public.contacts(parent_id);
CREATE INDEX IF NOT EXISTS idx_contacts_staff ON public.contacts(staff_id);

-- updated_at trigger for contacts
DROP TRIGGER IF EXISTS set_updated_at_contacts ON public.contacts;
CREATE TRIGGER set_updated_at_contacts
BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================
-- OWNED NUMBERS (Twilio numbers)
-- ========================
CREATE TABLE IF NOT EXISTS public.owned_numbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_e164 TEXT NOT NULL UNIQUE,
  label TEXT,
  messaging_service_sid TEXT,
  twilio_phone_sid TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- updated_at trigger for owned_numbers
DROP TRIGGER IF EXISTS set_updated_at_owned_numbers ON public.owned_numbers;
CREATE TRIGGER set_updated_at_owned_numbers
BEFORE UPDATE ON public.owned_numbers
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================
-- CONVERSATIONS
-- ========================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  owned_number_id UUID NOT NULL REFERENCES public.owned_numbers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('OPEN','SNOOZED','CLOSED','ARCHIVED')) DEFAULT 'OPEN',
  assigned_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  last_message_id UUID,
  last_message_at TIMESTAMP WITH TIME ZONE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_staff_id UUID REFERENCES public.staff(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON public.conversations(assigned_staff_id, status);
-- One active (OPEN/SNOOZED) conversation per (contact, owned number)
CREATE UNIQUE INDEX IF NOT EXISTS conversations_one_active_per_number
  ON public.conversations(contact_id, owned_number_id)
  WHERE status IN ('OPEN','SNOOZED');

-- updated_at trigger for conversations
DROP TRIGGER IF EXISTS set_updated_at_conversations ON public.conversations;
CREATE TRIGGER set_updated_at_conversations
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================
-- MESSAGES (no media)
-- ========================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('INBOUND','OUTBOUND')),
  body TEXT NOT NULL,
  from_number_e164 TEXT NOT NULL,
  to_number_e164 TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('QUEUED','SENDING','SENT','DELIVERED','UNDELIVERED','FAILED','RECEIVED')),
  status_updated_at TIMESTAMP WITH TIME ZONE,
  message_sid TEXT UNIQUE,
  account_sid TEXT,
  messaging_service_sid TEXT,
  error_code INT,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE,
  created_by_staff_id UUID REFERENCES public.staff(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_time ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_status ON public.messages(status, direction);

-- updated_at trigger for messages
DROP TRIGGER IF EXISTS set_updated_at_messages ON public.messages;
CREATE TRIGGER set_updated_at_messages
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================
-- CONVERSATION READS (unread tracking)
-- ========================
CREATE TABLE IF NOT EXISTS public.conversation_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT conversation_reads_unique UNIQUE (conversation_id, staff_id)
);

-- updated_at trigger for conversation_reads
DROP TRIGGER IF EXISTS set_updated_at_conversation_reads ON public.conversation_reads;
CREATE TRIGGER set_updated_at_conversation_reads
BEFORE UPDATE ON public.conversation_reads
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================
-- RLS: ADMINSTAFF(ACTIVE) ONLY
-- ========================
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owned_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;

-- Parents
DROP POLICY IF EXISTS "ADMINSTAFF full access to parents" ON public.parents;
CREATE POLICY "ADMINSTAFF full access to parents" ON public.parents
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- Parents_students
DROP POLICY IF EXISTS "ADMINSTAFF full access to parents_students" ON public.parents_students;
CREATE POLICY "ADMINSTAFF full access to parents_students" ON public.parents_students
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- Contacts
DROP POLICY IF EXISTS "ADMINSTAFF full access to contacts" ON public.contacts;
CREATE POLICY "ADMINSTAFF full access to contacts" ON public.contacts
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- Owned numbers
DROP POLICY IF EXISTS "ADMINSTAFF full access to owned_numbers" ON public.owned_numbers;
CREATE POLICY "ADMINSTAFF full access to owned_numbers" ON public.owned_numbers
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- Conversations
DROP POLICY IF EXISTS "ADMINSTAFF full access to conversations" ON public.conversations;
CREATE POLICY "ADMINSTAFF full access to conversations" ON public.conversations
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- Messages
DROP POLICY IF EXISTS "ADMINSTAFF full access to messages" ON public.messages;
CREATE POLICY "ADMINSTAFF full access to messages" ON public.messages
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- Conversation reads
DROP POLICY IF EXISTS "ADMINSTAFF full access to conversation_reads" ON public.conversation_reads;
CREATE POLICY "ADMINSTAFF full access to conversation_reads" ON public.conversation_reads
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- ========================
-- BACKFILL PARENTS AND CONTACTS
-- ========================

-- Backfill parents from students' legacy parent fields when present
INSERT INTO public.parents (first_name, last_name, email, phone, created_by)
SELECT DISTINCT
  NULLIF(TRIM(parent_first_name), '') AS first_name,
  NULLIF(TRIM(parent_last_name), '') AS last_name,
  NULLIF(TRIM(parent_email), '') AS email,
  NULLIF(TRIM(parent_phone), '') AS phone,
  created_by
FROM public.students
WHERE (COALESCE(parent_first_name,'') <> ''
    OR COALESCE(parent_last_name,'') <> ''
    OR COALESCE(parent_email,'') <> ''
    OR COALESCE(parent_phone,'') <> '')
ON CONFLICT DO NOTHING;

-- Link parents to students
INSERT INTO public.parents_students (parent_id, student_id)
SELECT p.id, s.id
FROM public.students s
JOIN public.parents p
  ON (
    (p.phone IS NOT NULL AND s.parent_phone IS NOT NULL AND p.phone = s.parent_phone)
    OR (
      (p.phone IS NULL OR s.parent_phone IS NULL) AND
      p.email IS NOT NULL AND s.parent_email IS NOT NULL AND LOWER(p.email) = LOWER(s.parent_email)
    )
  );

-- Backfill contacts for students (type=STUDENT)
INSERT INTO public.contacts (display_name, contact_type, phone_e164, student_id)
SELECT
  CONCAT(COALESCE(NULLIF(TRIM(first_name),''),'') , CASE WHEN COALESCE(NULLIF(TRIM(last_name),'') ,'') <> '' THEN ' ' || TRIM(last_name) ELSE '' END) AS display_name,
  'STUDENT' AS contact_type,
  NULLIF(TRIM(student_phone), '') AS phone_e164,
  id AS student_id
FROM public.students
WHERE COALESCE(NULLIF(TRIM(student_phone), ''),'') <> ''
ON CONFLICT (phone_e164) DO NOTHING;

-- Backfill contacts for parents (type=PARENT)
INSERT INTO public.contacts (display_name, contact_type, phone_e164, parent_id)
SELECT
  CONCAT(COALESCE(NULLIF(TRIM(first_name),''),'') , CASE WHEN COALESCE(NULLIF(TRIM(last_name),'') ,'') <> '' THEN ' ' || TRIM(last_name) ELSE '' END) AS display_name,
  'PARENT' AS contact_type,
  NULLIF(TRIM(phone), '') AS phone_e164,
  id AS parent_id
FROM public.parents
WHERE COALESCE(NULLIF(TRIM(phone), ''),'') <> ''
ON CONFLICT (phone_e164) DO NOTHING;

-- Backfill contacts for staff (type=STAFF)
INSERT INTO public.contacts (display_name, contact_type, phone_e164, staff_id)
SELECT
  CONCAT(COALESCE(NULLIF(TRIM(first_name),''),'') , CASE WHEN COALESCE(NULLIF(TRIM(last_name),'') ,'') <> '' THEN ' ' || TRIM(last_name) ELSE '' END) AS display_name,
  'STAFF' AS contact_type,
  NULLIF(TRIM(phone_number), '') AS phone_e164,
  id AS staff_id
FROM public.staff
WHERE COALESCE(NULLIF(TRIM(phone_number), ''),'') <> ''
ON CONFLICT (phone_e164) DO NOTHING;

-- ========================
-- STUDENTS REFACTOR (rename/drop columns)
-- ========================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'student_email'
  ) THEN
    ALTER TABLE public.students RENAME COLUMN student_email TO email;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'student_phone'
  ) THEN
    ALTER TABLE public.students RENAME COLUMN student_phone TO phone;
  END IF;

  -- Drop legacy parent_* and notes columns if present
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'parent_name'
  ) THEN
    ALTER TABLE public.students DROP COLUMN parent_name;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'parent_email'
  ) THEN
    ALTER TABLE public.students DROP COLUMN parent_email;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'parent_phone'
  ) THEN
    ALTER TABLE public.students DROP COLUMN parent_phone;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.students DROP COLUMN notes;
  END IF;
END $$;

-- ========================
-- UPDATE LINKING FUNCTION TO NEW COLUMN NAME
-- ========================
CREATE OR REPLACE FUNCTION public.link_precreated_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Prefer invite token if present in raw_user_meta_data
  IF (NEW.raw_user_meta_data ? 'invite_token') THEN
    UPDATE public.staff s
      SET user_id = NEW.id
      WHERE s.user_id IS NULL
        AND s.invite_token = (NEW.raw_user_meta_data ->> 'invite_token');
    IF FOUND THEN
      RETURN NEW;
    END IF;

    UPDATE public.students st
      SET user_id = NEW.id
      WHERE st.user_id IS NULL
        AND st.invite_token = (NEW.raw_user_meta_data ->> 'invite_token');
    RETURN NEW;
  END IF;

  -- Fallback: link by email address
  UPDATE public.staff s
    SET user_id = NEW.id
    WHERE s.user_id IS NULL
      AND LOWER(s.email) = LOWER(NEW.email);
  IF FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE public.students st
    SET user_id = NEW.id
    WHERE st.user_id IS NULL
      AND LOWER(st.email) = LOWER(NEW.email);

  RETURN NEW;
END;$$;

-- Recreate trigger to ensure it points to the latest function body
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.link_precreated_user();


