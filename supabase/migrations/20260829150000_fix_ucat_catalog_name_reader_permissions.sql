-- Catalog names are derived from protected base-table metadata, but they are
-- rendered through Student and Tutor views. Run only the deterministic naming
-- lookup with the function owner's privileges so authenticated readers do not
-- receive NULL names when RLS hides the underlying catalog row.

CREATE OR REPLACE FUNCTION public.ucat_mock_catalog_name(p_mock_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT format('Mock %s', mock.catalog_index)
  FROM public.ucat_mocks mock
  WHERE mock.id = p_mock_id;
$$;

CREATE OR REPLACE FUNCTION public.ucat_question_set_catalog_name(
  p_set_id UUID,
  p_compact BOOLEAN DEFAULT false
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN question_set.mock_id IS NOT NULL THEN format(
      'Mock %s %s',
      mock.catalog_index,
      CASE
        WHEN p_compact THEN public.ucat_section_abbreviation(section.name)
        ELSE section.name
      END
    )
    ELSE format(
      '%s %s Set %s',
      CASE
        WHEN p_compact THEN public.ucat_section_abbreviation(section.name)
        ELSE section.name
      END,
      CASE question_set.set_format
        WHEN 'full_section' THEN 'Full'
        ELSE 'Partial'
      END,
      question_set.catalog_index
    )
  END
  FROM public.question_sets question_set
  JOIN public.ucat_sections section ON section.id = question_set.section_id
  LEFT JOIN public.ucat_mocks mock ON mock.id = question_set.mock_id
  WHERE question_set.id = p_set_id;
$$;

REVOKE ALL ON FUNCTION public.ucat_mock_catalog_name(UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ucat_question_set_catalog_name(UUID, BOOLEAN)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ucat_mock_catalog_name(UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ucat_question_set_catalog_name(UUID, BOOLEAN)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.ucat_mock_catalog_name(UUID) IS
  'Returns a deterministic Mock N label without exposing protected mock metadata.';
COMMENT ON FUNCTION public.ucat_question_set_catalog_name(UUID, BOOLEAN) IS
  'Returns a deterministic standalone or mock-component Set label without exposing protected set metadata.';
