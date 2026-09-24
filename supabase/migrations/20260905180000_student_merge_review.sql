-- Student identity consolidation is separate from authentication identity transfer.
CREATE TABLE public.student_merge_history (
  source_student_id uuid PRIMARY KEY,
  retained_student_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  merged_at timestamptz NOT NULL DEFAULT now(),
  snapshot jsonb NOT NULL,
  choices jsonb NOT NULL
);
CREATE INDEX ON public.student_merge_history(retained_student_id);
CREATE TABLE public.student_merge_retired_logins (
  user_id uuid PRIMARY KEY,
  retained_student_id uuid NOT NULL,
  retired_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.student_billing_customer_history (
  stripe_customer_id text PRIMARY KEY,
  student_id uuid NOT NULL,
  billing_snapshot jsonb NOT NULL
);
CREATE INDEX ON public.student_billing_customer_history(student_id);
CREATE TABLE public.student_contact_history (
  contact_id uuid PRIMARY KEY REFERENCES public.contacts(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE
);
CREATE INDEX ON public.student_contact_history(student_id);
ALTER TABLE public.student_contact_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.student_contact_history FOR SELECT TO authenticated USING ((select public.is_adminstaff_active()));
REVOKE ALL ON public.student_contact_history FROM anon,authenticated;
GRANT SELECT ON public.student_contact_history TO authenticated;
GRANT ALL ON public.student_contact_history TO service_role;

CREATE TABLE public.student_duplicate_dismissals (
  student_a uuid NOT NULL,
  student_b uuid NOT NULL,
  fingerprint text NOT NULL,
  actor_user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(student_a,student_b),
  CHECK(student_a < student_b)
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['student_merge_history','student_merge_retired_logins','student_billing_customer_history','student_duplicate_dismissals'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY admin_read ON public.%I FOR SELECT TO authenticated USING ((select public.is_adminstaff_active()))', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  END LOOP;
END $$;

CREATE FUNCTION public.resolve_merged_student_id(p_student_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT retained_student_id FROM student_merge_history WHERE source_student_id=p_student_id),p_student_id)
$$;
REVOKE ALL ON FUNCTION public.resolve_merged_student_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_merged_student_id(uuid) TO authenticated, service_role;

CREATE FUNCTION public.guard_retired_student_login() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP='INSERT' AND EXISTS(SELECT 1 FROM student_merge_history WHERE source_student_id=NEW.id))
    OR EXISTS(SELECT 1 FROM student_merge_retired_logins WHERE user_id=NEW.user_id) THEN
    RAISE EXCEPTION 'This student account was merged. Sign in with the retained account or contact Altitutor.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_retired_student_login BEFORE INSERT OR UPDATE OF user_id ON public.students
FOR EACH ROW EXECUTE FUNCTION public.guard_retired_student_login();

-- Internal dependency snapshot. Never exposed to the browser or executable by clients.
CREATE FUNCTION public.student_merge_snapshot(p_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; rows jsonb; result jsonb := '{}'::jsonb;
BEGIN
  SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) INTO rows FROM students s WHERE s.id=ANY(p_ids);
  result := jsonb_build_object('students',COALESCE(rows,'[]'::jsonb));
  FOR r IN SELECT DISTINCT n.nspname,cl.relname,a.attname FROM pg_constraint c
    JOIN pg_class cl ON cl.oid=c.conrelid JOIN pg_namespace n ON n.oid=cl.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
    WHERE c.contype='f' AND c.confrelid='public.students'::regclass AND cardinality(c.conkey)=1
    ORDER BY n.nspname,cl.relname,a.attname LOOP
    EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),''[]''::jsonb) FROM %I.%I x WHERE %I=ANY($1)',r.nspname,r.relname,r.attname) INTO rows USING p_ids;
    result := result || jsonb_build_object(r.relname||'.'||r.attname,rows);
  END LOOP;
  SELECT COALESCE(jsonb_agg(to_jsonb(n) ORDER BY id),'[]'::jsonb) INTO rows FROM notes n WHERE target_type IN ('student','students') AND target_id=ANY(p_ids);
  RETURN result || jsonb_build_object('notes',rows);
END $$;
REVOKE ALL ON FUNCTION public.student_merge_snapshot(uuid[]) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.preview_student_merge(p_retained uuid,p_source uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE snapshot jsonb; profiles jsonb; counts jsonb; blockers jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_adminstaff_active() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
  IF p_retained=p_source OR (SELECT count(*) FROM students WHERE id IN (p_retained,p_source))<>2 THEN
    RAISE EXCEPTION 'Select two different existing students';
  END IF;
  snapshot := student_merge_snapshot(ARRAY[p_retained,p_source]);
  SELECT jsonb_agg((to_jsonb(s)-ARRAY['invite_token','registration_public_token','legacy_registration_token']) || jsonb_build_object(
    'sign_in_methods',COALESCE((SELECT jsonb_agg(i.provider ORDER BY i.provider) FROM auth.identities i WHERE i.user_id=s.user_id),'[]'::jsonb),
    'login_email',(SELECT u.email FROM auth.users u WHERE u.id=s.user_id),
    'saved_cards',COALESCE((SELECT jsonb_agg(jsonb_build_object('brand',m.card_brand,'last4',m.card_last4,'is_default',m.is_default)) FROM student_payment_methods m WHERE m.student_id=s.id),'[]'::jsonb),
    'last_sign_in_at',(SELECT u.last_sign_in_at FROM auth.users u WHERE u.id=s.user_id),
    'billing',(SELECT to_jsonb(b) FROM students_billing b WHERE b.student_id=s.id),
    'parents',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',concat_ws(' ',p.first_name,p.last_name))) FROM parents_students ps JOIN parents p ON p.id=ps.parent_id WHERE ps.student_id=s.id),'[]'::jsonb)
  ) ORDER BY s.id) INTO profiles FROM students s WHERE s.id IN (p_retained,p_source);
  SELECT jsonb_object_agg(key,jsonb_array_length(value)) INTO counts FROM jsonb_each(snapshot) WHERE key <> 'students';
  IF EXISTS(SELECT 1 FROM sessions_students a JOIN sessions_students b USING(session_id) WHERE a.student_id=p_retained AND b.student_id=p_source) THEN
    blockers := blockers || '"Both records have attendance for the same session. Resolve that attendance before merging."'::jsonb;
  END IF;
  IF EXISTS(SELECT 1 FROM classes_students a JOIN classes_students b USING(class_id) WHERE a.student_id=p_retained AND b.student_id=p_source) THEN
    blockers := blockers || '"Both records have enrolment history for the same class. Resolve the overlap before merging."'::jsonb;
  END IF;
  IF EXISTS(SELECT 1 FROM student_subscriptions WHERE student_id IN (p_retained,p_source)) THEN
    blockers := blockers || '"Subscription consolidation requires a separate billing review."'::jsonb;
  END IF;
  IF EXISTS(SELECT 1 FROM student_payment_methods WHERE student_id=p_retained) AND EXISTS(SELECT 1 FROM student_payment_methods WHERE student_id=p_source) THEN
    blockers := blockers || '"Both records have saved payment methods. Resolve the billing setup before merging."'::jsonb;
  END IF;
  RETURN jsonb_build_object('students',profiles,'counts',counts,'blockers',blockers,'fingerprint',md5(snapshot::text));
END $$;
REVOKE ALL ON FUNCTION public.preview_student_merge(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_student_merge(uuid,uuid) TO authenticated;

CREATE FUNCTION public.student_duplicate_candidates(p_student_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_adminstaff_active() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
  WITH candidates AS (
    SELECT a.id a_id,b.id b_id,concat_ws(' ',a.first_name,a.last_name) a_name,concat_ws(' ',b.first_name,b.last_name) b_name,
      array_remove(ARRAY[
        CASE WHEN nullif(lower(trim(a.first_name)),'')=nullif(lower(trim(b.first_name)),'') AND nullif(lower(trim(a.last_name)),'')=nullif(lower(trim(b.last_name)),'') THEN 'Same full name' END,
        CASE WHEN nullif(lower(trim(a.email)),'')=nullif(lower(trim(b.email)),'') THEN 'Same email' END,
        CASE WHEN nullif(regexp_replace(a.phone,'[^0-9]','','g'),'')=nullif(regexp_replace(b.phone,'[^0-9]','','g'),'') THEN 'Same phone' END
      ],NULL) reasons,
      md5((to_jsonb(a)||to_jsonb(b))::text || a.updated_at::text || b.updated_at::text) fingerprint
    FROM students a JOIN students b ON a.id<b.id
    WHERE p_student_id IS NULL OR p_student_id IN (a.id,b.id)
  ) SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.a_name,c.a_id,c.b_id),'[]'::jsonb) INTO result
    FROM candidates c WHERE cardinality(reasons)>0 AND NOT EXISTS(
      SELECT 1 FROM student_duplicate_dismissals d WHERE d.student_a=c.a_id AND d.student_b=c.b_id AND d.fingerprint=c.fingerprint
    );
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.student_duplicate_candidates(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_duplicate_candidates(uuid) TO authenticated;

CREATE FUNCTION public.dismiss_student_duplicate(p_a uuid,p_b uuid,p_fingerprint text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_adminstaff_active() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
  INSERT INTO student_duplicate_dismissals(student_a,student_b,fingerprint) VALUES(least(p_a,p_b),greatest(p_a,p_b),p_fingerprint)
  ON CONFLICT(student_a,student_b) DO UPDATE SET fingerprint=excluded.fingerprint,actor_user_id=(select auth.uid()),created_at=now();
END $$;
REVOKE ALL ON FUNCTION public.dismiss_student_duplicate(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dismiss_student_duplicate(uuid,uuid,text) TO authenticated;

CREATE FUNCTION public.merge_students(p_retained uuid,p_source uuid,p_fingerprint text,p_choices jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; snapshot jsonb; preview jsonb; keep students; source students; profile jsonb;
  login_id uuid; billing_student uuid; field text; field_source text; retired uuid; sql_fields text := '';
  allowed_fields text[] := ARRAY['first_name','last_name','email','phone','school','curriculum','year_level','birthday','timezone','status','account_class','availability_monday','availability_tuesday','availability_wednesday','availability_thursday','availability_friday','availability_saturday_am','availability_saturday_pm','availability_sunday_am','availability_sunday_pm','registered_at','active_at','discontinued_at','discontinued_by','onboarding_progress','ucat_online_tier_override','ucat_onboarding_completed_at','ucat_unlimited_trial_consumed_at','ucat_signup_step','ucat_signup_completed_at','ucat_initial_familiarity'];
BEGIN
  IF NOT public.is_adminstaff_active() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
  IF p_choices->>'confirmed_same_person' IS DISTINCT FROM 'true' OR p_choices->>'reviewed_parent_access' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Confirm that these records represent the same person and review parent access';
  END IF;
  -- Serialize merges; lock dependencies before taking the final snapshot. Ordinary
  -- writes resume when this short transaction commits or rolls back.
  PERFORM pg_advisory_xact_lock(74195631);
  IF EXISTS(SELECT 1 FROM student_merge_history h WHERE h.source_student_id=p_source
    AND h.retained_student_id=p_retained AND h.actor_user_id=(select auth.uid())
    AND md5(h.snapshot::text)=p_fingerprint AND h.choices=p_choices) THEN RETURN p_retained; END IF;
  LOCK TABLE students IN SHARE ROW EXCLUSIVE MODE;
  FOR r IN SELECT DISTINCT c.conrelid::regclass::text AS relation FROM pg_constraint c
    WHERE c.contype='f' AND c.confrelid='public.students'::regclass ORDER BY relation LOOP
    EXECUTE format('LOCK TABLE %s IN SHARE ROW EXCLUSIVE MODE',r.relation);
  END LOOP;
  LOCK TABLE notes IN SHARE ROW EXCLUSIVE MODE;
  preview := preview_student_merge(p_retained,p_source);
  IF preview->>'fingerprint' IS DISTINCT FROM p_fingerprint THEN RAISE EXCEPTION 'These records changed. Refresh the preview before merging.'; END IF;
  IF jsonb_array_length(preview->'blockers')>0 THEN RAISE EXCEPTION '%',preview->'blockers'; END IF;
  snapshot := student_merge_snapshot(ARRAY[p_retained,p_source]);
  SELECT * INTO STRICT keep FROM students WHERE id=p_retained;
  SELECT * INTO STRICT source FROM students WHERE id=p_source;
  login_id := nullif(p_choices->>'login_user_id','')::uuid;
  IF (keep.user_id IS NOT NULL OR source.user_id IS NOT NULL) AND
    (login_id IS NULL OR (login_id IS DISTINCT FROM keep.user_id AND login_id IS DISTINCT FROM source.user_id)) THEN
    RAISE EXCEPTION 'Choose one of these students existing logins';
  END IF;
  IF login_id IS NOT NULL AND login_id IS DISTINCT FROM keep.user_id AND login_id IS DISTINCT FROM source.user_id THEN RAISE EXCEPTION 'Invalid login'; END IF;
  billing_student := nullif(p_choices->>'billing_student_id','')::uuid;
  IF EXISTS(SELECT 1 FROM students_billing WHERE student_id IN(p_retained,p_source)) AND
    (billing_student IS NULL OR billing_student NOT IN(p_retained,p_source) OR NOT EXISTS(SELECT 1 FROM students_billing WHERE student_id=billing_student)) THEN
    RAISE EXCEPTION 'Choose an existing billing setup';
  END IF;
  IF EXISTS(SELECT 1 FROM student_payment_methods WHERE student_id IN(p_retained,p_source) AND student_id IS DISTINCT FROM billing_student) THEN
    RAISE EXCEPTION 'Choose the billing setup that owns the saved payment method';
  END IF;
  profile := to_jsonb(keep);
  FOREACH field IN ARRAY allowed_fields LOOP
    field_source := COALESCE(p_choices->'fields'->>field, CASE WHEN field IN ('registered_at','active_at','discontinued_at','discontinued_by') THEN p_choices->'fields'->>'status' END);
    IF field_source IS NOT NULL AND field_source NOT IN('retained','source') THEN RAISE EXCEPTION 'Invalid field selection'; END IF;
    IF (to_jsonb(keep)->field) IS DISTINCT FROM (to_jsonb(source)->field)
      AND to_jsonb(keep)->field <> 'null'::jsonb AND to_jsonb(source)->field <> 'null'::jsonb
      AND field_source IS NULL THEN RAISE EXCEPTION 'Choose a value for %',field; END IF;
    IF field_source='source' OR (field_source IS NULL AND profile->field='null'::jsonb) THEN
      profile := jsonb_set(profile,ARRAY[field],to_jsonb(source)->field);
    END IF;
    sql_fields := sql_fields || CASE WHEN sql_fields='' THEN '' ELSE ',' END || format('%I=x.%I',field,field);
  END LOOP;
  -- Keep original snapshots even where equivalent relationship rows are coalesced.
  INSERT INTO student_merge_history(source_student_id,retained_student_id,actor_user_id,snapshot,choices)
    VALUES(p_source,p_retained,(select auth.uid()),snapshot,p_choices);
  UPDATE student_merge_history SET retained_student_id=p_retained WHERE retained_student_id=p_source;
  UPDATE student_merge_retired_logins SET retained_student_id=p_retained WHERE retained_student_id=p_source;
  UPDATE student_billing_customer_history SET student_id=p_retained WHERE student_id=p_source;
  INSERT INTO student_billing_customer_history(stripe_customer_id,student_id,billing_snapshot)
    SELECT stripe_customer_id,p_retained,to_jsonb(b) FROM students_billing b WHERE student_id IN(p_retained,p_source)
    ON CONFLICT(stripe_customer_id) DO UPDATE SET student_id=excluded.student_id;
  FOREACH retired IN ARRAY ARRAY[keep.user_id,source.user_id] LOOP
    IF retired IS NOT NULL AND retired IS DISTINCT FROM login_id THEN
      INSERT INTO student_merge_retired_logins(user_id,retained_student_id) VALUES(retired,p_retained)
        ON CONFLICT(user_id) DO UPDATE SET retained_student_id=excluded.retained_student_id;
    END IF;
  END LOOP;
  -- Suppress lifecycle automation caused only by consolidation. Explicit merge
  -- history is the audit record; registration/enrolment did not occur again.
  PERFORM set_config('app.student_merge_in_progress','true',true);
  UPDATE students SET user_id=NULL WHERE id IN(p_retained,p_source);
  INSERT INTO student_contact_history(contact_id,student_id)
    SELECT id,p_retained FROM contacts WHERE student_id IN(p_retained,p_source)
    ON CONFLICT(contact_id) DO UPDATE SET student_id=excluded.student_id;
  -- Only the selected phone remains an active contact. Older conversations keep
  -- an explicit historical relationship and do not receive new automations.
  UPDATE contacts SET student_id=NULL,contact_type='LEAD'
    WHERE student_id IN(p_retained,p_source) AND phone_e164 IS DISTINCT FROM profile->>'phone';
  DELETE FROM students_billing WHERE student_id IN(p_retained,p_source) AND student_id IS DISTINCT FROM billing_student;
  DELETE FROM parents_students a USING parents_students b WHERE a.student_id=p_source AND b.student_id=p_retained AND a.parent_id=b.parent_id;
  DELETE FROM students_subjects a USING students_subjects b WHERE a.student_id=p_source AND b.student_id=p_retained AND a.subject_id=b.subject_id;
  DELETE FROM students_online_access_manual a USING students_online_access_manual b WHERE a.student_id=p_source AND b.student_id=p_retained AND a.subject_id=b.subject_id;
  -- Preserve opt-outs. Never turn a disagreement into fresh consent.
  UPDATE ucat_communication_preferences a SET
    weekly_progress_and_guidance=a.weekly_progress_and_guidance AND b.weekly_progress_and_guidance,
    lessons_and_tips=a.lessons_and_tips AND b.lessons_and_tips,
    product_news=a.product_news AND b.product_news,
    offers_and_referrals=a.offers_and_referrals AND b.offers_and_referrals
    FROM ucat_communication_preferences b WHERE a.student_id=p_retained AND b.student_id=p_source;
  DELETE FROM ucat_communication_preferences a USING ucat_communication_preferences b WHERE a.student_id=p_source AND b.student_id=p_retained;
  DELETE FROM ucat_email_program_assignments a USING ucat_email_program_assignments b WHERE a.student_id=p_source AND b.student_id=p_retained;
  -- Bearer credentials must not inherit expanded access. Students can generate
  -- a fresh calendar link; historical revocations remain preserved.
  DELETE FROM student_calendar_subscriptions WHERE student_id IN(p_retained,p_source);
  FOR r IN SELECT DISTINCT n.nspname,cl.relname,a.attname FROM pg_constraint c
    JOIN pg_class cl ON cl.oid=c.conrelid JOIN pg_namespace n ON n.oid=cl.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
    WHERE c.contype='f' AND c.confrelid='public.students'::regclass AND cardinality(c.conkey)=1
    ORDER BY n.nspname,cl.relname,a.attname LOOP
    BEGIN
      EXECUTE format('UPDATE %I.%I SET %I=$1 WHERE %I=$2',r.nspname,r.relname,r.attname,r.attname) USING p_retained,p_source;
    EXCEPTION WHEN unique_violation OR exclusion_violation THEN
      RAISE EXCEPTION 'Conflicting records in %. No changes were saved; resolve this overlap before merging.',r.relname;
    END;
  END LOOP;
  UPDATE notes SET target_id=p_retained WHERE target_type IN('student','students') AND target_id=p_source;
  -- Append a link to the combined feed without rewriting immutable events.
  INSERT INTO domain_event_entities(domain_event_id,entity_type,entity_id,role,display_name)
    SELECT domain_event_id,'student',p_retained,role,concat_ws(' ',keep.first_name,keep.last_name)
    FROM domain_event_entities WHERE entity_type='student' AND entity_id=p_source ON CONFLICT DO NOTHING;
  UPDATE automation_executions SET entity_id=p_retained WHERE entity_type IN('student','students') AND entity_id=p_source;
  EXECUTE format('UPDATE students s SET %s,user_id=$2,invite_token=gen_random_uuid(),registration_public_token=NULL,legacy_registration_token=NULL FROM jsonb_populate_record(NULL::students,$1) x WHERE s.id=$3',sql_fields)
    USING profile,login_id,p_retained;
  DELETE FROM students WHERE id=p_source;
  PERFORM set_config('app.student_merge_in_progress','false',true);
  RETURN p_retained;
END $$;
REVOKE ALL ON FUNCTION public.merge_students(uuid,uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_students(uuid,uuid,text,jsonb) TO authenticated;

-- The existing trigger owns lifecycle semantics; only add consolidation suppression.
DO $$ DECLARE definition text; function_name text; BEGIN
  FOREACH function_name IN ARRAY ARRAY['capture_core_domain_event','set_students_registered_at','set_students_active_at','set_students_discontinued_at'] LOOP
    SELECT pg_get_functiondef(('public.'||function_name||'()')::regprocedure) INTO definition;
    definition := replace(definition,E'\nBEGIN\n',E'\nBEGIN\n  IF current_setting(''app.student_merge_in_progress'',true) = ''true'' THEN RETURN COALESCE(NEW,OLD); END IF;\n');
    EXECUTE definition;
  END LOOP;
END $$;

-- Background jobs and signed payment events may still carry the original ID.
-- Canonicalize new FK writes; ordinary RLS still checks the resulting row.
CREATE FUNCTION public.canonicalize_merged_student_reference() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE original uuid; retained uuid;
BEGIN
  original := nullif(to_jsonb(NEW)->>TG_ARGV[0],'')::uuid;
  retained := resolve_merged_student_id(original);
  IF retained IS DISTINCT FROM original THEN
    NEW := jsonb_populate_record(NEW,jsonb_build_object(TG_ARGV[0],retained));
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT DISTINCT n.nspname,cl.relname,a.attname FROM pg_constraint c
    JOIN pg_class cl ON cl.oid=c.conrelid JOIN pg_namespace n ON n.oid=cl.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
    WHERE c.contype='f' AND c.confrelid='public.students'::regclass AND cardinality(c.conkey)=1 LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF %I ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.canonicalize_merged_student_reference(%L)',
      'canonical_merge_'||r.attname,r.attname,r.nspname,r.relname,r.attname);
  END LOOP;
END $$;
CREATE VIEW public.vinternal_student_billing_customers WITH (security_invoker=true) AS
  SELECT stripe_customer_id,student_id,true AS is_primary FROM students_billing
  UNION ALL
  SELECT h.stripe_customer_id,h.student_id,false FROM student_billing_customer_history h
  WHERE NOT EXISTS(SELECT 1 FROM students_billing b WHERE b.stripe_customer_id=h.stripe_customer_id);
REVOKE ALL ON public.vinternal_student_billing_customers FROM anon,authenticated;
GRANT SELECT ON public.vinternal_student_billing_customers TO service_role;

-- Explicit privilege contracts for deployment auditing.
REVOKE ALL ON FUNCTION public.guard_retired_student_login() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.canonicalize_merged_student_reference() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.student_merge_history FROM anon,authenticated;
GRANT SELECT ON public.student_merge_history TO authenticated;
GRANT ALL ON public.student_merge_history TO service_role;
REVOKE ALL ON public.student_merge_retired_logins FROM anon,authenticated;
GRANT SELECT ON public.student_merge_retired_logins TO authenticated;
GRANT ALL ON public.student_merge_retired_logins TO service_role;
REVOKE ALL ON public.student_billing_customer_history FROM anon,authenticated;
GRANT SELECT ON public.student_billing_customer_history TO authenticated;
GRANT ALL ON public.student_billing_customer_history TO service_role;
REVOKE ALL ON public.student_duplicate_dismissals FROM anon,authenticated;
GRANT SELECT ON public.student_duplicate_dismissals TO authenticated;
GRANT ALL ON public.student_duplicate_dismissals TO service_role;

CREATE FUNCTION public.record_student_billing_customer(p_student_id uuid,p_customer_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE canonical uuid := resolve_merged_student_id(p_student_id); current_customer text;
BEGIN
  IF p_customer_id IS NULL OR btrim(p_customer_id)='' THEN RAISE EXCEPTION 'Customer required'; END IF;
  PERFORM 1 FROM students WHERE id=canonical FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Student not found'; END IF;
  IF EXISTS(SELECT 1 FROM students_billing WHERE stripe_customer_id=p_customer_id AND student_id<>canonical)
    OR EXISTS(SELECT 1 FROM student_billing_customer_history WHERE stripe_customer_id=p_customer_id AND student_id<>canonical) THEN
    RAISE EXCEPTION 'Customer belongs to another student';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM student_merge_history WHERE retained_student_id=canonical) THEN
    INSERT INTO students_billing(student_id,stripe_customer_id) VALUES(canonical,p_customer_id)
      ON CONFLICT(student_id) DO UPDATE SET stripe_customer_id=excluded.stripe_customer_id;
    RETURN;
  END IF;
  SELECT stripe_customer_id INTO current_customer FROM students_billing WHERE student_id=canonical;
  IF current_customer IS NULL THEN
    INSERT INTO students_billing(student_id,stripe_customer_id) VALUES(canonical,p_customer_id);
  ELSIF current_customer<>p_customer_id THEN
    INSERT INTO student_billing_customer_history(stripe_customer_id,student_id,billing_snapshot)
      VALUES(p_customer_id,canonical,jsonb_build_object('source','checkout_webhook')) ON CONFLICT DO NOTHING;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.record_student_billing_customer(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_student_billing_customer(uuid,text) TO service_role;

CREATE FUNCTION public.student_message_contacts(p_student_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb; canonical uuid := resolve_merged_student_id(p_student_id);
BEGIN
  IF NOT public.is_adminstaff_active() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'phone_e164',c.phone_e164,'is_current',c.student_id=canonical)
    ORDER BY (c.student_id=canonical) DESC NULLS LAST,c.created_at,c.id),'[]'::jsonb) INTO result
    FROM contacts c WHERE c.student_id=canonical OR EXISTS(
      SELECT 1 FROM student_contact_history h WHERE h.student_id=canonical AND h.contact_id=c.id
    );
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.student_message_contacts(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.student_message_contacts(uuid) TO authenticated;
