-- DEV-451: deleting a Topic retains and hides its complete live subtree atomically.
CREATE OR REPLACE FUNCTION admin_retention.retire(p_kind text,p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := admin_retention.assert_actor(); tab text:=admin_retention.table_for(p_kind); item jsonb; prior text:=current_setting('app.business_retention',true); child_id uuid;
BEGIN
  IF tab IS NULL THEN RAISE EXCEPTION 'Unsupported business record' USING ERRCODE='22023'; END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 FOR UPDATE',tab) INTO item USING p_id;
  IF item IS NULL THEN RAISE EXCEPTION 'Business record not found' USING ERRCODE='P0002'; END IF;
  IF item->>'deleted_at' IS NOT NULL THEN RETURN; END IF;
  -- The parent row is already locked against new references. Retire descendants
  -- through the same actor/history boundary before resolving the parent guard.
  -- Each recursive call locks its own parent before walking its live children.
  IF p_kind='topic' THEN
    FOR child_id IN
      SELECT id FROM public.topics
      WHERE parent_id=p_id AND deleted_at IS NULL
      ORDER BY id FOR UPDATE
    LOOP
      PERFORM admin_retention.retire('topic',child_id);
    END LOOP;
  END IF;
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
