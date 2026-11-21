BEGIN;
SELECT no_plan();

INSERT INTO public.contacts(id,contact_type,phone_e164) VALUES
 ('e4919900-0000-4000-8000-000000000001','OTHER','+61400549101'),
 ('e4919900-0000-4000-8000-000000000002','OTHER','+61400549102'),
 ('e4919900-0000-4000-8000-000000000003','OTHER','+61400549103');
INSERT INTO public.owned_numbers(id,phone_e164,label) VALUES
 ('e4919901-0000-4000-8000-000000000001','+61400549100','dev491msg fixture');
INSERT INTO public.conversations(id,contact_id,owned_number_id,status) VALUES
 ('e4919902-0000-4000-8000-000000000001','e4919900-0000-4000-8000-000000000001','e4919901-0000-4000-8000-000000000001','OPEN'),
 ('e4919902-0000-4000-8000-000000000002','e4919900-0000-4000-8000-000000000001','e4919901-0000-4000-8000-000000000001','ARCHIVED'),
 ('e4919902-0000-4000-8000-000000000003','e4919900-0000-4000-8000-000000000002','e4919901-0000-4000-8000-000000000001','OPEN');
INSERT INTO public.messages(id,conversation_id,direction,body,from_number_e164,to_number_e164,status,created_at,is_reaction) VALUES
 ('e4919903-0000-4000-8000-000000000001','e4919902-0000-4000-8000-000000000001','INBOUND','dev491msg older','+61400549111','+61400549100','RECEIVED','2026-11-01T10:00:00Z',false),
 ('e4919903-0000-4000-8000-000000000002','e4919902-0000-4000-8000-000000000001','INBOUND','dev491msg current tie','+61400549112','+61400549100','RECEIVED','2026-11-02T10:00:00Z',false),
 ('e4919903-0000-4000-8000-000000000003','e4919902-0000-4000-8000-000000000002','INBOUND','dev491msg archive tie','reply@dev491msg.test','+61400549100','RECEIVED','2026-11-02T10:00:00Z',false),
 ('e4919903-0000-4000-8000-000000000004','e4919902-0000-4000-8000-000000000001','INBOUND','dev491msg tapback','+61400549114','+61400549100','RECEIVED','2026-11-03T10:00:00Z',true),
 ('e4919903-0000-4000-8000-000000000005','e4919902-0000-4000-8000-000000000001','OUTBOUND','dev491msg outgoing','+61400549100','+61400549101','SENT','2026-11-04T10:00:00Z',false),
 ('e4919903-0000-4000-8000-000000000006','e4919902-0000-4000-8000-000000000003','INBOUND','dev491msg other contact','+61400549116','+61400549100','RECEIVED','2026-11-05T10:00:00Z',false);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is(public.get_contact_latest_inbound_address('e4919900-0000-4000-8000-000000000001'),
 'reply@dev491msg.test','Admin reply address is the latest substantive inbound across all contact conversations, with deterministic ID ties');
SELECT is(public.get_contact_latest_inbound_address('e4919900-0000-4000-8000-000000000003'),
 NULL::text,'A contact without inbound messages has no reply address');
SELECT is(public.get_contact_latest_inbound_address('e4919900-0000-4000-8000-000000000099'),
 NULL::text,'An unknown contact has no reply address');
RESET ROLE;

-- A newer blank handle remains authoritative; never route to an older sender.
INSERT INTO public.messages(id,conversation_id,direction,body,from_number_e164,to_number_e164,status,created_at) VALUES
 ('e4919903-0000-4000-8000-000000000007','e4919902-0000-4000-8000-000000000001','INBOUND','dev491msg blank handle','','+61400549100','RECEIVED','2026-11-06T10:00:00Z');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is(public.get_contact_latest_inbound_address('e4919900-0000-4000-8000-000000000001'),
 ''::text,'A blank latest inbound handle does not fall back to another recipient');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SELECT is(public.get_contact_latest_inbound_address('e4919900-0000-4000-8000-000000000001'),
 NULL::text,'Tutor cannot read Admin contact reply addresses through the function');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT is(public.get_contact_latest_inbound_address('e4919900-0000-4000-8000-000000000001'),
 NULL::text,'Student cannot read Admin contact reply addresses through the function');
RESET ROLE;
SELECT ok(NOT has_function_privilege('anon','public.get_contact_latest_inbound_address(uuid)','EXECUTE'),
 'Anonymous callers cannot execute the reply-address function');
SELECT ok(NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.get_contact_latest_inbound_address(uuid)'::regprocedure),
 'Reply-address reads preserve caller privileges and row policies');

SELECT * FROM finish();
ROLLBACK;
