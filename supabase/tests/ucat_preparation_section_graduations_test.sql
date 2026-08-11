BEGIN;

SELECT plan(8);

SELECT has_table(
  'public',
  'ucat_student_preparation_section_states',
  'section graduation state is durable'
);
SELECT has_view(
  'public',
  'vstudent_ucat_preparation_section_states',
  'Students read section graduation through a role facade'
);
SELECT col_is_pk(
  'public',
  'ucat_student_preparation_section_states',
  'id',
  'section graduation has a primary key'
);
SELECT col_is_fk(
  'public',
  'ucat_student_preparation_section_states',
  'student_id',
  'section graduation belongs to a Student'
);
SELECT col_is_fk(
  'public',
  'ucat_student_preparation_section_states',
  'section_id',
  'section graduation belongs to a UCAT section'
);
SELECT has_index(
  'public',
  'ucat_student_preparation_section_states',
  'idx_ucat_preparation_section_states_section',
  'section foreign-key lookups are indexed'
);
SELECT is(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.ucat_student_preparation_section_states'::regclass
  ),
  true,
  'the base table has row-level security enabled'
);
SELECT matches(
  pg_get_viewdef('public.vstudent_ucat_preparation_section_states'::regclass, true),
  'current_student_id',
  'the Student facade scopes rows through current_student_id'
);

SELECT * FROM finish();
ROLLBACK;
