-- The tutor AI assessment worker reads and updates only its durable review
-- status in this internal projection. Make those privileges explicit so they
-- do not depend on environment-specific default privileges.
REVOKE ALL ON TABLE public.ucat_question_catalog_projection FROM service_role;

GRANT SELECT (stem_id, ai_review_status)
  ON TABLE public.ucat_question_catalog_projection
  TO service_role;

GRANT UPDATE (ai_review_status)
  ON TABLE public.ucat_question_catalog_projection
  TO service_role;
