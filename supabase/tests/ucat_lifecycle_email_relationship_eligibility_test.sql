BEGIN;

SELECT plan(4);

SELECT has_column(
  'public',
  'vinternal_ucat_lifecycle_email_candidates',
  'has_open_ucat_relationship',
  'lifecycle candidates expose canonical UCAT product membership'
);

SELECT col_type_is(
  'public',
  'vinternal_ucat_lifecycle_email_candidates',
  'has_open_ucat_relationship',
  'boolean',
  'canonical UCAT product membership is a boolean eligibility fact'
);

SELECT matches(
  pg_get_viewdef(
    'public.vinternal_ucat_lifecycle_email_candidates'::regclass,
    true
  ),
  'student_online_product_relationships',
  'lifecycle eligibility uses the explicit online product relationship'
);

SELECT matches(
  pg_get_viewdef(
    'public.vinternal_ucat_lifecycle_email_candidates'::regclass,
    true
  ),
  'closed_at IS NULL',
  'closed UCAT product relationships are not lifecycle eligible'
);

SELECT * FROM finish();
ROLLBACK;
