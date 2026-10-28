-- DEV-243: admin deletion retains the Student and history, releases routing handles, and requires stable identity proof for restoration.
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.staff(id) ON DELETE SET NULL;



CREATE TABLE public.student_deletion_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz NOT NULL,
  deleted_by uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  restored_at timestamptz,
  snapshot jsonb NOT NULL
);
ALTER TABLE public.student_deletion_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_deletion_history FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.student_deletion_history TO authenticated;
CREATE POLICY admin_history ON public.student_deletion_history FOR SELECT TO authenticated USING ((SELECT public.is_adminstaff_active()));

CREATE TABLE public.student_retired_logins (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  deleted_at timestamptz NOT NULL,
  login_emails text[] NOT NULL DEFAULT '{}',
  login_alias text
);
ALTER TABLE public.student_retired_logins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_retired_logins FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.contacts ADD COLUMN retired_at timestamptz;
ALTER TABLE public.contacts ADD COLUMN retired_phone_e164 text;
ALTER TABLE public.contacts ADD COLUMN retired_email text;
ALTER TABLE public.contacts ADD COLUMN retired_opt_out boolean;
ALTER TABLE public.contacts DROP CONSTRAINT contacts_has_messaging_handle;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_has_messaging_handle CHECK (retired_at IS NOT NULL OR phone_e164 IS NOT NULL OR NULLIF(btrim(email),'') IS NOT NULL);

CREATE FUNCTION public.normalize_retired_auth_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_login public.student_retired_logins%ROWTYPE; v_email text;
BEGIN
  SELECT * INTO v_login FROM public.student_retired_logins WHERE auth_user_id=NEW.user_id;
  IF FOUND AND v_login.login_alias IS NOT NULL THEN
    IF lower(NEW.identity_data->>'email')=ANY(v_login.login_emails) THEN
      SELECT email INTO v_email FROM auth.users WHERE id=NEW.user_id;
      NEW.identity_data=jsonb_set(NEW.identity_data,'{email}',to_jsonb(v_email));
    END IF;
    NEW.identity_data=NEW.identity_data-'phone';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.normalize_retired_auth_identity() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER normalize_retired_student_identity BEFORE INSERT OR UPDATE OF identity_data ON auth.identities FOR EACH ROW EXECUTE FUNCTION public.normalize_retired_auth_identity();

CREATE FUNCTION public.retire_student_identity(p_student_id uuid,p_staff_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_student public.students%ROWTYPE; v_auth auth.users%ROWTYPE; v_deleted_at timestamptz=clock_timestamp(); v_alias text; v_shared boolean;
BEGIN
  SELECT * INTO STRICT v_student FROM public.students WHERE id=p_student_id FOR UPDATE;
  INSERT INTO public.student_deletion_history(student_id,auth_user_id,deleted_at,deleted_by,snapshot)
  VALUES(v_student.id,v_student.user_id,v_deleted_at,p_staff_id,(to_jsonb(v_student)-ARRAY['invite_token','registration_public_token','legacy_registration_token'])||jsonb_build_object('communication_preferences',(SELECT to_jsonb(preferences) FROM public.ucat_communication_preferences preferences WHERE student_id=v_student.id)));
  IF v_student.user_id IS NOT NULL THEN
    SELECT * INTO STRICT v_auth FROM auth.users WHERE id=v_student.user_id FOR UPDATE;
    v_shared=EXISTS(SELECT 1 FROM public.staff WHERE user_id=v_auth.id AND status IN ('ACTIVE','TRIAL')) OR EXISTS(SELECT 1 FROM public.parents WHERE user_id=v_auth.id);
    IF v_shared AND v_auth.email LIKE '%@accounts.invalid' THEN v_alias=v_auth.email; ELSIF NOT v_shared THEN v_alias='retired-'||replace(v_auth.id::text,'-','')||'@accounts.invalid'; END IF;
    INSERT INTO public.student_retired_logins(auth_user_id,student_id,deleted_at,login_emails,login_alias)
    VALUES(v_auth.id,v_student.id,v_deleted_at,ARRAY(SELECT DISTINCT lower(address) FROM (SELECT unnest(ARRAY[v_student.email,v_auth.email]) AS address UNION ALL SELECT identity_data->>'email' FROM auth.identities WHERE user_id=v_auth.id) AS addresses WHERE address IS NOT NULL AND address NOT LIKE '%@accounts.invalid'),v_alias)
    ON CONFLICT(auth_user_id) DO UPDATE SET student_id=EXCLUDED.student_id,deleted_at=EXCLUDED.deleted_at,
      login_emails=ARRAY(SELECT DISTINCT unnest(public.student_retired_logins.login_emails||EXCLUDED.login_emails)),login_alias=EXCLUDED.login_alias;
  END IF;
  INSERT INTO public.student_contact_history(student_id,contact_id)
  SELECT v_student.id,id FROM public.contacts WHERE student_id=v_student.id ON CONFLICT DO NOTHING;
  UPDATE public.contacts SET retired_at=v_deleted_at,retired_phone_e164=phone_e164,retired_email=email,retired_opt_out=is_opted_out,phone_e164=NULL,email=NULL,is_opted_out=true
  WHERE retired_at IS NULL AND staff_id IS NULL AND parent_id IS NULL
    AND (student_id=v_student.id OR (student_id IS NULL AND EXISTS(SELECT 1 FROM public.student_contact_history h WHERE h.student_id=v_student.id AND h.contact_id=contacts.id)));
  UPDATE public.ucat_communication_preferences SET weekly_progress_and_guidance=false,lessons_and_tips=false,product_news=false,offers_and_referrals=false WHERE student_id=v_student.id;
  UPDATE public.newsletter_subscribers SET unsubscribed_at=coalesce(unsubscribed_at,v_deleted_at) WHERE student_id=v_student.id;
  UPDATE public.ucat_transactional_email_outbox SET status='suppressed',delivery_status='suppressed',claimed_at=NULL,last_error='Student deleted' WHERE student_id=v_student.id AND status IN ('pending','failed','processing');
  PERFORM set_config('altitutor.student_deletion_command','retire',true);
  UPDATE public.students SET deleted_at=v_deleted_at,deleted_by=p_staff_id,user_id=NULL,email=NULL,phone=NULL,invite_token=NULL,registration_public_token=NULL,legacy_registration_token=NULL WHERE id=v_student.id;
  PERFORM set_config('altitutor.student_deletion_command','',true);
  UPDATE public.student_calendar_subscriptions SET token=gen_random_uuid() WHERE student_id=v_student.id;
  IF v_student.user_id IS NOT NULL THEN UPDATE auth.users SET raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||jsonb_build_object('retired_student_id',v_student.id) WHERE id=v_student.user_id; END IF;
  IF v_alias IS NOT NULL THEN
    UPDATE auth.users SET email=v_alias,phone=NULL,phone_confirmed_at=NULL,confirmation_token='',recovery_token='',email_change_token_new='',email_change_token_current='',email_change='',email_change_confirm_status=0,phone_change_token='',phone_change='',reauthentication_token='' WHERE id=v_auth.id;
    UPDATE auth.identities SET identity_data=CASE WHEN identity_data?'email' THEN jsonb_set(identity_data,'{email}',to_jsonb(v_alias)) ELSE identity_data END-'phone' WHERE user_id=v_auth.id;
    DELETE FROM auth.one_time_tokens WHERE user_id=v_auth.id;
    DELETE FROM auth.flow_state WHERE user_id=v_auth.id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.retire_student_identity(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE DELETE ON public.students FROM authenticated,service_role;


CREATE OR REPLACE FUNCTION public.retire_student(p_student_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_staff_id uuid; v_student public.students%ROWTYPE;
BEGIN
  SELECT staff.id INTO v_staff_id FROM public.staff AS staff
  WHERE staff.user_id = (SELECT auth.uid()) AND staff.role = 'ADMINSTAFF' AND staff.status = 'ACTIVE';
  IF v_staff_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Active AdminStaff access required'; END IF;
  SELECT * INTO v_student FROM public.students WHERE id=p_student_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Student not found'; END IF;
  IF v_student.deleted_at IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.classes_students WHERE student_id=p_student_id AND (unenrolled_at IS NULL OR unenrolled_at>now())) THEN
      RAISE EXCEPTION 'Resolve active enrolments before deleting this Student';
    END IF;
    IF EXISTS (SELECT 1 FROM public.sessions_students AS participant JOIN public.sessions AS session ON session.id=participant.session_id WHERE participant.student_id=p_student_id AND participant.planned_absence=false AND session.status='ACTIVE' AND session.start_at>now())
      OR EXISTS (SELECT 1 FROM public.slot_reservations WHERE reserved_by=v_student.user_id AND expires_at>now() AND start_at>now()) THEN
      RAISE EXCEPTION 'Resolve future bookings before deleting this Student';
    END IF;
    IF EXISTS (SELECT 1 FROM public.student_subscriptions WHERE student_id=p_student_id AND status NOT IN ('canceled','incomplete_expired')) THEN
      RAISE EXCEPTION 'Resolve subscriptions before deleting this Student';
    END IF;
    IF EXISTS(SELECT 1 FROM public.ucat_checkout_holds WHERE student_id=p_student_id) THEN
      RAISE EXCEPTION 'Resolve open checkouts before deleting this Student';
    END IF;
    PERFORM public.retire_student_identity(p_student_id,v_staff_id);
    SELECT * INTO v_student FROM public.students WHERE id=p_student_id;
  END IF;
  RETURN jsonb_build_object('student_id',v_student.id,'deleted_at',v_student.deleted_at);
END;
$$;
REVOKE ALL ON FUNCTION public.retire_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retire_student(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';


CREATE OR REPLACE FUNCTION public.restore_deleted_student_identity(p_student_id uuid,p_auth_user_id uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_student public.students%ROWTYPE; v_auth_id uuid;
BEGIN
  SELECT * INTO v_student FROM public.students WHERE id=p_student_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Student not found'; END IF;
  IF v_student.deleted_at IS NULL THEN RETURN v_student.id; END IF;
  SELECT auth_user_id INTO v_auth_id FROM public.student_retired_logins WHERE student_id=v_student.id AND deleted_at=v_student.deleted_at;
  IF p_auth_user_id IS NOT NULL AND p_auth_user_id IS DISTINCT FROM v_auth_id THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='This login cannot restore that Student'; END IF;
  IF v_auth_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.students WHERE user_id=v_auth_id AND id<>v_student.id) THEN RAISE EXCEPTION 'This login already belongs to another Student'; END IF;
  PERFORM set_config('altitutor.student_deletion_command','restore',true);
  UPDATE public.students SET deleted_at=NULL,deleted_by=NULL,user_id=v_auth_id WHERE id=v_student.id;
  PERFORM set_config('altitutor.student_deletion_command','',true);
  UPDATE public.student_deletion_history SET restored_at=clock_timestamp() WHERE student_id=v_student.id AND deleted_at=v_student.deleted_at;
  IF v_auth_id IS NOT NULL THEN UPDATE auth.users SET raw_app_meta_data=raw_app_meta_data-'retired_student_id' WHERE id=v_auth_id; END IF;
  RETURN v_student.id;
END;
$$;
REVOKE ALL ON FUNCTION public.restore_deleted_student_identity(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.restore_my_deleted_student() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user_id uuid=(SELECT auth.uid()); v_student_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Sign in to restore your Student'; END IF;
  SELECT student.id INTO v_student_id FROM public.student_retired_logins AS login
  JOIN public.students AS student ON student.id=login.student_id AND student.deleted_at=login.deleted_at
  WHERE login.auth_user_id=v_user_id;
  IF v_student_id IS NULL THEN RETURN NULL; END IF;
  RETURN public.restore_deleted_student_identity(v_student_id,v_user_id);
END;
$$;
REVOKE ALL ON FUNCTION public.restore_my_deleted_student() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.restore_my_deleted_student() TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_student(p_student_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT (SELECT public.is_adminstaff_active()) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Active AdminStaff access required'; END IF;
  RETURN public.restore_deleted_student_identity(p_student_id);
END;
$$;
REVOKE ALL ON FUNCTION public.restore_student(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.restore_student(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';


CREATE TABLE public.student_login_recovery_limits (
 key text PRIMARY KEY, window_started_at timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.student_login_recovery_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_login_recovery_limits FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.student_retired_login_candidates(p_email text,p_client_key text)
RETURNS TABLE(login_email text,auth_user_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_email text=lower(btrim(p_email)); v_key text; v_attempts integer;
BEGIN
  IF (SELECT auth.jwt()->>'role') IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Service access required'; END IF;
  IF length(v_email)>320 OR v_email='' OR p_client_key IS NULL OR p_client_key !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid login request'; END IF;
  FOREACH v_key IN ARRAY ARRAY['client:'||p_client_key,'email:'||encode(extensions.digest(v_email,'sha256'),'hex')] LOOP
    INSERT INTO public.student_login_recovery_limits AS budget(key) VALUES(v_key)
    ON CONFLICT(key) DO UPDATE SET
      window_started_at=CASE WHEN budget.window_started_at<now()-interval '15 minutes' THEN now() ELSE budget.window_started_at END,
      attempts=CASE WHEN budget.window_started_at<now()-interval '15 minutes' THEN 1 ELSE budget.attempts+1 END,
      updated_at=now()
    RETURNING attempts INTO v_attempts;
    IF v_attempts>6 THEN RAISE EXCEPTION 'student_login_recovery_rate_limited'; END IF;
  END LOOP;
  IF random()<0.01 THEN DELETE FROM public.student_login_recovery_limits WHERE updated_at<now()-interval '1 day'; END IF;
  RETURN QUERY SELECT auth_user.email::text,login.auth_user_id FROM public.student_retired_logins AS login
  JOIN auth.users AS auth_user ON auth_user.id=login.auth_user_id
  WHERE auth_user.email IS NOT NULL AND login.login_alias IS NOT NULL AND login.login_emails @> ARRAY[v_email]
  ORDER BY login.deleted_at DESC LIMIT 11;
END;
$$;
REVOKE ALL ON FUNCTION public.student_retired_login_candidates(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.student_retired_login_candidates(text,text) TO service_role;
NOTIFY pgrst,'reload schema';


CREATE OR REPLACE FUNCTION public.guard_student_retirement_changes() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE command text=current_setting('altitutor.student_deletion_command',true);
BEGIN
  IF OLD.deleted_at IS NOT NULL AND command IS DISTINCT FROM 'restore' THEN
    IF (to_jsonb(NEW)-ARRAY['updated_at','ucat_unlimited_trial_consumed_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['updated_at','ucat_unlimited_trial_consumed_at']) THEN
      RAISE EXCEPTION 'Restore this Student before making changes';
    END IF;
  END IF;
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND command IS DISTINCT FROM 'retire' AND command IS DISTINCT FROM 'restore' THEN
    RAISE EXCEPTION 'Use the Student deletion or restore action';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_student_retirement_changes BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.guard_student_retirement_changes();

CREATE FUNCTION public.require_live_student_for_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE student_id uuid=(to_jsonb(NEW)->>TG_ARGV[0])::uuid; retired timestamptz;
BEGIN
  IF student_id IS NULL THEN RETURN NEW; END IF;
  -- The same row lock as retirement serializes admission against the final guard checks.
  SELECT deleted_at INTO retired FROM public.students WHERE id=student_id FOR UPDATE;
  IF retired IS NOT NULL THEN RAISE EXCEPTION 'Restore this Student before starting new activity'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.require_live_student_for_activity() FROM PUBLIC,anon,authenticated,service_role;
DO $$
DECLARE relation text;
BEGIN
  FOREACH relation IN ARRAY ARRAY['classes_students','sessions_students','students_online_access_manual','ucat_checkout_holds','student_practice_sessions','student_question_attempts','student_question_set_attempts','student_skill_trainer_attempts','student_ucat_mock_attempts','ucat_active_exam_attempts','ucat_student_learning_module_progress','ucat_student_learning_module_block_progress','interview_presence'] LOOP
    EXECUTE format('CREATE TRIGGER z_require_live_student BEFORE INSERT OR UPDATE OF student_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.require_live_student_for_activity(''student_id'')',relation);
  END LOOP;
END;
$$;
CREATE TRIGGER z_require_live_student_enrolment BEFORE UPDATE OF unenrolled_at ON public.classes_students FOR EACH ROW WHEN (NEW.unenrolled_at IS NULL OR NEW.unenrolled_at>now()) EXECUTE FUNCTION public.require_live_student_for_activity('student_id');
CREATE TRIGGER z_require_live_student_contact BEFORE INSERT OR UPDATE OF student_id ON public.contacts FOR EACH ROW WHEN (NEW.retired_at IS NULL) EXECUTE FUNCTION public.require_live_student_for_activity('student_id');
CREATE TRIGGER z_require_live_student_subscription BEFORE INSERT OR UPDATE OF student_id,status ON public.student_subscriptions FOR EACH ROW WHEN (NEW.status NOT IN ('canceled','incomplete_expired')) EXECUTE FUNCTION public.require_live_student_for_activity('student_id');


ALTER TABLE public.contacts ADD CONSTRAINT retired_contact_has_no_routing_handles CHECK (retired_at IS NULL OR (phone_e164 IS NULL AND email IS NULL AND is_opted_out));
CREATE FUNCTION public.guard_retired_contact_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF OLD.retired_at IS NOT NULL AND NEW.retired_at IS DISTINCT FROM OLD.retired_at THEN
    RAISE EXCEPTION 'A retired Contact cannot be reused';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_retired_contact_identity BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.guard_retired_contact_identity();


CREATE OR REPLACE FUNCTION sync_student_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_contact_id UUID;
  conflict_student_id UUID;
  conflict_staff_id UUID;
  conflict_parent_id UUID;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  -- On UPDATE: If phone changed, orphan the old contact
  IF TG_OP = 'UPDATE' AND OLD.phone IS DISTINCT FROM NEW.phone THEN
    UPDATE public.contacts
    SET student_id = NULL,
        contact_type = CASE 
          WHEN staff_id IS NOT NULL THEN 'STAFF'
          WHEN parent_id IS NOT NULL THEN 'PARENT'
          ELSE 'LEAD'
        END
    WHERE student_id = OLD.id;
  END IF;

  -- If new phone is NULL, we're done
  IF NEW.phone IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if this phone is already linked to a different person
  SELECT student_id, staff_id, parent_id, id
  INTO conflict_student_id, conflict_staff_id, conflict_parent_id, existing_contact_id
  FROM public.contacts
  WHERE phone_e164 = NEW.phone AND retired_at IS NULL;

  -- If contact exists, check for conflicts
  IF existing_contact_id IS NOT NULL THEN
    -- Check if phone is already used by another student
    IF conflict_student_id IS NOT NULL AND conflict_student_id != NEW.id THEN
      RAISE EXCEPTION 'Phone number % is already associated with another student (ID: %)', NEW.phone, conflict_student_id;
    END IF;
    
    -- Check if phone is already used by a staff member
    IF conflict_staff_id IS NOT NULL THEN
      RAISE EXCEPTION 'Phone number % is already associated with a staff member (ID: %)', NEW.phone, conflict_staff_id;
    END IF;
    
    -- Check if phone is already used by a parent
    IF conflict_parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Phone number % is already associated with a parent (ID: %)', NEW.phone, conflict_parent_id;
    END IF;

    -- No conflict, update the contact
    UPDATE public.contacts
    SET student_id = NEW.id,
        contact_type = 'STUDENT'
    WHERE id = existing_contact_id;
  ELSE
    -- Create new contact with ON CONFLICT handling for race conditions
    INSERT INTO public.contacts (phone_e164, student_id, contact_type)
    VALUES (NEW.phone, NEW.id, 'STUDENT')
    ON CONFLICT (phone_e164) DO UPDATE
    SET student_id = EXCLUDED.student_id,
        contact_type = EXCLUDED.contact_type
    WHERE contacts.student_id IS NULL AND contacts.retired_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_staff_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_contact_id UUID;
  conflict_student_id UUID;
  conflict_staff_id UUID;
  conflict_parent_id UUID;
BEGIN
  -- On UPDATE: If phone changed, orphan the old contact
  IF TG_OP = 'UPDATE' AND OLD.phone_number IS DISTINCT FROM NEW.phone_number THEN
    UPDATE public.contacts
    SET staff_id = NULL,
        contact_type = CASE 
          WHEN student_id IS NOT NULL THEN 'STUDENT'
          WHEN parent_id IS NOT NULL THEN 'PARENT'
          ELSE 'LEAD'
        END
    WHERE staff_id = OLD.id;
  END IF;

  -- If new phone is NULL, we're done
  IF NEW.phone_number IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if this phone is already linked to a different person
  SELECT student_id, staff_id, parent_id, id
  INTO conflict_student_id, conflict_staff_id, conflict_parent_id, existing_contact_id
  FROM public.contacts
  WHERE phone_e164 = NEW.phone_number AND retired_at IS NULL;

  -- If contact exists, check for conflicts
  IF existing_contact_id IS NOT NULL THEN
    -- Check if phone is already used by a student
    IF conflict_student_id IS NOT NULL THEN
      RAISE EXCEPTION 'Phone number % is already associated with a student (ID: %)', NEW.phone_number, conflict_student_id;
    END IF;
    
    -- Check if phone is already used by another staff member
    IF conflict_staff_id IS NOT NULL AND conflict_staff_id != NEW.id THEN
      RAISE EXCEPTION 'Phone number % is already associated with another staff member (ID: %)', NEW.phone_number, conflict_staff_id;
    END IF;
    
    -- Check if phone is already used by a parent
    IF conflict_parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Phone number % is already associated with a parent (ID: %)', NEW.phone_number, conflict_parent_id;
    END IF;

    -- No conflict, update the contact
    UPDATE public.contacts
    SET staff_id = NEW.id,
        contact_type = 'STAFF'
    WHERE id = existing_contact_id;
  ELSE
    -- Create new contact with ON CONFLICT handling for race conditions
    INSERT INTO public.contacts (phone_e164, staff_id, contact_type)
    VALUES (NEW.phone_number, NEW.id, 'STAFF')
    ON CONFLICT (phone_e164) DO UPDATE
    SET staff_id = EXCLUDED.staff_id,
        contact_type = EXCLUDED.contact_type
    WHERE contacts.staff_id IS NULL AND contacts.retired_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_parent_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_contact_id UUID;
  conflict_student_id UUID;
  conflict_staff_id UUID;
  conflict_parent_id UUID;
BEGIN
  -- On UPDATE: If phone changed, orphan the old contact
  IF TG_OP = 'UPDATE' AND OLD.phone IS DISTINCT FROM NEW.phone THEN
    UPDATE public.contacts
    SET parent_id = NULL,
        contact_type = CASE 
          WHEN student_id IS NOT NULL THEN 'STUDENT'
          WHEN staff_id IS NOT NULL THEN 'STAFF'
          ELSE 'LEAD'
        END
    WHERE parent_id = OLD.id;
  END IF;

  -- If new phone is NULL, we're done
  IF NEW.phone IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if this phone is already linked to a different person
  SELECT student_id, staff_id, parent_id, id
  INTO conflict_student_id, conflict_staff_id, conflict_parent_id, existing_contact_id
  FROM public.contacts
  WHERE phone_e164 = NEW.phone AND retired_at IS NULL;

  -- If contact exists, check for conflicts
  IF existing_contact_id IS NOT NULL THEN
    -- Check if phone is already used by a student
    IF conflict_student_id IS NOT NULL THEN
      RAISE EXCEPTION 'Phone number % is already associated with a student (ID: %)', NEW.phone, conflict_student_id;
    END IF;
    
    -- Check if phone is already used by a staff member
    IF conflict_staff_id IS NOT NULL THEN
      RAISE EXCEPTION 'Phone number % is already associated with a staff member (ID: %)', NEW.phone, conflict_staff_id;
    END IF;
    
    -- Check if phone is already used by another parent
    IF conflict_parent_id IS NOT NULL AND conflict_parent_id != NEW.id THEN
      RAISE EXCEPTION 'Phone number % is already associated with another parent (ID: %)', NEW.phone, conflict_parent_id;
    END IF;

    -- No conflict, update the contact
    UPDATE public.contacts
    SET parent_id = NEW.id,
        contact_type = 'PARENT'
    WHERE id = existing_contact_id;
  ELSE
    -- Create new contact with ON CONFLICT handling for race conditions
    INSERT INTO public.contacts (phone_e164, parent_id, contact_type)
    VALUES (NEW.phone, NEW.id, 'PARENT')
    ON CONFLICT (phone_e164) DO UPDATE
    SET parent_id = EXCLUDED.parent_id,
        contact_type = EXCLUDED.contact_type
    WHERE contacts.parent_id IS NULL AND contacts.retired_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_messaging_email_contact(p_contact_id uuid, p_entity_type text, p_entity_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  source public.contacts%ROWTYPE;
  target public.contacts%ROWTYPE;
  source_conversation public.conversations%ROWTYPE;
  target_conversation public.conversations%ROWTYPE;
  target_id uuid;
  candidate_count integer;
  profile_phone text;
  profile_email text;
  was_unread boolean;
BEGIN
  IF NOT (COALESCE(auth.role(), '') = 'service_role' OR public.is_adminstaff_active()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('messaging-email-link', 0));
  SELECT * INTO source FROM public.contacts WHERE id = p_contact_id AND retired_at IS NULL FOR UPDATE;
  IF source.id IS NULL OR NULLIF(btrim(source.email), '') IS NULL OR source.phone_e164 IS NOT NULL THEN
    RAISE EXCEPTION 'Select an email-only contact';
  END IF;
  IF source.student_id IS NOT NULL OR source.parent_id IS NOT NULL OR source.staff_id IS NOT NULL THEN
    IF (p_entity_type = 'student' AND source.student_id = p_entity_id)
      OR (p_entity_type = 'parent' AND source.parent_id = p_entity_id)
      OR (p_entity_type = 'staff' AND source.staff_id = p_entity_id) THEN RETURN source.id; END IF;
    RAISE EXCEPTION 'This Apple ID is already linked to another person';
  END IF;
  IF p_entity_type = 'student' THEN
    SELECT phone, email INTO profile_phone, profile_email FROM public.students WHERE id = p_entity_id AND deleted_at IS NULL;
  ELSIF p_entity_type = 'parent' THEN
    SELECT phone, email INTO profile_phone, profile_email FROM public.parents WHERE id = p_entity_id;
  ELSIF p_entity_type = 'staff' THEN
    SELECT phone_number, email INTO profile_phone, profile_email FROM public.staff WHERE id = p_entity_id;
  ELSE RAISE EXCEPTION 'Invalid person type'; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Person not found'; END IF;

  SELECT count(*), (array_agg(id ORDER BY created_at, id))[1] INTO candidate_count, target_id
  FROM public.contacts WHERE retired_at IS NULL AND (
    (p_entity_type = 'student' AND student_id = p_entity_id) OR
    (p_entity_type = 'parent' AND parent_id = p_entity_id) OR
    (p_entity_type = 'staff' AND staff_id = p_entity_id));
  IF candidate_count > 1 THEN RAISE EXCEPTION 'This person has multiple contacts; resolve those before linking'; END IF;
  -- Reuse an unlinked phone contact if the profile was not synchronised yet.
  IF target_id IS NULL AND profile_phone IS NOT NULL THEN
    SELECT id INTO target_id FROM public.contacts WHERE phone_e164 = profile_phone AND retired_at IS NULL;
  END IF;
  IF target_id IS NULL THEN
    UPDATE public.contacts SET email = lower(btrim(email)), phone_e164 = profile_phone,
      contact_type = upper(p_entity_type),
      student_id = CASE WHEN p_entity_type = 'student' THEN p_entity_id END,
      parent_id = CASE WHEN p_entity_type = 'parent' THEN p_entity_id END,
      staff_id = CASE WHEN p_entity_type = 'staff' THEN p_entity_id END
    WHERE id = source.id;
    RETURN source.id;
  END IF;

  SELECT * INTO target FROM public.contacts WHERE id = target_id AND retired_at IS NULL FOR UPDATE;
  IF (target.student_id IS NOT NULL AND NOT (p_entity_type = 'student' AND target.student_id = p_entity_id))
    OR (target.parent_id IS NOT NULL AND NOT (p_entity_type = 'parent' AND target.parent_id = p_entity_id))
    OR (target.staff_id IS NOT NULL AND NOT (p_entity_type = 'staff' AND target.staff_id = p_entity_id)) THEN
    RAISE EXCEPTION 'The phone contact belongs to another person';
  END IF;
  -- An unused profile-email copy is not an established Apple ID address.
  IF NULLIF(btrim(target.email), '') IS NOT NULL AND lower(btrim(target.email)) <> lower(btrim(source.email))
    AND NOT (lower(btrim(target.email)) = COALESCE(lower(btrim(profile_email)), '')
      AND NOT EXISTS (
        SELECT 1 FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
        WHERE c.contact_id = target.id AND
          (lower(btrim(m.from_number_e164)) = lower(btrim(target.email)) OR lower(btrim(m.to_number_e164)) = lower(btrim(target.email)))
      )) THEN
    RAISE EXCEPTION 'This person already has a different Apple ID email';
  END IF;
  IF EXISTS (SELECT 1 FROM public.contacts c WHERE c.retired_at IS NULL AND lower(btrim(c.email)) = lower(btrim(source.email))
    AND c.id NOT IN (source.id, target.id)
    AND (c.student_id IS NOT NULL OR c.parent_id IS NOT NULL OR c.staff_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'This Apple ID is already linked to another person';
  END IF;

  UPDATE public.contacts SET email = lower(btrim(source.email)), contact_type = upper(p_entity_type),
    student_id = CASE WHEN p_entity_type = 'student' THEN p_entity_id END,
    parent_id = CASE WHEN p_entity_type = 'parent' THEN p_entity_id END,
    staff_id = CASE WHEN p_entity_type = 'staff' THEN p_entity_id END,
    is_opted_out = target.is_opted_out OR source.is_opted_out,
    opted_out_at = COALESCE(target.opted_out_at, source.opted_out_at)
  WHERE id = target.id;

  FOR source_conversation IN SELECT * FROM public.conversations WHERE contact_id = source.id ORDER BY id FOR UPDATE LOOP
    target_conversation := NULL;
    IF source_conversation.status IN ('OPEN', 'SNOOZED') THEN
      SELECT * INTO target_conversation FROM public.conversations
      WHERE contact_id = target.id AND owned_number_id = source_conversation.owned_number_id
        AND status IN ('OPEN', 'SNOOZED') AND NOT is_group_chat FOR UPDATE;
    END IF;
    IF target_conversation.id IS NOT NULL THEN
      -- Any unread live inbound thread keeps the combined history unread.
      SELECT EXISTS (
        SELECT 1 FROM public.conversations c WHERE c.id IN (source_conversation.id, target_conversation.id)
          AND NOT EXISTS (SELECT 1 FROM public.conversation_reads r WHERE r.conversation_id = c.id)
          AND EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id
            AND m.direction = 'INBOUND' AND NOT m.is_historical_import AND NOT m.is_reaction)
      ) INTO was_unread;
      UPDATE public.messages SET conversation_id = target_conversation.id WHERE conversation_id = source_conversation.id;
      UPDATE public.imessage_commands SET conversation_id = target_conversation.id WHERE conversation_id = source_conversation.id;
      IF was_unread THEN
        DELETE FROM public.conversation_reads WHERE conversation_id IN (source_conversation.id, target_conversation.id);
      ELSE
        INSERT INTO public.conversation_reads (conversation_id, staff_id, last_read_message_id, last_read_at, auto_read_message_id)
        SELECT target_conversation.id, staff_id, last_read_message_id, last_read_at, auto_read_message_id
        FROM public.conversation_reads WHERE conversation_id = source_conversation.id
        ON CONFLICT (conversation_id, staff_id) DO NOTHING;
      END IF;
      UPDATE public.conversations SET
        needs_follow_up = target_conversation.needs_follow_up OR source_conversation.needs_follow_up,
        is_pinned = target_conversation.is_pinned OR source_conversation.is_pinned,
        assigned_staff_id = COALESCE(target_conversation.assigned_staff_id, source_conversation.assigned_staff_id),
        status = CASE WHEN target_conversation.status = 'OPEN' OR source_conversation.status = 'OPEN' THEN 'OPEN' ELSE 'SNOOZED' END
      WHERE id = target_conversation.id;
      UPDATE public.conversations c SET last_message_id = m.id,
        last_message_at = COALESCE(m.sent_at, m.created_at), last_message_direction = m.direction
      FROM (SELECT id, direction, sent_at, created_at FROM public.messages WHERE conversation_id = target_conversation.id
        ORDER BY COALESCE(sent_at, created_at) DESC, id DESC LIMIT 1) m WHERE c.id = target_conversation.id;
      -- Keep the old conversation ID valid for existing references, without a second inbox entry.
      UPDATE public.conversations SET status = 'ARCHIVED', contact_id = target.id,
        last_message_id = NULL, last_message_at = NULL, last_message_direction = NULL WHERE id = source_conversation.id;
    ELSE
      UPDATE public.conversations SET contact_id = target.id WHERE id = source_conversation.id;
    END IF;
  END LOOP;
  INSERT INTO public.group_chat_participants (conversation_id, contact_id)
    SELECT conversation_id, target.id FROM public.group_chat_participants WHERE contact_id = source.id
    ON CONFLICT (conversation_id, contact_id) DO NOTHING;
  DELETE FROM public.group_chat_participants WHERE contact_id = source.id;
  UPDATE public.onboarding_journeys SET contact_id = target.id WHERE contact_id = source.id;
  -- Keep the unlinked source contact for historical delivery/merge audit references.
  -- Email resolution below prefers the linked canonical contact; it has all conversations.
  RETURN target.id;
END;
$$;
REVOKE ALL ON FUNCTION public.link_messaging_email_contact(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_messaging_email_contact(uuid,text,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_messaging_email_contact(p_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  handle text := lower(btrim(p_email));
  contact_id uuid;
  linked_count integer;
  matches integer;
  person_type text;
  person_id uuid;
  target_email text;
BEGIN
  IF NOT (COALESCE(auth.role(), '') = 'service_role' OR public.is_adminstaff_active()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF handle IS NULL OR handle !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Invalid Apple ID email';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('messaging-email-link', 0));
  SELECT count(*), (array_agg(id ORDER BY created_at, id))[1] INTO linked_count, contact_id
  FROM public.contacts WHERE retired_at IS NULL AND lower(btrim(email)) = handle
    AND (student_id IS NOT NULL OR parent_id IS NOT NULL OR staff_id IS NOT NULL);
  IF linked_count = 1 THEN RETURN contact_id; END IF;

  SELECT id INTO contact_id FROM public.contacts WHERE retired_at IS NULL AND lower(btrim(email)) = handle
    AND student_id IS NULL AND parent_id IS NULL AND staff_id IS NULL ORDER BY created_at, id LIMIT 1;
  IF contact_id IS NULL THEN
    INSERT INTO public.contacts (email, contact_type) VALUES (handle, 'LEAD') RETURNING id INTO contact_id;
  END IF;
  IF linked_count > 1 THEN RETURN contact_id; END IF;

  SELECT count(*), (array_agg(kind))[1], (array_agg(id))[1] INTO matches, person_type, person_id
  FROM (
    SELECT 'student' AS kind, id FROM public.students WHERE deleted_at IS NULL AND lower(btrim(email)) = handle
    UNION ALL SELECT 'parent', id FROM public.parents WHERE lower(btrim(email)) = handle
    UNION ALL SELECT 'staff', id FROM public.staff WHERE lower(btrim(email)) = handle
  ) people;
  IF matches <> 1 THEN RETURN contact_id; END IF;
  SELECT count(*), (array_agg(email))[1] INTO matches, target_email FROM public.contacts WHERE retired_at IS NULL AND (
    (person_type = 'student' AND student_id = person_id) OR
    (person_type = 'parent' AND parent_id = person_id) OR
    (person_type = 'staff' AND staff_id = person_id));
  IF matches > 1 THEN RETURN contact_id; END IF;
  -- A profile match must not replace an explicitly linked, different Apple ID.
  IF NULLIF(btrim(target_email), '') IS NOT NULL AND lower(btrim(target_email)) <> handle THEN RETURN contact_id; END IF;
  RETURN public.link_messaging_email_contact(contact_id, person_type, person_id);
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_messaging_email_contact(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_messaging_email_contact(text) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.current_student_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id FROM public.students WHERE user_id = (select auth.uid()) AND deleted_at IS NULL;
$function$;

CREATE OR REPLACE FUNCTION public.current_student_portal_access()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT jsonb_build_object(
    'student_id', student_record.id,
    'active_staff_role', active_staff.role
  )
  FROM (SELECT (SELECT auth.uid()) AS user_id) AS caller
  LEFT JOIN LATERAL (
    SELECT student.id
    FROM public.students AS student
    WHERE student.user_id = caller.user_id AND student.deleted_at IS NULL
    LIMIT 1
  ) AS student_record ON TRUE
  LEFT JOIN LATERAL (
    SELECT staff.role::TEXT AS role
    FROM public.staff AS staff
    WHERE staff.user_id = caller.user_id
      AND staff.role IN ('ADMINSTAFF', 'TUTOR')
      AND staff.status = 'ACTIVE'
    LIMIT 1
  ) AS active_staff ON TRUE
  WHERE caller.user_id IS NOT NULL;
$function$;

CREATE OR REPLACE FUNCTION public.get_student_ucat_online_tier(p_student_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN s.ucat_online_tier_override = 'force_free' THEN 'free'
    WHEN s.ucat_online_tier_override = 'force_unlimited' THEN 'unlimited'
    WHEN EXISTS (SELECT 1 FROM public.student_subscriptions ss WHERE ss.student_id = p_student_id
      AND ss.subject_id = public.get_ucat_subject_id() AND ss.status IN ('trialing','active','past_due')) THEN 'unlimited'
    WHEN EXISTS (SELECT 1 FROM public.ucat_founder_redemptions r WHERE r.student_id = p_student_id
      AND r.stripe_subscription_id IS NULL AND r.kind = 'access_pass' AND r.status = 'redeemed' AND r.access_ends_at > now()) THEN 'unlimited'
    ELSE 'free' END
  FROM public.students s WHERE s.id = p_student_id AND s.deleted_at IS NULL
    AND (s.user_id = (SELECT auth.uid()) OR (SELECT auth.jwt() ->> 'role') = 'service_role');
$function$;

CREATE OR REPLACE FUNCTION public.is_student()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.students 
    WHERE user_id = (select auth.uid()) AND deleted_at IS NULL
  );
$function$;

CREATE OR REPLACE FUNCTION public.link_precreated_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Only the registration server sets app metadata after validating the
  -- Student's durable bearer link. Never authorize this from user metadata.
  IF NEW.raw_app_meta_data ? 'registration_student_id' THEN
    UPDATE public.students st
      SET user_id = NEW.id
      WHERE st.id = (NEW.raw_app_meta_data ->> 'registration_student_id')::uuid
        AND st.user_id IS NULL
        AND st.status = 'TRIAL'
        AND LOWER(st.email) = LOWER(NEW.email);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Registration Student is unavailable for account linking'
        USING ERRCODE = '23514';
    END IF;
    -- Do not fall through to email matching, including a matching staff row.
    RETURN NEW;
  END IF;

  -- Auth admin.createUser applies custom app metadata AFTER inserting the user,
  -- inside the same transaction. An untrusted hint can defer opportunistic
  -- matching, but cannot choose or grant access to any Student. The metadata
  -- update trigger below performs the actual server-authorized link.
  IF TG_OP = 'UPDATE' OR NEW.raw_user_meta_data ? 'registration_student_id' THEN
    RETURN NEW;
  END IF;

  -- Prefer invite token if present in raw_user_meta_data
  IF (NEW.raw_user_meta_data ? 'invite_token') THEN
    UPDATE public.staff s
      SET user_id = NEW.id
      WHERE s.user_id IS NULL
        AND s.invite_token = (NEW.raw_user_meta_data ->> 'invite_token')::uuid;
    IF FOUND THEN
      RETURN NEW;
    END IF;

    UPDATE public.students st
      SET user_id = NEW.id
      WHERE st.user_id IS NULL AND st.deleted_at IS NULL
        AND st.invite_token = (NEW.raw_user_meta_data ->> 'invite_token')::uuid;
    RETURN NEW;
  END IF;

  -- Fallback: link by email address (only if email is not NULL)
  UPDATE public.staff s
    SET user_id = NEW.id
    WHERE s.user_id IS NULL
      AND s.email IS NOT NULL
      AND LOWER(s.email) = LOWER(NEW.email);
  IF FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE public.students st
    SET user_id = NEW.id
    WHERE st.user_id IS NULL AND st.deleted_at IS NULL
      AND st.email IS NOT NULL
      AND LOWER(st.email) = LOWER(NEW.email);

  RETURN NEW;
END;$function$;

CREATE OR REPLACE FUNCTION public.search_online_students_admin(p_search text DEFAULT NULL::text, p_products text[] DEFAULT NULL::text[], p_entitlements text[] DEFAULT NULL::text[], p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_order_by text DEFAULT 'last_name'::text, p_ascending boolean DEFAULT true, p_search_fields text[] DEFAULT ARRAY['name'::text, 'email'::text, 'phone'::text], p_account_classes text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_search_lower TEXT := NULLIF(LOWER(TRIM(COALESCE(p_search, ''))), '');
  v_students JSONB;
  v_total_count BIGINT;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('students', '[]'::jsonb, 'total', 0);
  END IF;

  WITH online_students AS (
    SELECT
      student.id,
      student.first_name,
      student.last_name,
      student.email,
      student.phone,
      student.school,
      student.curriculum,
      student.year_level,
      student.status AS in_person_status,
      student.created_at,
      student.updated_at,
      MIN(relationship.started_at) AS online_since,
      jsonb_agg(
        jsonb_build_object(
          'product', relationship.product,
          'tier', CASE
            WHEN relationship.product = 'UCAT_WEB'
              AND student.ucat_online_tier_override = 'force_free' THEN 'FREE'
            WHEN relationship.product = 'UCAT_WEB'
              AND student.ucat_online_tier_override = 'force_unlimited' THEN 'UNLIMITED'
            WHEN EXISTS (
              SELECT 1
              FROM public.student_subscriptions tier_subscription
              WHERE tier_subscription.student_id = student.id
                AND tier_subscription.status IN ('trialing', 'active', 'past_due')
            ) THEN 'UNLIMITED'
            ELSE 'FREE'
          END,
          'started_at', relationship.started_at,
          'closed_at', relationship.closed_at
        ) ORDER BY relationship.started_at, relationship.product
      ) AS products,
      CASE WHEN EXISTS (
        SELECT 1
        FROM public.student_subscriptions subscription
        WHERE subscription.student_id = student.id
          AND subscription.status IN ('trialing', 'active', 'past_due')
      ) OR student.ucat_online_tier_override = 'force_unlimited'
      THEN 'PAID' ELSE 'FREE' END AS entitlement,
      (
        SELECT subscription.status
        FROM public.student_subscriptions subscription
        WHERE subscription.student_id = student.id
        ORDER BY subscription.updated_at DESC NULLS LAST, subscription.created_at DESC
        LIMIT 1
      ) AS subscription_status
    FROM public.students student
    JOIN public.student_online_product_relationships relationship
      ON relationship.student_id = student.id
      AND relationship.closed_at IS NULL
    WHERE student.deleted_at IS NULL AND (
        v_search_lower IS NULL
        OR ('name' = ANY(p_search_fields) AND LOWER(CONCAT_WS(' ', student.first_name, student.last_name)) LIKE '%' || v_search_lower || '%')
        OR ('email' = ANY(p_search_fields) AND LOWER(COALESCE(student.email, '')) LIKE '%' || v_search_lower || '%')
        OR ('phone' = ANY(p_search_fields) AND COALESCE(student.phone, '') LIKE '%' || v_search_lower || '%')
      )
      AND (
        p_products IS NULL
        OR array_length(p_products, 1) IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.student_online_product_relationships product_filter
          WHERE product_filter.student_id = student.id
            AND product_filter.closed_at IS NULL
            AND product_filter.product = ANY(p_products)
        )
      )
      AND (
        p_account_classes IS NULL
        OR array_length(p_account_classes, 1) IS NULL
        OR student.account_class = ANY(p_account_classes)
      )
    GROUP BY student.id
  ),
  filtered_students AS (
    SELECT *,
      CASE
        WHEN v_search_lower IS NULL THEN 0
        WHEN LOWER(CONCAT_WS(' ', first_name, last_name)) = v_search_lower THEN 1000
        WHEN LOWER(CONCAT_WS(' ', first_name, last_name)) LIKE v_search_lower || '%' THEN 900
        ELSE 800
      END AS relevance_score
    FROM online_students
    WHERE p_entitlements IS NULL
      OR array_length(p_entitlements, 1) IS NULL
      OR entitlement = ANY(p_entitlements)
  ),
  paginated_students AS (
    SELECT *
    FROM filtered_students
    ORDER BY
      relevance_score DESC,
      CASE WHEN p_order_by = 'first_name' AND p_ascending THEN first_name END ASC,
      CASE WHEN p_order_by = 'first_name' AND NOT p_ascending THEN first_name END DESC,
      CASE WHEN p_order_by = 'last_name' AND p_ascending THEN last_name END ASC,
      CASE WHEN p_order_by = 'last_name' AND NOT p_ascending THEN last_name END DESC,
      CASE WHEN p_order_by = 'online_since' AND p_ascending THEN online_since END ASC,
      CASE WHEN p_order_by = 'online_since' AND NOT p_ascending THEN online_since END DESC,
      last_name ASC,
      first_name ASC
    LIMIT GREATEST(p_limit, 0)
    OFFSET GREATEST(p_offset, 0)
  )
  SELECT
    COALESCE(jsonb_agg(to_jsonb(page_student) - 'relevance_score'), '[]'::jsonb),
    (SELECT COUNT(*) FROM filtered_students)
  INTO v_students, v_total_count
  FROM paginated_students page_student;

  RETURN jsonb_build_object('students', v_students, 'total', COALESCE(v_total_count, 0));
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_students_admin(p_search text DEFAULT NULL::text, p_statuses text[] DEFAULT ARRAY['ACTIVE'::text, 'TRIAL'::text], p_subject_ids uuid[] DEFAULT NULL::uuid[], p_include_relationships boolean DEFAULT true, p_exclude_class_search boolean DEFAULT false, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_order_by text DEFAULT 'last_name'::text, p_ascending boolean DEFAULT true, p_subscription_filter text DEFAULT NULL::text, p_in_person_filter text DEFAULT NULL::text, p_search_fields text[] DEFAULT ARRAY['name'::text, 'email'::text, 'phone'::text])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_search_lower TEXT := NULLIF(LOWER(TRIM(COALESCE(p_search, ''))), '');
  v_students JSONB;
  v_total_count BIGINT;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('students', '[]'::jsonb, 'total', 0);
  END IF;

  WITH filtered_students AS (
    SELECT
      student.*,
      EXISTS (
        SELECT 1 FROM public.student_subscriptions subscription
        WHERE subscription.student_id = student.id
      ) AS has_online_subscription,
      EXISTS (
        SELECT 1 FROM public.classes_students enrollment
        WHERE enrollment.student_id = student.id
          AND enrollment.unenrolled_at IS NULL
      ) AS has_in_person_class,
      CASE
        WHEN v_search_lower IS NULL THEN 0
        WHEN LOWER(CONCAT_WS(' ', student.first_name, student.last_name)) = v_search_lower THEN 1000
        WHEN LOWER(CONCAT_WS(' ', student.first_name, student.last_name)) LIKE v_search_lower || '%' THEN 900
        ELSE 800
      END AS relevance_score
    FROM public.students student
    WHERE student.deleted_at IS NULL AND student.status IS NOT NULL
      AND (
        v_search_lower IS NULL
        OR ('name' = ANY(p_search_fields) AND LOWER(CONCAT_WS(' ', student.first_name, student.last_name)) LIKE '%' || v_search_lower || '%')
        OR ('email' = ANY(p_search_fields) AND LOWER(COALESCE(student.email, '')) LIKE '%' || v_search_lower || '%')
        OR ('phone' = ANY(p_search_fields) AND COALESCE(student.phone, '') LIKE '%' || v_search_lower || '%')
        OR (
          NOT p_exclude_class_search
          AND EXISTS (
            SELECT 1
            FROM public.classes_students enrollment
            JOIN public.classes class ON class.id = enrollment.class_id
            WHERE enrollment.student_id = student.id
              AND (
                LOWER(COALESCE(class.short_name, '')) LIKE '%' || v_search_lower || '%'
                OR LOWER(COALESCE(class.long_name, '')) LIKE '%' || v_search_lower || '%'
              )
          )
        )
      )
      AND (
        p_statuses IS NULL
        OR array_length(p_statuses, 1) IS NULL
        OR student.status = ANY(p_statuses)
      )
      AND (
        p_subject_ids IS NULL
        OR array_length(p_subject_ids, 1) IS NULL
        OR EXISTS (
          SELECT 1 FROM public.students_subjects student_subject
          WHERE student_subject.student_id = student.id
            AND student_subject.subject_id = ANY(p_subject_ids)
        )
        OR EXISTS (
          SELECT 1 FROM public.students_online_access_manual manual_access
          WHERE manual_access.student_id = student.id
            AND manual_access.subject_id = ANY(p_subject_ids)
        )
        OR EXISTS (
          SELECT 1
          FROM public.classes_students enrollment
          JOIN public.classes class ON class.id = enrollment.class_id
          WHERE enrollment.student_id = student.id
            AND enrollment.unenrolled_at IS NULL
            AND class.subject_id = ANY(p_subject_ids)
        )
      )
      AND (
        p_subscription_filter IS NULL
        OR p_subscription_filter NOT IN ('has', 'none')
        OR (p_subscription_filter = 'has' AND EXISTS (
          SELECT 1 FROM public.student_subscriptions subscription
          WHERE subscription.student_id = student.id
        ))
        OR (p_subscription_filter = 'none' AND NOT EXISTS (
          SELECT 1 FROM public.student_subscriptions subscription
          WHERE subscription.student_id = student.id
        ))
      )
      AND (
        p_in_person_filter IS NULL
        OR p_in_person_filter NOT IN ('has', 'none')
        OR (p_in_person_filter = 'has' AND EXISTS (
          SELECT 1 FROM public.classes_students enrollment
          WHERE enrollment.student_id = student.id
            AND enrollment.unenrolled_at IS NULL
        ))
        OR (p_in_person_filter = 'none' AND NOT EXISTS (
          SELECT 1 FROM public.classes_students enrollment
          WHERE enrollment.student_id = student.id
            AND enrollment.unenrolled_at IS NULL
        ))
      )
  ),
  paginated_students AS (
    SELECT *
    FROM filtered_students
    ORDER BY
      relevance_score DESC,
      CASE WHEN p_order_by = 'first_name' AND p_ascending THEN first_name END ASC,
      CASE WHEN p_order_by = 'first_name' AND NOT p_ascending THEN first_name END DESC,
      CASE WHEN p_order_by = 'last_name' AND p_ascending THEN last_name END ASC,
      CASE WHEN p_order_by = 'last_name' AND NOT p_ascending THEN last_name END DESC,
      CASE WHEN p_order_by = 'status' AND p_ascending THEN status END ASC,
      CASE WHEN p_order_by = 'status' AND NOT p_ascending THEN status END DESC,
      CASE WHEN p_order_by = 'created_at' AND p_ascending THEN created_at END ASC,
      CASE WHEN p_order_by = 'created_at' AND NOT p_ascending THEN created_at END DESC,
      last_name ASC,
      first_name ASC
    LIMIT GREATEST(p_limit, 0)
    OFFSET GREATEST(p_offset, 0)
  )
  SELECT
    COALESCE(jsonb_agg(
      to_jsonb(page_student) - 'relevance_score' || jsonb_build_object(
        'classes', CASE WHEN p_include_relationships THEN (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', class.id,
            'short_name', class.short_name,
            'long_name', class.long_name,
            'day_of_week', class.day_of_week,
            'start_time', class.start_time::TEXT,
            'end_time', class.end_time::TEXT,
            'level', class.level,
            'subject', CASE WHEN subject.id IS NULL THEN NULL ELSE jsonb_build_object(
              'id', subject.id,
              'curriculum', subject.curriculum,
              'year_level', subject.year_level,
              'name', subject.name,
              'discipline', subject.discipline,
              'level', subject.level,
              'color', subject.color,
              'short_name', subject.short_name,
              'long_name', subject.long_name
            ) END
          ) ORDER BY class.day_of_week, class.start_time), '[]'::jsonb)
          FROM public.classes_students enrollment
          JOIN public.classes class ON class.id = enrollment.class_id
          LEFT JOIN public.subjects subject ON subject.id = class.subject_id
          WHERE enrollment.student_id = page_student.id
            AND enrollment.unenrolled_at IS NULL
        ) ELSE '[]'::jsonb END
      )
    ), '[]'::jsonb),
    (SELECT COUNT(*) FROM filtered_students)
  INTO v_students, v_total_count
  FROM paginated_students page_student;

  RETURN jsonb_build_object('students', v_students, 'total', COALESCE(v_total_count, 0));
END;
$function$;


ALTER TABLE public.students ADD CONSTRAINT retired_student_has_no_live_identity CHECK (deleted_at IS NULL OR (user_id IS NULL AND email IS NULL AND phone IS NULL AND invite_token IS NULL AND registration_public_token IS NULL AND legacy_registration_token IS NULL));
CREATE FUNCTION public.guard_student_identity_admission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' AND NEW.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Use the Student deletion action'; END IF;
  IF NEW.user_id IS NOT NULL THEN
    PERFORM id FROM auth.users WHERE id=NEW.user_id FOR UPDATE;
    IF EXISTS(SELECT 1 FROM public.student_retired_logins login JOIN public.students student ON student.id=login.student_id AND student.deleted_at=login.deleted_at WHERE login.auth_user_id=NEW.user_id AND student.id<>NEW.id) THEN
      RAISE EXCEPTION 'Sign in again to restore your existing Student';
    END IF;
    IF EXISTS(SELECT 1 FROM public.students WHERE user_id=NEW.user_id AND id<>NEW.id) THEN
      RAISE EXCEPTION 'This login already belongs to another Student';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_student_identity_admission BEFORE INSERT OR UPDATE OF user_id ON public.students FOR EACH ROW EXECUTE FUNCTION public.guard_student_identity_admission();

CREATE FUNCTION public.guard_future_session_students() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.status='ACTIVE' AND NEW.start_at>now() THEN
    PERFORM student.id FROM public.students student JOIN public.sessions_students participant ON participant.student_id=student.id
    WHERE participant.session_id=NEW.id AND participant.planned_absence=false ORDER BY student.id FOR UPDATE OF student;
    IF EXISTS(SELECT 1 FROM public.sessions_students participant JOIN public.students student ON student.id=participant.student_id WHERE participant.session_id=NEW.id AND participant.planned_absence=false AND student.deleted_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Restore this Student before starting new activity';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_future_session_students() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER guard_future_session_students BEFORE UPDATE OF start_at,status ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.guard_future_session_students();

CREATE OR REPLACE VIEW public.vstudent_slot_reservations WITH (security_invoker=false) AS
SELECT sr.id,sr.start_at,sr.end_at,sr.subject_id,sr.staff_id,sr.reserved_by,sr.expires_at,sr.created_at,sr.session_type
FROM public.slot_reservations sr WHERE sr.reserved_by=(select auth.uid()) AND public.current_student_id() IS NOT NULL;

CREATE INDEX student_login_recovery_limits_updated_at_idx ON public.student_login_recovery_limits(updated_at);


CREATE FUNCTION public.suppress_retired_student_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE retired timestamptz;
BEGIN
  SELECT deleted_at INTO retired FROM public.students WHERE id=NEW.student_id FOR UPDATE;
  IF retired IS NOT NULL THEN
    NEW.status='suppressed'; NEW.delivery_status='suppressed'; NEW.claimed_at=NULL; NEW.last_error='Student deleted';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.suppress_retired_student_email() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER suppress_retired_student_email BEFORE INSERT ON public.ucat_transactional_email_outbox FOR EACH ROW EXECUTE FUNCTION public.suppress_retired_student_email();


CREATE INDEX students_deleted_at_idx ON public.students(deleted_at DESC,id) WHERE deleted_at IS NOT NULL;
CREATE INDEX student_deletion_history_student_idx ON public.student_deletion_history(student_id,deleted_at);
CREATE INDEX student_retired_logins_student_idx ON public.student_retired_logins(student_id,deleted_at);
CREATE INDEX student_retired_logins_email_idx ON public.student_retired_logins USING gin(login_emails);
REVOKE ALL ON FUNCTION public.guard_student_retirement_changes(),public.guard_student_identity_admission(),public.guard_retired_contact_identity() FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';

-- Resolved future assignments are history, but cannot be reactivated while retired.
CREATE FUNCTION public.guard_resolved_student_booking() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT NEW.planned_absence AND EXISTS(SELECT 1 FROM public.sessions WHERE id=NEW.session_id AND status='ACTIVE' AND start_at>now()) THEN
  PERFORM id FROM public.students WHERE id=NEW.student_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.students WHERE id=NEW.student_id AND deleted_at IS NOT NULL) THEN
   RAISE EXCEPTION 'Restore this Student before starting new activity';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER guard_resolved_student_booking BEFORE UPDATE OF planned_absence ON public.sessions_students FOR EACH ROW EXECUTE FUNCTION public.guard_resolved_student_booking();

-- Reservations belong to an Auth actor. Serialize against the Student row before
-- deciding whether the actor is retired; preserve unrelated live Staff/Parent use.
CREATE FUNCTION public.guard_retired_student_reservation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE student_ids uuid[];
BEGIN
 SELECT array_agg(id) INTO student_ids FROM (
  SELECT id FROM public.students WHERE user_id=NEW.reserved_by
  UNION SELECT student_id FROM public.student_retired_logins WHERE auth_user_id=NEW.reserved_by
 ) identities;
 -- Capture stable IDs before waiting so unlinking user_id cannot remove the lock target.
 PERFORM id FROM public.students WHERE id=ANY(student_ids) ORDER BY id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.student_retired_logins login JOIN public.students student ON student.id=login.student_id AND student.deleted_at=login.deleted_at WHERE login.auth_user_id=NEW.reserved_by)
  AND NOT EXISTS(SELECT 1 FROM public.staff WHERE user_id=NEW.reserved_by AND status IN ('ACTIVE','TRIAL'))
  AND NOT EXISTS(SELECT 1 FROM public.parents WHERE user_id=NEW.reserved_by) THEN
  RAISE EXCEPTION 'Restore this Student before starting new activity';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER guard_retired_student_reservation BEFORE INSERT OR UPDATE OF reserved_by,start_at,expires_at ON public.slot_reservations FOR EACH ROW WHEN(NEW.start_at>now() AND NEW.expires_at>now()) EXECUTE FUNCTION public.guard_retired_student_reservation();
REVOKE ALL ON FUNCTION public.guard_resolved_student_booking(),public.guard_retired_student_reservation() FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
