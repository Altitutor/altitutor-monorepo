-- DEV-276: retained business records. Configuration deletion is deliberately unchanged.
CREATE SCHEMA admin_retention;
REVOKE ALL ON SCHEMA admin_retention FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA admin_retention TO authenticated;

CREATE FUNCTION admin_retention.table_for(p_kind text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT CASE p_kind
    WHEN 'staff' THEN 'staff' WHEN 'parent' THEN 'parents' WHEN 'class' THEN 'classes'
    WHEN 'subject' THEN 'subjects' WHEN 'topic' THEN 'topics' WHEN 'task' THEN 'tasks'
    WHEN 'project' THEN 'projects' WHEN 'issue' THEN 'issues' WHEN 'document' THEN 'notes_documents'
    WHEN 'folder' THEN 'notes_folders' WHEN 'admin_shift' THEN 'admin_shifts'
    WHEN 'session' THEN 'sessions' WHEN 'tutor_log' THEN 'tutor_logs' END;
$$;
REVOKE ALL ON FUNCTION admin_retention.table_for(text) FROM PUBLIC,anon,authenticated,service_role;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['staff','parents','classes','subjects','topics','tasks','projects','issues','notes_documents','notes_folders','admin_shifts','sessions','tutor_logs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN deleted_at timestamptz, ADD COLUMN deleted_by uuid',t);
    EXECUTE format('CREATE INDEX %I ON public.%I(deleted_at,id) WHERE deleted_at IS NOT NULL',t||'_retained_deletion',t);
  END LOOP;
END $$;

CREATE TABLE admin_retention.history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, entity_id uuid NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT clock_timestamp(), deleted_by uuid REFERENCES public.staff(id),
  restored_at timestamptz, restored_by uuid REFERENCES public.staff(id), snapshot jsonb NOT NULL
);
CREATE INDEX history_entity ON admin_retention.history(kind,entity_id,deleted_at DESC);
ALTER TABLE admin_retention.history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_retention.history FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION admin_retention.assert_actor() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;
BEGIN
  SELECT id INTO actor FROM public.staff WHERE user_id=(SELECT auth.uid()) AND role='ADMINSTAFF' AND status='ACTIVE' AND deleted_at IS NULL;
  IF actor IS NULL THEN RAISE EXCEPTION 'Active AdminStaff access required' USING ERRCODE='42501'; END IF;
  RETURN actor;
END $$;
REVOKE ALL ON FUNCTION admin_retention.assert_actor() FROM PUBLIC,anon,authenticated,service_role;

-- This function takes the parent lock also used by admission guards below. Existing
-- relationships remain intact; live work must be resolved through its normal workflow.
CREATE FUNCTION admin_retention.assert_resolved(p_kind text,p_id uuid,p_record jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_kind='staff' THEN
    IF (p_record->>'user_id')::uuid=(SELECT auth.uid()) THEN RAISE EXCEPTION 'You cannot delete your own Staff record'; END IF;
    IF EXISTS(SELECT 1 FROM public.classes_staff a JOIN public.classes c ON c.id=a.class_id WHERE a.staff_id=p_id AND (a.unassigned_at IS NULL OR a.unassigned_at>now()) AND c.deleted_at IS NULL AND c.status IN ('ACTIVE','FULL'))
       OR EXISTS(SELECT 1 FROM public.sessions_staff a JOIN public.sessions s ON s.id=a.session_id WHERE a.staff_id=p_id AND s.end_at>now() AND s.status='ACTIVE')
       OR EXISTS(SELECT 1 FROM public.admin_shifts_staff a JOIN public.admin_shifts s ON s.id=a.admin_shift_id WHERE a.staff_id=p_id AND s.deleted_at IS NULL AND s.status='ACTIVE') THEN
      RAISE EXCEPTION 'Resolve Staff assignments and future bookings before deletion';
    END IF;
  ELSIF p_kind='parent' THEN
    IF EXISTS(SELECT 1 FROM public.sessions_parents a JOIN public.sessions s ON s.id=a.session_id WHERE a.parent_id=p_id AND s.end_at>now() AND s.status='ACTIVE') THEN RAISE EXCEPTION 'Resolve future Parent bookings before deletion'; END IF;
  ELSIF p_kind='class' THEN
    IF p_record->>'status'<>'INACTIVE'
       OR EXISTS(SELECT 1 FROM public.classes_students WHERE class_id=p_id AND (unenrolled_at IS NULL OR unenrolled_at>now()))
       OR EXISTS(SELECT 1 FROM public.sessions WHERE class_id=p_id AND end_at>now() AND status='ACTIVE') THEN
      RAISE EXCEPTION 'Make the Class inactive and resolve enrolments and future bookings before deletion';
    END IF;
  ELSIF p_kind='admin_shift' THEN
    IF p_record->>'status'<>'INACTIVE' OR EXISTS(SELECT 1 FROM public.sessions WHERE admin_shift_id=p_id AND end_at>now() AND status='ACTIVE') THEN RAISE EXCEPTION 'Make the Admin shift inactive and resolve future bookings before deletion'; END IF;
  ELSIF p_kind='session' THEN
    IF p_record->>'status'='ACTIVE' AND (p_record->>'end_at')::timestamptz>now() THEN RAISE EXCEPTION 'Resolve the active Session before deletion'; END IF;
  ELSIF p_kind='tutor_log' THEN
    IF EXISTS(SELECT 1 FROM public.sessions WHERE id=(p_record->>'session_id')::uuid AND status='ACTIVE' AND end_at>now()) THEN RAISE EXCEPTION 'Resolve the active Session before deleting its Tutor log'; END IF;
  ELSIF p_kind='subject' THEN
    IF EXISTS(SELECT 1 FROM public.classes WHERE subject_id=p_id AND deleted_at IS NULL AND status IN ('ACTIVE','FULL'))
       OR EXISTS(SELECT 1 FROM public.topics WHERE subject_id=p_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Resolve active Classes and Topics before deleting this Subject'; END IF;
  ELSIF p_kind='topic' THEN
    IF EXISTS(SELECT 1 FROM public.topics WHERE parent_id=p_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Resolve child Topics before deleting this Topic'; END IF;
  ELSIF p_kind='task' THEN
    IF p_record->>'status' IN ('in_progress','in_review') THEN RAISE EXCEPTION 'Resolve active work before deleting this Task'; END IF;
  ELSIF p_kind='project' THEN
    IF p_record->>'status'='in_progress' OR EXISTS(SELECT 1 FROM public.tasks WHERE project_id=p_id AND deleted_at IS NULL AND status IN ('in_progress','in_review')) THEN RAISE EXCEPTION 'Resolve active work before deleting this Project'; END IF;
  ELSIF p_kind='issue' THEN
    IF EXISTS(SELECT 1 FROM public.tasks WHERE issue_id=p_id AND deleted_at IS NULL AND status IN ('in_progress','in_review')) THEN RAISE EXCEPTION 'Resolve active work before deleting this Issue'; END IF;
  ELSIF p_kind='folder' THEN
    IF EXISTS(SELECT 1 FROM public.notes_documents WHERE folder_id=p_id AND deleted_at IS NULL) OR EXISTS(SELECT 1 FROM public.notes_folders WHERE parent_id=p_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Move or delete the Folder contents first'; END IF;
  END IF;
END $$;
REVOKE ALL ON FUNCTION admin_retention.assert_resolved(text,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION admin_retention.release_person(p_kind text,p_id uuid,p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE shared_login boolean; alias text;
BEGIN
  -- Routing identities are retained for correspondence history, with no live handles.
  UPDATE public.contacts SET retired_at=clock_timestamp(),retired_phone_e164=phone_e164,retired_email=email,retired_opt_out=is_opted_out,
    phone_e164=NULL,email=NULL,is_opted_out=true
  WHERE retired_at IS NULL AND ((p_kind='staff' AND staff_id=p_id AND student_id IS NULL AND parent_id IS NULL)
    OR (p_kind='parent' AND parent_id=p_id AND student_id IS NULL AND staff_id IS NULL));
  IF p_user IS NULL THEN RETURN; END IF;
  PERFORM 1 FROM auth.users WHERE id=p_user FOR UPDATE;
  shared_login := EXISTS(SELECT 1 FROM public.students WHERE user_id=p_user AND deleted_at IS NULL)
    OR EXISTS(SELECT 1 FROM public.staff WHERE user_id=p_user AND deleted_at IS NULL AND status IN ('ACTIVE','TRIAL') AND (p_kind<>'staff' OR id<>p_id))
    OR EXISTS(SELECT 1 FROM public.parents WHERE user_id=p_user AND deleted_at IS NULL AND (p_kind<>'parent' OR id<>p_id));
  IF NOT shared_login THEN
    alias := 'retired-business-'||replace(p_user::text,'-','')||'@accounts.invalid';
    UPDATE auth.users SET email=alias,phone=NULL,phone_confirmed_at=NULL,confirmation_token='',recovery_token='',email_change_token_new='',email_change_token_current='',email_change='',email_change_confirm_status=0,phone_change_token='',phone_change='',reauthentication_token='' WHERE id=p_user;
    UPDATE auth.identities SET identity_data=CASE WHEN identity_data?'email' THEN jsonb_set(identity_data,'{email}',to_jsonb(alias)) ELSE identity_data END-'phone' WHERE user_id=p_user;
    DELETE FROM auth.one_time_tokens WHERE user_id=p_user;
    DELETE FROM auth.flow_state WHERE user_id=p_user;
  END IF;
END $$;
REVOKE ALL ON FUNCTION admin_retention.release_person(text,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION admin_retention.retire(p_kind text,p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := admin_retention.assert_actor(); tab text:=admin_retention.table_for(p_kind); item jsonb; prior text:=current_setting('app.business_retention',true);
BEGIN
  IF tab IS NULL THEN RAISE EXCEPTION 'Unsupported business record' USING ERRCODE='22023'; END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 FOR UPDATE',tab) INTO item USING p_id;
  IF item IS NULL THEN RAISE EXCEPTION 'Business record not found' USING ERRCODE='P0002'; END IF;
  IF item->>'deleted_at' IS NOT NULL THEN RETURN; END IF;
  PERFORM admin_retention.assert_resolved(p_kind,p_id,item);
  INSERT INTO admin_retention.history(kind,entity_id,deleted_by,snapshot) VALUES(p_kind,p_id,actor,item-ARRAY['invite_token']);
  IF p_kind IN ('staff','parent') THEN PERFORM admin_retention.release_person(p_kind,p_id,(item->>'user_id')::uuid); END IF;
  PERFORM set_config('app.business_retention','retire',true);
  EXECUTE format('UPDATE public.%I SET deleted_at=clock_timestamp(),deleted_by=$2%s WHERE id=$1',tab,
    CASE p_kind WHEN 'staff' THEN ',status=''INACTIVE'',user_id=NULL,email=NULL,phone_number=NULL,invite_token=NULL'
      WHEN 'parent' THEN ',user_id=NULL,email=NULL,phone=NULL,invite_token=NULL' ELSE '' END) USING p_id,actor;
  IF p_kind='topic' THEN PERFORM public.recalculate_topic_indices_for_siblings((item->>'subject_id')::uuid,(item->>'parent_id')::uuid); END IF;
  PERFORM set_config('app.business_retention',coalesce(prior,''),true);
END $$;
REVOKE ALL ON FUNCTION admin_retention.retire(text,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Ordinary DELETE callers retain their existing authorization and edit leases.
-- Cancelling the physical DELETE also prevents cascading loss of history.
CREATE FUNCTION admin_retention.retain_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM admin_retention.retire(tg_argv[0],OLD.id); RETURN NULL; END $$;
REVOKE ALL ON FUNCTION admin_retention.retain_delete() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION admin_retention.guard_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  -- Topic hierarchy triggers may refresh derived codes on retained descendants.
  -- They cannot change identity, position, ownership or the deletion lifecycle.
  IF tg_table_name='topics' AND OLD.deleted_at IS NOT NULL AND pg_trigger_depth()>1
     AND (to_jsonb(NEW)-ARRAY['code','updated_at'])=(to_jsonb(OLD)-ARRAY['code','updated_at']) THEN RETURN NEW; END IF;
  IF OLD.deleted_at IS NOT NULL OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR NEW.deleted_by IS DISTINCT FROM OLD.deleted_by THEN
    IF coalesce(current_setting('app.business_retention',true),'') NOT IN ('retire','restore') THEN RAISE EXCEPTION 'Use the business record deletion or restoration command' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION admin_retention.guard_update() FROM PUBLIC,anon,authenticated,service_role;

DO $$ DECLARE pair record; BEGIN
  FOR pair IN SELECT * FROM (VALUES ('staff','staff'),('parent','parents'),('class','classes'),('subject','subjects'),('topic','topics'),('task','tasks'),('project','projects'),('issue','issues'),('document','notes_documents'),('folder','notes_folders'),('admin_shift','admin_shifts'),('session','sessions'),('tutor_log','tutor_logs')) AS x(kind,tab) LOOP
    EXECUTE format('CREATE TRIGGER z_retain_business_delete BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION admin_retention.retain_delete(%L)',pair.tab,pair.kind);
    EXECUTE format('CREATE TRIGGER guard_business_retention BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION admin_retention.guard_update()',pair.tab);
    -- Existing policies still determine who may read/write live rows. Only the
    -- explicitly authorized archive interface below may read tombstones.
    EXECUTE format('CREATE POLICY live_business_record ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (deleted_at IS NULL) WITH CHECK (deleted_at IS NULL)',pair.tab);
  END LOOP;
END $$;
-- Soft deletion preserves protected/historical Sessions; deletion never cancels them.
DROP TRIGGER trigger_delete_only_pristine_class ON public.classes;
DROP TRIGGER trigger_delete_future_sessions_on_admin_shift_delete ON public.admin_shifts;
DROP TRIGGER orphan_staff_contact_trigger ON public.staff;
DROP TRIGGER orphan_parent_contact_trigger ON public.parents;
-- Keep historical contact ownership when deletion clears routing fields.
DROP TRIGGER sync_staff_contact_trigger ON public.staff;
CREATE TRIGGER sync_staff_contact_trigger AFTER INSERT OR UPDATE OF phone_number ON public.staff
FOR EACH ROW WHEN (NEW.deleted_at IS NULL) EXECUTE FUNCTION public.sync_staff_contact();
DROP TRIGGER sync_parent_contact_trigger ON public.parents;
CREATE TRIGGER sync_parent_contact_trigger AFTER INSERT OR UPDATE OF phone ON public.parents
FOR EACH ROW WHEN (NEW.deleted_at IS NULL) EXECUTE FUNCTION public.sync_parent_contact();

CREATE FUNCTION admin_retention.command(p_kind text,p_id uuid,p_restore boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=admin_retention.assert_actor(); tab text:=admin_retention.table_for(p_kind); item jsonb; prior text:=current_setting('app.business_retention',true); lease jsonb;
BEGIN
  IF p_kind='student' THEN
    IF p_restore THEN PERFORM public.restore_student(p_id); ELSE PERFORM public.retire_student(p_id); END IF;
    RETURN;
  END IF;
  IF tab IS NULL THEN RAISE EXCEPTION 'Unsupported business record' USING ERRCODE='22023'; END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 FOR UPDATE',tab) INTO item USING p_id;
  IF item IS NULL THEN RAISE EXCEPTION 'Business record not found' USING ERRCODE='P0002'; END IF;
  IF (p_restore AND item->>'deleted_at' IS NULL) OR (NOT p_restore AND item->>'deleted_at' IS NOT NULL) THEN RETURN; END IF;
  IF p_restore THEN PERFORM set_config('app.business_retention','restore',true); END IF;
  IF p_kind IN ('task','project','issue','document') THEN
    IF EXISTS(SELECT 1 FROM admin_operations.edit_sessions WHERE kind=p_kind AND entity_id=p_id AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'This record is being edited. Close its editor first.' USING ERRCODE='55P03'; END IF;
    -- Existing editor acquisition also checks actor/client and issues a fresh token.
    lease:=public.admin_work_item_edit(p_kind,p_id,'acquire');
    PERFORM set_config('app.work_item_edit_token',lease->>'token',true);
  END IF;
  IF p_restore THEN
    IF item->>'deleted_at' IS NULL THEN RETURN; END IF;
    -- Do not revive a child beneath a deleted owner.
    IF p_kind='topic' AND EXISTS(SELECT 1 FROM public.subjects WHERE id=(item->>'subject_id')::uuid AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'Restore the Subject first'; END IF;
    IF p_kind='topic' AND EXISTS(SELECT 1 FROM public.topics WHERE id=(item->>'parent_id')::uuid AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'Restore the parent Topic first'; END IF;
    IF p_kind IN ('folder','document') AND EXISTS(SELECT 1 FROM public.notes_folders WHERE id=coalesce(item->>'folder_id',item->>'parent_id')::uuid AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'Restore the Folder first'; END IF;
    PERFORM set_config('app.business_retention','restore',true);
    IF p_kind='topic' THEN
      UPDATE public.topics SET deleted_at=NULL,deleted_by=NULL,index=(SELECT coalesce(max(sibling.index),0)+1 FROM public.topics sibling WHERE sibling.subject_id=(item->>'subject_id')::uuid AND sibling.parent_id IS NOT DISTINCT FROM (item->>'parent_id')::uuid AND sibling.deleted_at IS NULL) WHERE topics.id=p_id;
    ELSIF p_kind='session' THEN
      UPDATE public.sessions SET deleted_at=NULL,deleted_by=NULL,calendar_tombstone_until=NULL WHERE id=p_id;
    ELSE
      EXECUTE format('UPDATE public.%I SET deleted_at=NULL,deleted_by=NULL WHERE id=$1',tab) USING p_id;
    END IF;
    UPDATE admin_retention.history SET restored_at=clock_timestamp(),restored_by=actor WHERE kind=p_kind AND entity_id=p_id AND restored_at IS NULL;
    PERFORM set_config('app.business_retention',coalesce(prior,''),true);
  ELSE
    PERFORM admin_retention.retire(p_kind,p_id);
  END IF;
  IF lease IS NOT NULL THEN
    DELETE FROM admin_operations.edit_sessions WHERE kind=p_kind AND entity_id=p_id;
    PERFORM set_config('app.work_item_edit_token','',true);
  END IF;
END $$;
REVOKE ALL ON FUNCTION admin_retention.command(text,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION admin_retention.command(text,uuid,boolean) TO authenticated;
CREATE FUNCTION public.retire_business_record(p_kind text,p_id uuid) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT admin_retention.command(p_kind,p_id,false) $$;
CREATE FUNCTION public.restore_business_record(p_kind text,p_id uuid) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT admin_retention.command(p_kind,p_id,true) $$;
REVOKE ALL ON FUNCTION public.retire_business_record(text,uuid),public.restore_business_record(text,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.retire_business_record(text,uuid),public.restore_business_record(text,uuid) TO authenticated;

-- Serialize new activity against retirement. Attribution/history links which are
-- unchanged by an UPDATE remain intact, including historical billing/session edits.
CREATE FUNCTION admin_retention.guard_live_references() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i integer:=0; value uuid; retired timestamptz;
BEGIN
  WHILE i<tg_nargs LOOP
    value:=(to_jsonb(NEW)->>tg_argv[i+1])::uuid;
    IF value IS NOT NULL AND (tg_op='INSERT' OR to_jsonb(NEW)->tg_argv[i+1] IS DISTINCT FROM to_jsonb(OLD)->tg_argv[i+1]) THEN
      EXECUTE format('SELECT deleted_at FROM public.%I WHERE id=$1 FOR KEY SHARE',tg_argv[i]) INTO retired USING value;
      IF retired IS NOT NULL THEN RAISE EXCEPTION 'Restore the deleted % record before linking new activity',tg_argv[i] USING ERRCODE='23514'; END IF;
    END IF;
    i:=i+2;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION admin_retention.guard_live_references() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE link record; BEGIN
  FOR link IN
    SELECT child.relname,string_agg(format('%L,%L',parent.relname,attribute.attname),',' ORDER BY constraint_row.conname) args
    FROM pg_catalog.pg_constraint constraint_row
    JOIN pg_catalog.pg_class child ON child.oid=constraint_row.conrelid
    JOIN pg_catalog.pg_class parent ON parent.oid=constraint_row.confrelid
    JOIN pg_catalog.pg_attribute attribute ON attribute.attrelid=child.oid AND attribute.attnum=constraint_row.conkey[1]
    WHERE constraint_row.contype='f' AND cardinality(constraint_row.conkey)=1 AND child.relnamespace='public'::regnamespace
      AND parent.relnamespace='public'::regnamespace AND parent.relname=ANY(ARRAY['staff','parents','classes','subjects','topics','tasks','projects','issues','notes_documents','notes_folders','admin_shifts','sessions','tutor_logs'])
    GROUP BY child.relname
  LOOP
    EXECUTE format('CREATE TRIGGER guard_live_business_references BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION admin_retention.guard_live_references(%s)',link.relname,link.args);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.preview_class_deletion(p_class_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE item public.classes; future_count integer; history_count integer; enrolled boolean;
BEGIN
  IF CURRENT_USER NOT IN ('postgres','service_role') AND NOT (SELECT public.is_adminstaff_active()) THEN RAISE EXCEPTION 'ADMINSTAFF access required' USING ERRCODE='42501'; END IF;
  SELECT * INTO item FROM public.classes WHERE id=p_class_id;
  SELECT count(*) FILTER(WHERE start_at>now() AND status='ACTIVE'),count(*) FILTER(WHERE start_at<=now()) INTO future_count,history_count FROM public.sessions WHERE class_id=p_class_id;
  SELECT EXISTS(SELECT 1 FROM public.classes_students WHERE class_id=p_class_id AND (unenrolled_at IS NULL OR unenrolled_at>now())) INTO enrolled;
  RETURN jsonb_build_object('future_session_count',future_count,'historical_session_count',history_count,'protected_future_session_count',future_count,
    'can_delete',item.id IS NOT NULL AND item.status='INACTIVE' AND NOT enrolled AND future_count=0);
END $$;

-- The archive is an explicit active-admin boundary; ordinary table RLS deliberately
-- hides deleted rows. Dynamic identifiers/labels are from this fixed registry only.
CREATE FUNCTION admin_retention.deleted_records() RETURNS TABLE(kind text,id uuid,name text,deleted_at timestamptz,can_restore boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entry record;
BEGIN
  PERFORM admin_retention.assert_actor();
  FOR entry IN SELECT * FROM (VALUES
    ('student','students','concat_ws('' '',first_name,last_name)',true),
    ('staff','staff','concat_ws('' '',first_name,last_name)',true),
    ('parent','parents','concat_ws('' '',first_name,last_name)',true),
    ('class','classes','coalesce(long_name,short_name,''Class'')',true),
    ('subject','subjects','name',true),('topic','topics','name',true),
    ('task','tasks','title',true),('project','projects','name',true),('issue','issues','name',true),
    ('document','notes_documents','title',true),('folder','notes_folders','name',true),
    ('admin_shift','admin_shifts','''Admin shift · ''||day_of_week::text||'' · ''||start_time::text',true),
    ('session','sessions','type::text||'' · ''||start_at::text',true),
    ('tutor_log','tutor_logs','''Tutor log · ''||created_at::text',true),
    ('invoice','invoices','coalesce(stripe_invoice_number,stripe_invoice_id,''Invoice'')',false),
    ('file','files','coalesce(filename,''File'')',false),
    ('form_response','form_responses','coalesce((SELECT name FROM public.forms WHERE id=form_id),''Form response'')',false),
    ('flashcard','flashcards','coalesce(nullif(left(cloze_text,120),''''),''Image occlusion card'')',false),
    ('question_stem','question_stems','coalesce(nullif(left(public.extract_text_from_prosemirror_json(stem_text),120),''''),''Question stem'')',false),
    ('question_set','question_sets','coalesce(nullif(left(public.extract_text_from_prosemirror_json(name),120),''''),''Question set'')',false),
    ('mock','ucat_mocks','name',false),
    ('learning_module','ucat_learning_modules','title',false),
    ('ucat_question','ucat_questions','coalesce(nullif(left(public.extract_text_from_prosemirror_json(question_text),120),''''),''UCAT question'')',false),
    ('skill_trainer_item','ucat_skill_trainer_items','''Skill trainer item''',false)
  ) AS x(kind,tab,label,restore) LOOP
    RETURN QUERY EXECUTE format('SELECT %L::text,id,(%s)::text,deleted_at,%L::boolean FROM public.%I WHERE deleted_at IS NOT NULL',entry.kind,entry.label,entry.restore,entry.tab);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION admin_retention.deleted_records() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION admin_retention.deleted_records() TO authenticated;
CREATE FUNCTION public.deleted_business_records() RETURNS TABLE(kind text,id uuid,name text,deleted_at timestamptz,can_restore boolean)
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM admin_retention.deleted_records() $$;
REVOKE ALL ON FUNCTION public.deleted_business_records() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.deleted_business_records() TO authenticated;

-- Existing role-scoped views retain their authorization and historical joins.
-- Apply retirement only to each directory's own records, not historical authors.
DO $$ DECLARE entry record; definition text; BEGIN
  FOR entry IN SELECT * FROM (VALUES
    ('vtutor_sessions','sessions','session_id'),('vstudent_sessions','sessions','session_id'),('vtutor_session_detail','sessions','session_id'),('vstudent_session_detail','sessions','session_id'),('vstudent_operational_session_base','sessions','session_id'),('vstudent_operational_sessions','sessions','session_id'),('vstudent_operational_session_detail','sessions','session_id'),('vtutor_operational_sessions','sessions','session_id'),('vtutor_operational_session_detail','sessions','session_id'),('vtutor_sessions_students','sessions','session_id'),('vtutor_operational_sessions_students','sessions','session_id'),
    ('vtutor_tutor_log','tutor_logs','tutor_log_id'),('vstudent_tutor_log','tutor_logs','tutor_log_id'),
    ('vtutor_classes','classes','id'),('vstudent_classes','classes','class_id'),
    ('vtutor_subjects','subjects','id'),('vstudent_online_subjects','subjects','id'),('vstudent_in_person_subjects','subjects','id'),
    ('vtutor_topics','topics','id'),('vstudent_topics','topics','id'),
    ('vstudent_subject_resources','topics','topic_id'),('vstudent_topics_files','topics','topic_id'),
    ('vstaff_flashcard_topics','topics','topic_id'),('vstudent_flashcard_topics','topics','topic_id'),('vstudent_flashcard_review_cards','topics','topic_id'),
    ('vtutor_documentation_documents','notes_documents','id'),('vtutor_documentation_folders','notes_folders','id'),
    ('vmarketing_staff_profiles','staff','staff_id'),('vtutor_pay_tier_profile','staff','staff_id'),('vtutor_profile','staff','id')
  ) AS x(view_name,tab,key) LOOP
    definition:=rtrim(pg_get_viewdef(format('public.%I',entry.view_name)::regclass,true),E'\n ;');
    EXECUTE format('CREATE OR REPLACE VIEW public.%I AS SELECT retained_view.* FROM (%s) retained_view WHERE NOT EXISTS(SELECT 1 FROM public.%I retired WHERE retired.id=retained_view.%I AND retired.deleted_at IS NOT NULL)',entry.view_name,definition,entry.tab,entry.key);
  END LOOP;
  FOR entry IN SELECT * FROM (VALUES ('staff'),('parents'),('classes'),('subjects'),('topics'),('tasks'),('projects'),('issues'),('notes_documents'),('notes_folders'),('admin_shifts'),('sessions'),('tutor_logs')) AS x(tab) LOOP
    definition:=rtrim(pg_get_viewdef(format('admin_reporting.%I',entry.tab)::regclass,true),E'\n ;');
    EXECUTE format('CREATE OR REPLACE VIEW admin_reporting.%I WITH(security_barrier=true) AS SELECT retained_view.* FROM (%s) retained_view WHERE NOT EXISTS(SELECT 1 FROM public.%I retired WHERE retired.id=retained_view.id AND retired.deleted_at IS NOT NULL)',entry.tab,definition,entry.tab);
  END LOOP;
END $$;

-- Public work-item reads and edit acquisition must not reopen retained rows.
ALTER FUNCTION public.admin_work_item_read(text,uuid) SET SCHEMA admin_retention;
REVOKE ALL ON FUNCTION admin_retention.admin_work_item_read(text,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION admin_retention.read_work_item(p_kind text,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tab text:=admin_retention.table_for(p_kind); retired timestamptz;
BEGIN
  PERFORM admin_retention.assert_actor();
  IF tab IS NOT NULL THEN
    EXECUTE format('SELECT deleted_at FROM public.%I WHERE id=$1',tab) INTO retired USING p_id;
    IF retired IS NOT NULL AND coalesce(current_setting('app.business_retention',true),'')<>'restore' THEN RAISE EXCEPTION 'Work item not found' USING ERRCODE='P0002'; END IF;
  END IF;
  RETURN admin_retention.admin_work_item_read(p_kind,p_id);
END $$;
REVOKE ALL ON FUNCTION admin_retention.read_work_item(text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION admin_retention.read_work_item(text,uuid) TO authenticated;
CREATE FUNCTION public.admin_work_item_read(p_kind text,p_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT admin_retention.read_work_item(p_kind,p_id) $$;
REVOKE ALL ON FUNCTION public.admin_work_item_read(text,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.admin_work_item_read(text,uuid) TO authenticated;

ALTER FUNCTION public.admin_work_item_edit(text,uuid,text,uuid,jsonb,text) SET SCHEMA admin_retention;
REVOKE ALL ON FUNCTION admin_retention.admin_work_item_edit(text,uuid,text,uuid,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION admin_retention.edit_work_item(p_kind text,p_id uuid,p_action text,p_token uuid,p_changes jsonb,p_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM admin_retention.read_work_item(p_kind,p_id);
  RETURN admin_retention.admin_work_item_edit(p_kind,p_id,p_action,p_token,p_changes,p_key);
END $$;
REVOKE ALL ON FUNCTION admin_retention.edit_work_item(text,uuid,text,uuid,jsonb,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION admin_retention.edit_work_item(text,uuid,text,uuid,jsonb,text) TO authenticated;
CREATE FUNCTION public.admin_work_item_edit(p_kind text,p_id uuid,p_action text,p_token uuid DEFAULT NULL,p_changes jsonb DEFAULT NULL,p_key text DEFAULT NULL) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT admin_retention.edit_work_item(p_kind,p_id,p_action,p_token,p_changes,p_key) $$;
REVOKE ALL ON FUNCTION public.admin_work_item_edit(text,uuid,text,uuid,jsonb,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.admin_work_item_edit(text,uuid,text,uuid,jsonb,text) TO authenticated;

-- Retained Topics do not occupy positions in the live hierarchy. Restoring one
-- appends it to the current siblings rather than stealing an occupied position.
DROP INDEX public.topics_subject_parent_index_unique;
DROP INDEX public.topics_subject_root_index_unique;
CREATE UNIQUE INDEX topics_subject_parent_index_unique ON public.topics(subject_id,parent_id,index) WHERE parent_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX topics_subject_root_index_unique ON public.topics(subject_id,index) WHERE parent_id IS NULL AND deleted_at IS NULL;
CREATE OR REPLACE FUNCTION public.recalculate_topic_indices_for_siblings(p_subject_id uuid,p_parent_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ids uuid[]; topic uuid; previous text:=current_setting('app.in_batch_update',true);
BEGIN
  PERFORM set_config('app.in_batch_update','true',true);
  SELECT array_agg(id ORDER BY index,created_at,id) INTO ids FROM public.topics WHERE subject_id=p_subject_id AND parent_id IS NOT DISTINCT FROM p_parent_id AND deleted_at IS NULL;
  UPDATE public.topics t SET index=-(positions.position+1000) FROM unnest(ids) WITH ORDINALITY positions(id,position) WHERE t.id=positions.id;
  UPDATE public.topics t SET index=positions.position FROM unnest(ids) WITH ORDINALITY positions(id,position) WHERE t.id=positions.id;
  FOREACH topic IN ARRAY coalesce(ids,'{}'::uuid[]) LOOP
    PERFORM public.recalculate_topic_code_and_descendants(topic);
    PERFORM public.recalculate_topic_file_codes_for_topic_and_descendants(topic);
  END LOOP;
  PERFORM set_config('app.in_batch_update',coalesce(nullif(previous,''),'false'),true);
END $$;
REVOKE ALL ON FUNCTION public.recalculate_topic_indices_for_siblings(uuid,uuid) FROM PUBLIC,anon,authenticated;

-- The legacy BEFORE trigger resolves its own Topic/Subject reads relative to
-- public, including when invoked from the restricted restoration command.
ALTER FUNCTION public.trigger_update_topic_code_on_change() SET search_path=public;

-- Directory RPCs bypass base-table RLS. Filter each original root query before
-- pagination/counting, keeping its authorization and historical joins intact.
DO $retention_search$
DECLARE entry record; proc record; definition text; revised text;
BEGIN
  FOR entry IN SELECT * FROM (VALUES
    ('search_parents_admin','(FROM (?:public\.)?parents parent\s+WHERE)\s*','parent.deleted_at IS NULL AND '),
    ('search_staff_admin','(FROM (?:public\.)?staff staff_member\s+WHERE)\s*','staff_member.deleted_at IS NULL AND '),
    ('search_classes_admin_core','(FROM (?:public\.)?classes c\s+WHERE)\s*','c.deleted_at IS NULL AND '),
    ('search_subjects_admin','(FROM (?:public\.)?subjects s\s+WHERE)\s*','s.deleted_at IS NULL AND '),
    ('search_subjects_public','(FROM (?:public\.)?subjects s\s+WHERE)\s*','s.deleted_at IS NULL AND '),
    ('search_topics_admin','(FROM (?:public\.)?topics t\s+JOIN (?:public\.)?subjects s ON s.id = t.subject_id\s+WHERE)\s*','t.deleted_at IS NULL AND '),
    ('search_sessions_admin','(FROM public.sessions s\s+WHERE)\s*','s.deleted_at IS NULL AND '),
    ('search_tutor_logs_admin','(FROM public.tutor_logs tl\s+JOIN public.sessions s ON s.id = tl.session_id\s+WHERE)\s*','tl.deleted_at IS NULL AND ')
  ) AS x(name,pattern,predicate) LOOP
    FOR proc IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=entry.name LOOP
      definition:=pg_get_functiondef(proc.oid);
      revised:=regexp_replace(definition,entry.pattern,E'\\1 '||entry.predicate,'g');
      IF revised=definition THEN RAISE EXCEPTION 'Retention predicate did not match %',entry.name; END IF;
      EXECUTE revised;
    END LOOP;
  END LOOP;
END $retention_search$;

-- Existing calendar maintenance archives only expired, pristine generated
-- cancellation tombstones. It never deletes an authored or active Session.
CREATE FUNCTION admin_retention.archive_calendar_tombstones() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; item public.sessions; archived integer:=0; prior text:=current_setting('app.business_retention',true);
BEGIN
  IF NOT coalesce((SELECT auth.role())='service_role' OR (session_user IN ('postgres','supabase_admin') AND current_setting('role') IN ('none','postgres')),false) THEN
    actor:=admin_retention.assert_actor();
  END IF;
  PERFORM set_config('app.business_retention','retire',true);
  FOR item IN SELECT * FROM public.sessions s WHERE s.deleted_at IS NULL AND s.status='INACTIVE'
    AND s.calendar_tombstone_until<=now() AND public.is_pristine_generated_class_session(s.id) FOR UPDATE LOOP
    INSERT INTO admin_retention.history(kind,entity_id,deleted_by,snapshot) VALUES('session',item.id,actor,to_jsonb(item));
    UPDATE public.sessions SET deleted_at=clock_timestamp(),deleted_by=actor WHERE id=item.id;
    archived:=archived+1;
  END LOOP;
  PERFORM set_config('app.business_retention',coalesce(prior,''),true);
  RETURN archived;
END $$;
REVOKE ALL ON FUNCTION admin_retention.archive_calendar_tombstones() FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA admin_retention TO service_role;
GRANT EXECUTE ON FUNCTION admin_retention.archive_calendar_tombstones() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.purge_expired_class_session_tombstones() RETURNS integer
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT admin_retention.archive_calendar_tombstones() $$;

-- Keep the one-log-per-Session invariant. Availability exposes only the state,
-- so a retired log leads to recovery rather than an impossible new submission.
CREATE VIEW public.vadmin_session_log_state WITH(security_barrier=true) AS
SELECT id,session_id,deleted_at FROM public.tutor_logs WHERE (SELECT public.is_adminstaff_active());
CREATE VIEW public.vtutor_session_log_state WITH(security_barrier=true) AS
SELECT log.id,log.session_id,log.deleted_at FROM public.tutor_logs log
JOIN public.vtutor_sessions session ON session.session_id=log.session_id;
REVOKE ALL ON public.vadmin_session_log_state,public.vtutor_session_log_state FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.vadmin_session_log_state,public.vtutor_session_log_state TO authenticated;
