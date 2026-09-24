-- Migration: restore_storage_path_helper_execute_grants
-- Why: 20260721082329 revoked EXECUTE on all SECURITY DEFINER functions from
-- authenticated, then re-granted an allowlist that missed the storage path
-- parsers. Storage RLS policies still call these helpers (including when
-- evaluating session-files policies against other buckets), so createSignedUrl
-- fails with: permission denied for function get_session_id_from_storage_path.

REVOKE ALL ON FUNCTION public.get_session_id_from_storage_path(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_session_id_from_storage_path(text)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_staff_id_from_storage_path(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_id_from_storage_path(text)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_topic_id_from_flashcard_image_path(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_topic_id_from_flashcard_image_path(text)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_ucat_stem_id_from_image_path(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ucat_stem_id_from_image_path(text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_session_id_from_storage_path(text) IS
  'Extracts session_id from storage path format: {sessionId}/{timestamp}_{filename}. Required by session-files storage RLS.';

COMMENT ON FUNCTION public.get_staff_id_from_storage_path(text) IS
  'Extracts staff_id from storage path format: {staffId}/{timestamp}_{filename}. Required by staff-files storage helpers/RLS.';

COMMENT ON FUNCTION public.get_topic_id_from_flashcard_image_path(text) IS
  'Extracts topic_id from flashcard-images storage path. Required by flashcard-images storage RLS.';

COMMENT ON FUNCTION public.get_ucat_stem_id_from_image_path(text) IS
  'Extracts stem_id from ucat-images storage path. Required by ucat-images storage RLS.';
