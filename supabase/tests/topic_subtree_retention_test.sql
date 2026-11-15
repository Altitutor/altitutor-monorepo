BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT no_plan();
INSERT INTO public.subjects(id,name) VALUES('a4510000-0000-4000-8000-000000000010','Subtree retention');
INSERT INTO public.topics(id,subject_id,parent_id,name,index) VALUES
('a4510000-0000-4000-8000-000000000001','a4510000-0000-4000-8000-000000000010',NULL,'Parent',1),
('a4510000-0000-4000-8000-000000000002','a4510000-0000-4000-8000-000000000010','a4510000-0000-4000-8000-000000000001','Child',1),
('a4510000-0000-4000-8000-000000000003','a4510000-0000-4000-8000-000000000010','a4510000-0000-4000-8000-000000000002','Grandchild',1),
('a4510000-0000-4000-8000-000000000004','a4510000-0000-4000-8000-000000000010',NULL,'Unrelated sibling',2);
INSERT INTO public.topics_files(id,topic_id,type,index,file_id)
SELECT 'a4510000-0000-4000-8000-000000000020','a4510000-0000-4000-8000-000000000003','NOTES',1,id
FROM public.files WHERE id='40000000-0000-0000-0000-000000000001';
-- A descendant failure must roll back earlier retirements and all audit entries.
CREATE FUNCTION pg_temp.reject_subtree_retirement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id='a4510000-0000-4000-8000-000000000002' AND NEW.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'fixture descendant failure';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER zz_fixture_reject_retirement BEFORE UPDATE ON public.topics
FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_subtree_retirement();
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$DELETE FROM public.topics WHERE id='a4510000-0000-4000-8000-000000000001'$$,'P0001','fixture descendant failure','descendant failure aborts the whole deletion');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.topics WHERE subject_id='a4510000-0000-4000-8000-000000000010' AND deleted_at IS NOT NULL),0::bigint,'failed subtree deletion leaves all topics live');
SELECT is((SELECT count(*) FROM admin_retention.history WHERE kind='topic' AND entity_id IN ('a4510000-0000-4000-8000-000000000001','a4510000-0000-4000-8000-000000000002','a4510000-0000-4000-8000-000000000003')),0::bigint,'failed subtree deletion leaves no partial audit history');
DROP TRIGGER zz_fixture_reject_retirement ON public.topics;
SET LOCAL ROLE authenticated;
SELECT lives_ok($$DELETE FROM public.topics WHERE id='a4510000-0000-4000-8000-000000000001'$$,'AdminStaff deletes a parent with children through the ordinary DELETE path');
SELECT is((SELECT count(*) FROM public.topics WHERE subject_id='a4510000-0000-4000-8000-000000000010'),1::bigint,'ordinary reads hide every descendant and keep the unrelated sibling');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.topics WHERE subject_id='a4510000-0000-4000-8000-000000000010'),4::bigint,'all topic identities and relationships are retained');
SELECT is((SELECT count(*) FROM public.topics WHERE subject_id='a4510000-0000-4000-8000-000000000010' AND deleted_at IS NOT NULL),3::bigint,'all three subtree records are retired');
SELECT is((SELECT count(*) FROM public.topics_files WHERE id='a4510000-0000-4000-8000-000000000020'),1::bigint,'descendant resource relationship survives deletion');
SELECT is((SELECT count(*) FROM public.files WHERE id='40000000-0000-0000-0000-000000000001'),1::bigint,'resource file is retained');
SELECT is((SELECT count(*) FROM admin_retention.history WHERE kind='topic' AND entity_id IN ('a4510000-0000-4000-8000-000000000001','a4510000-0000-4000-8000-000000000002','a4510000-0000-4000-8000-000000000003')),3::bigint,'each retired topic has its own history snapshot');
SELECT is((SELECT index FROM public.topics WHERE id='a4510000-0000-4000-8000-000000000004'),1,'remaining live sibling is reindexed');
SELECT ok((SELECT bool_and(deleted_by='00000000-0000-0000-0000-000000000001') FROM public.topics WHERE subject_id='a4510000-0000-4000-8000-000000000010' AND deleted_at IS NOT NULL),'deletion attribution is retained for the whole subtree');
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.retire_business_record('topic','a4510000-0000-4000-8000-000000000001')$$,'repeat retirement is idempotent');
SELECT throws_ok($$SELECT public.restore_business_record('topic','a4510000-0000-4000-8000-000000000003')$$,'P0001','Restore the parent Topic first','descendants still require parent restoration first');
SELECT lives_ok($$SELECT public.restore_business_record('topic','a4510000-0000-4000-8000-000000000001')$$,'the parent can be restored independently');
SELECT is((SELECT count(*) FROM public.topics WHERE subject_id='a4510000-0000-4000-8000-000000000010'),2::bigint,'restoring the parent does not silently revive descendants');
SELECT lives_ok($$SELECT public.restore_business_record('topic','a4510000-0000-4000-8000-000000000002')$$,'child can be restored after its parent');
SELECT lives_ok($$SELECT public.retire_business_record('topic','a4510000-0000-4000-8000-000000000001')$$,'archive RPC also retires a subtree containing an already-deleted descendant');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SELECT throws_ok($$SELECT public.retire_business_record('topic','a4510000-0000-4000-8000-000000000004')$$,'42501','Active AdminStaff access required','Tutor cannot retire a topic subtree');
RESET ROLE;
SELECT ok((SELECT deleted_at IS NULL FROM public.topics WHERE id='a4510000-0000-4000-8000-000000000004'),'unauthorized attempt leaves unrelated topic live');
SELECT is((SELECT count(*) FROM admin_retention.history WHERE kind='topic' AND entity_id='a4510000-0000-4000-8000-000000000003'),1::bigint,'already-deleted descendants are not retired again');
SELECT ok(NOT has_function_privilege('authenticated','admin_retention.retire(text,uuid)','EXECUTE'),'retirement implementation remains private');
SELECT * FROM finish();
ROLLBACK;
