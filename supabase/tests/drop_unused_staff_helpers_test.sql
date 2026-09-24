BEGIN;
SELECT plan(10);

SELECT hasnt_function(
  'public',
  'is_staff',
  'the unused any-staff helper is removed'
);

SELECT hasnt_function(
  'public',
  'is_adminstaff',
  'inactive ADMINSTAFF helper is removed in favour of is_adminstaff_active'
);

SELECT has_function(
  'public',
  'is_adminstaff_active',
  'active ADMINSTAFF remains the base-table access check'
);

SELECT has_function(
  'public',
  'is_tutor',
  'active tutor-or-adminstaff remains the tutor facade check'
);

SELECT hasnt_function(
  'auth',
  'is_staff',
  'pre-cutover auth.is_staff leftover is removed'
);

SELECT hasnt_function(
  'auth',
  'is_adminstaff',
  'pre-cutover auth.is_adminstaff leftover is removed'
);

SELECT hasnt_function(
  'public',
  'handle_new_user',
  'JWT claim signup trigger helper is removed'
);

SELECT hasnt_function(
  'public',
  'set_claim',
  ARRAY['uuid', 'text', 'jsonb'],
  'JWT claim writer is removed'
);

SELECT hasnt_column(
  'public',
  'flashcards',
  'title',
  'flashcard titles were dropped with collections'
);

SELECT has_view(
  'public',
  'vstaff_flashcards',
  'the staff flashcard facade is restored after dropping title'
);

SELECT * FROM finish();
ROLLBACK;
