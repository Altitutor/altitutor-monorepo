-- Tutor toolbar views reuse quick_filters. Tutors never receive base-table
-- access: they read this view and write through tutor-web API routes.
-- Keep the entity pattern in sync with packages/shared/src/utils/tutor-saved-views.ts.

CREATE OR REPLACE VIEW public.vtutor_quick_filters
WITH (security_invoker = false)
AS
SELECT
  quick_filters.id,
  quick_filters.user_id,
  quick_filters.target_entity,
  quick_filters.name,
  quick_filters.config,
  quick_filters.created_at,
  quick_filters.updated_at
FROM public.quick_filters AS quick_filters
WHERE public.is_tutor()
  AND quick_filters.target_entity ~ '^tutor:[a-z0-9_]+$'
  AND (
    quick_filters.user_id IS NULL
    OR quick_filters.user_id = (SELECT auth.uid())
  );

COMMENT ON VIEW public.vtutor_quick_filters IS
  'Tutor-readable saved toolbar views. user_id null is shared with tutors; a personal row is visible only to that auth user. The tutor: prefix keeps these rows off admin entities.';

REVOKE ALL ON TABLE public.vtutor_quick_filters FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.vtutor_quick_filters TO authenticated;
