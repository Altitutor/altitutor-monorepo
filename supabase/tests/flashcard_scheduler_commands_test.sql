BEGIN;
SELECT plan(24);

SELECT is(
  position('''40001''' IN pg_get_functiondef('public.commit_flashcard_review_answer(uuid,uuid,uuid,text,bigint,timestamp with time zone,integer,text,uuid,integer,text,jsonb,jsonb)'::regprocedure)),
  0,
  'answer conflicts do not use the retryable serialization failure code'
);
SELECT ok(
  position('''PT409''' IN pg_get_functiondef('public.commit_flashcard_review_answer(uuid,uuid,uuid,text,bigint,timestamp with time zone,integer,text,uuid,integer,text,jsonb,jsonb)'::regprocedure)) > 0,
  'answer conflicts use an explicit application HTTP conflict code'
);
SELECT is(
  position('''40001''' IN pg_get_functiondef('public.undo_latest_flashcard_answer(uuid,uuid,text)'::regprocedure)),
  0,
  'legacy undo conflicts do not use the retryable serialization failure code'
);
SELECT ok(
  position('''PT409''' IN pg_get_functiondef('public.undo_latest_flashcard_answer(uuid,uuid,text)'::regprocedure)) > 0,
  'legacy undo conflicts use an explicit application HTTP conflict code'
);
SELECT is(
  position('''40001''' IN pg_get_functiondef('public.undo_flashcard_answer(uuid,uuid,uuid,text)'::regprocedure)),
  0,
  'bounded undo conflicts do not use the retryable serialization failure code'
);
SELECT ok(
  position('''PT409''' IN pg_get_functiondef('public.undo_flashcard_answer(uuid,uuid,uuid,text)'::regprocedure)) > 0,
  'bounded undo conflicts use an explicit application HTTP conflict code'
);

INSERT INTO public.flashcards(id, topic_id, card_type, cloze_text, index)
VALUES ('fa000000-0000-4000-8000-000000000001','30000000-0000-0000-0000-000000000001','text_cloze','{{c1::One}} {{c2::Two}}',990);

SELECT is((SELECT count(*)::integer FROM public.flashcard_review_cards WHERE flashcard_id='fa000000-0000-4000-8000-000000000001'),2,'cloze siblings exist');

INSERT INTO public.student_flashcard_review_states(student_id,review_card_id,leech_lapses_notified)
VALUES('10000000-0000-0000-0000-000000000001',(SELECT id FROM public.flashcard_review_cards WHERE flashcard_id='fa000000-0000-4000-8000-000000000001' AND cloze_index=1),4);

SELECT public.commit_flashcard_review_answer(
  '10000000-0000-0000-0000-000000000001',
  (SELECT id FROM public.flashcard_review_cards WHERE flashcard_id='fa000000-0000-4000-8000-000000000001' AND cloze_index=1),
  'fa100000-0000-4000-8000-000000000001','same',0,'2026-09-19T00:00:00Z',70000,'good',
  'f5000000-0000-4000-8000-000000000001',1,'test',
  '{"due_at":"2026-09-19T00:10:00Z","stability":1,"difficulty":5,"scheduled_days":0,"learning_steps":1,"reps":1,"lapses":0,"state":"Learning"}',
  '{"studyDayEndsAt":"2026-09-19T18:30:00Z"}'
);

SELECT is((SELECT revision FROM public.student_flashcard_review_states s JOIN public.flashcard_review_cards rc ON rc.id=s.review_card_id WHERE rc.cloze_index=1 AND rc.flashcard_id='fa000000-0000-4000-8000-000000000001'),1::bigint,'answer advances revision');
SELECT is((SELECT duration_ms FROM public.student_flashcard_review_logs WHERE request_id='fa100000-0000-4000-8000-000000000001'),60000,'duration is capped');
SELECT is((SELECT buried_reason FROM public.student_flashcard_review_states s JOIN public.flashcard_review_cards rc ON rc.id=s.review_card_id WHERE rc.cloze_index=2 AND rc.flashcard_id='fa000000-0000-4000-8000-000000000001'),'sibling','answer buries sibling');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","user_role":"TUTOR"}',true);
SELECT is((SELECT count(*)::integer FROM public.vtutor_flashcard_review_history WHERE student_id='10000000-0000-0000-0000-000000000001'),1,'assigned tutor can read student history for the subject');
RESET ROLE;

SELECT public.commit_flashcard_review_answer(
  '10000000-0000-0000-0000-000000000001',(SELECT id FROM public.flashcard_review_cards WHERE flashcard_id='fa000000-0000-4000-8000-000000000001' AND cloze_index=1),
  'fa100000-0000-4000-8000-000000000001','same',0,'2026-09-19T00:00:00Z',1,'good','f5000000-0000-4000-8000-000000000001',1,'test','{}','{}');
SELECT is((SELECT count(*)::integer FROM public.student_flashcard_review_logs WHERE request_id='fa100000-0000-4000-8000-000000000001'),1,'exact retry is idempotent');

SELECT throws_ok($$SELECT public.commit_flashcard_review_answer(
  '10000000-0000-0000-0000-000000000001',(SELECT id FROM public.flashcard_review_cards WHERE flashcard_id='fa000000-0000-4000-8000-000000000001' AND cloze_index=1),
  'fa100000-0000-4000-8000-000000000002','stale',0,NOW(),1,'good','f5000000-0000-4000-8000-000000000001',1,'test','{}','{}')$$,'PT409','flashcard_stale_revision','stale answer is rejected');

SELECT public.undo_latest_flashcard_answer('10000000-0000-0000-0000-000000000001','fa100000-0000-4000-8000-000000000003','undo');
SELECT is((SELECT state FROM public.student_flashcard_review_states s JOIN public.flashcard_review_cards rc ON rc.id=s.review_card_id WHERE rc.cloze_index=1 AND rc.flashcard_id='fa000000-0000-4000-8000-000000000001'),'New','undo restores prior state');
SELECT is((SELECT buried_reason FROM public.student_flashcard_review_states s JOIN public.flashcard_review_cards rc ON rc.id=s.review_card_id WHERE rc.cloze_index=2 AND rc.flashcard_id='fa000000-0000-4000-8000-000000000001'),NULL,'undo restores sibling burial');
SELECT is((SELECT leech_lapses_notified FROM public.student_flashcard_review_states s JOIN public.flashcard_review_cards rc ON rc.id=s.review_card_id WHERE rc.cloze_index=1 AND rc.flashcard_id='fa000000-0000-4000-8000-000000000001'),4,'undo restores the prior leech notification threshold');

SELECT public.commit_flashcard_review_answer(
  '10000000-0000-0000-0000-000000000001',
  (SELECT id FROM public.flashcard_review_cards WHERE flashcard_id='fa000000-0000-4000-8000-000000000001' AND cloze_index=1),
  'fa100000-0000-4000-8000-000000000008','bounded-undo-answer',2,'2026-09-19T00:20:00Z',1000,'good',
  'f5000000-0000-4000-8000-000000000001',1,'test',
  '{"due_at":"2026-09-19T00:30:00Z","stability":1,"difficulty":5,"scheduled_days":0,"learning_steps":1,"reps":1,"lapses":0,"state":"Learning"}',
  '{"studyDayEndsAt":"2026-09-19T18:30:00Z"}'
);
SELECT public.undo_flashcard_answer(
  '10000000-0000-0000-0000-000000000001',
  (SELECT id FROM public.student_flashcard_review_logs WHERE student_id='10000000-0000-0000-0000-000000000001' AND request_id='fa100000-0000-4000-8000-000000000008'),
  'fa100000-0000-4000-8000-000000000009','undo:bounded'
);
SELECT is((SELECT state FROM public.student_flashcard_review_states s JOIN public.flashcard_review_cards rc ON rc.id=s.review_card_id WHERE rc.cloze_index=1 AND rc.flashcard_id='fa000000-0000-4000-8000-000000000001'),'New','bounded undo restores the exact answer state');
SELECT throws_ok($$SELECT public.undo_flashcard_answer(
  '10000000-0000-0000-0000-000000000001',
  (SELECT id FROM public.student_flashcard_review_logs WHERE student_id='10000000-0000-0000-0000-000000000001' AND request_id='fa100000-0000-4000-8000-000000000008'),
  'fa100000-0000-4000-8000-000000000010','undo:bounded-again')$$,
  '22023','flashcard_answer_not_undoable','the same answer cannot be undone twice');
SELECT is((SELECT count(*)::integer FROM public.student_flashcard_review_logs WHERE undoes_log_id=(SELECT id FROM public.student_flashcard_review_logs WHERE student_id='10000000-0000-0000-0000-000000000001' AND request_id='fa100000-0000-4000-8000-000000000008')),1,'bounded undo writes one immutable undo receipt');

SELECT public.manage_flashcard_review_card('10000000-0000-0000-0000-000000000001',(SELECT id FROM public.flashcard_review_cards WHERE flashcard_id='fa000000-0000-4000-8000-000000000001' AND cloze_index=1),'fa100000-0000-4000-8000-000000000004','suspend','suspend','2026-09-19T01:00:00Z');
SELECT isnt((SELECT suspended_at FROM public.student_flashcard_review_states s JOIN public.flashcard_review_cards rc ON rc.id=s.review_card_id WHERE rc.cloze_index=1 AND rc.flashcard_id='fa000000-0000-4000-8000-000000000001'),NULL,'student can suspend a card');
SELECT public.manage_flashcard_review_card('10000000-0000-0000-0000-000000000001',(SELECT id FROM public.flashcard_review_cards WHERE flashcard_id='fa000000-0000-4000-8000-000000000001' AND cloze_index=1),'fa100000-0000-4000-8000-000000000005','resume','resume','2026-09-19T01:01:00Z');
SELECT is((SELECT suspended_at FROM public.student_flashcard_review_states s JOIN public.flashcard_review_cards rc ON rc.id=s.review_card_id WHERE rc.cloze_index=1 AND rc.flashcard_id='fa000000-0000-4000-8000-000000000001'),NULL,'student can resume a card');
UPDATE public.student_flashcard_review_states SET state='Review',stability=10,difficulty=5,reps=5 WHERE student_id='10000000-0000-0000-0000-000000000001' AND review_card_id=(SELECT id FROM public.flashcard_review_cards WHERE flashcard_id='fa000000-0000-4000-8000-000000000001' AND cloze_index=1);
SELECT public.manage_flashcard_review_card('10000000-0000-0000-0000-000000000001',(SELECT id FROM public.flashcard_review_cards WHERE flashcard_id='fa000000-0000-4000-8000-000000000001' AND cloze_index=1),'fa100000-0000-4000-8000-000000000006','forget','forget','2026-09-19T01:02:00Z');
SELECT is((SELECT state FROM public.student_flashcard_review_states s JOIN public.flashcard_review_cards rc ON rc.id=s.review_card_id WHERE rc.cloze_index=1 AND rc.flashcard_id='fa000000-0000-4000-8000-000000000001'),'New','forget resets the card to New');
SELECT ok((SELECT count(*) FROM public.student_flashcard_review_logs WHERE student_id='10000000-0000-0000-0000-000000000001' AND review_card_id=(SELECT id FROM public.flashcard_review_cards WHERE flashcard_id='fa000000-0000-4000-8000-000000000001' AND cloze_index=1) AND action='answer')=2,'forget retains immutable answer history');

INSERT INTO public.flashcards(id, topic_id, card_type, cloze_text, index)
VALUES ('fa000000-0000-4000-8000-000000000002','30000000-0000-0000-0000-000000000001','text_cloze','{{c1::Service role}}',991);

SET LOCAL ROLE service_role;
SELECT lives_ok($service_role$
  SELECT public.commit_flashcard_review_answer(
    '10000000-0000-0000-0000-000000000001',
    (SELECT id FROM public.flashcard_review_cards WHERE flashcard_id='fa000000-0000-4000-8000-000000000002' AND cloze_index=1),
    'fa100000-0000-4000-8000-000000000007','service-role',0,'2026-09-19T02:00:00Z',1000,'good',
    'f5000000-0000-4000-8000-000000000001',1,'test',
    '{"due_at":"2026-09-19T02:10:00Z","stability":1,"difficulty":5,"scheduled_days":0,"learning_steps":1,"reps":1,"lapses":0,"state":"Learning"}',
    '{"studyDayEndsAt":"2026-09-19T18:30:00Z"}'
  )
$service_role$, 'service role can commit an answer through the state serializer');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
