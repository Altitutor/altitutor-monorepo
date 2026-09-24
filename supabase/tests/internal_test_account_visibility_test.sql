BEGIN;

SELECT plan(12);

SELECT has_column(
  'public',
  'students',
  'account_class',
  'Students have a platform-neutral account classification'
);

SELECT hasnt_column(
  'public',
  'students',
  'ucat_analytics_account_class',
  'the UCAT-specific account classification name has been retired'
);

SELECT has_column(
  'public',
  'vstudent_ucat_my_access',
  'account_class',
  'the Student UCAT access facade exposes the neutral name'
);

SELECT has_function(
  'public',
  'is_student_peer_visible',
  ARRAY['uuid', 'text'],
  'peer visibility is expressed through one database policy helper'
);

SELECT matches(
  pg_get_viewdef('public.vstudent_class_detail'::regclass, true),
  'is_student_peer_visible',
  'Student Class rosters apply the peer visibility policy'
);

SELECT matches(
  pg_get_viewdef('public.vstudent_sessions'::regclass, true),
  'is_student_peer_visible',
  'Student Session lists apply the peer visibility policy'
);

SELECT matches(
  pg_get_viewdef('public.vstudent_session_detail'::regclass, true),
  'is_student_peer_visible',
  'Student Session details apply the peer visibility policy'
);

SELECT matches(
  pg_get_viewdef('public.vstudent_session_base'::regclass, true),
  'vstudent_session_detail',
  'the shared Student Session facade inherits filtered Session details'
);

SELECT has_column(
  'public',
  'vtutor_students',
  'account_class',
  'Tutor Student search results carry the account classification'
);

SELECT has_column(
  'public',
  'vtutor_ucat_student_progress_summary',
  'account_class',
  'Tutor UCAT Student summaries carry the account classification'
);

SELECT matches(
  pg_get_viewdef('public.vtutor_class_detail'::regclass, true),
  'account_class',
  'Tutor Class rosters carry the account classification'
);

SELECT matches(
  pg_get_viewdef('public.vtutor_session_detail'::regclass, true),
  'account_class',
  'Tutor Session rosters carry the account classification'
);

SELECT * FROM finish();
ROLLBACK;
