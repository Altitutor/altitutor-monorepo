-- Refine Quantitative Reasoning stem categories to mutually exclusive
-- presentation formats and preserve existing live stem category assignments.
--
-- The earlier QR seed migration may already be applied in hosted Supabase, so
-- this forward migration must rename/upsert the refined categories and remap
-- stems off superseded category IDs before deleting those old rows.

DO $$
DECLARE
  v_qr_section_id UUID;

  v_data_tables UUID := 'aab95252-6be3-5ca9-9616-aeb5e2a6113f';
  v_graphs_and_charts UUID := 'afe45c18-2a27-57ad-9a35-a32cb4a286c4';
  v_timetables_and_calendars UUID := 'c83053ac-82d4-50f3-bdaf-a1639075ec55';
  v_maps_and_diagrams UUID := 'ba4f0242-b6c7-5134-beb6-fd261095ac4a';
  v_mixed_data_sources UUID := '46ca5198-7758-4bb4-bcb9-a4fb46ef6ff1';
  v_text_only_scenarios UUID := '07afa879-be08-4c45-9f3c-ec67216c7dca';
BEGIN
  SELECT id INTO v_qr_section_id
  FROM public.ucat_sections
  WHERE name = 'Quantitative Reasoning'
  LIMIT 1;

  IF v_qr_section_id IS NULL THEN
    RAISE EXCEPTION 'Quantitative Reasoning section not found';
  END IF;

  INSERT INTO public.question_stem_categories (
    id,
    name,
    description,
    ucat_section_id,
    parent_question_stem_category_id,
    created_by,
    updated_by
  )
  VALUES
    (v_data_tables, 'Data Tables', NULL, v_qr_section_id, NULL, NULL, NULL),
    (v_graphs_and_charts, 'Graphs and Charts', NULL, v_qr_section_id, NULL, NULL, NULL),
    (v_timetables_and_calendars, 'Timetables and Calendars', NULL, v_qr_section_id, NULL, NULL, NULL),
    (v_maps_and_diagrams, 'Maps and Diagrams', NULL, v_qr_section_id, NULL, NULL, NULL),
    (v_mixed_data_sources, 'Mixed Data Sources', NULL, v_qr_section_id, NULL, NULL, NULL),
    (v_text_only_scenarios, 'Text-Only Scenarios', NULL, v_qr_section_id, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    ucat_section_id = EXCLUDED.ucat_section_id,
    parent_question_stem_category_id = NULL,
    updated_at = NOW();

  -- Old table subtypes collapse into Data Tables.
  UPDATE public.question_stems
  SET question_stem_category_id = v_data_tables
  WHERE section_id = v_qr_section_id
    AND question_stem_category_id IN (
      'a11fb874-675f-5fc3-b23e-51c9a385f33e', -- Frequency Tables
      'dbaba388-56e9-5ae8-baed-b1770ee1de40', -- Currency Exchange Tables
      'd34881b4-cfef-5ccc-98e8-67747ddaa0b3', -- Financial Statements
      '34110545-29ce-5952-9ef5-cd786862eb75', -- Invoices
      'bf87497f-0b75-5cc8-af92-e2bcab739bff', -- Price Lists
      '89cb9609-9be9-5ce6-a4a1-17a6970538a4'  -- Population Data Tables
    );

  -- Old specific graph/chart types collapse into Graphs and Charts.
  UPDATE public.question_stems
  SET question_stem_category_id = v_graphs_and_charts
  WHERE section_id = v_qr_section_id
    AND question_stem_category_id IN (
      '263e2492-af9d-5adc-a27c-b87eb1eb4f19', -- Line Graphs
      '45266b56-9e78-5239-a6d8-2cef5767cd1e', -- Pie Charts
      '598c3e68-5760-5119-84f4-eac48cd556bf', -- Scatter Plots
      '1a5c7a06-550d-5cb3-9c81-413dc1513e23'  -- Histograms
    );

  UPDATE public.question_stems
  SET question_stem_category_id = v_timetables_and_calendars
  WHERE section_id = v_qr_section_id
    AND question_stem_category_id = '1c06d50d-295f-52d0-8347-738af21b8dd3'; -- Calendars

  UPDATE public.question_stems
  SET question_stem_category_id = v_maps_and_diagrams
  WHERE section_id = v_qr_section_id
    AND question_stem_category_id IN (
      '9873278c-4c4d-57eb-b895-35bf8ddd49ad', -- Diagrams
      'c4ed7537-ad09-5e52-a777-9fd03524a9fc'  -- Infographics
    );

  DELETE FROM public.question_stem_categories
  WHERE ucat_section_id = v_qr_section_id
    AND id IN (
      '263e2492-af9d-5adc-a27c-b87eb1eb4f19', -- Line Graphs
      '45266b56-9e78-5239-a6d8-2cef5767cd1e', -- Pie Charts
      '598c3e68-5760-5119-84f4-eac48cd556bf', -- Scatter Plots
      '1a5c7a06-550d-5cb3-9c81-413dc1513e23', -- Histograms
      'a11fb874-675f-5fc3-b23e-51c9a385f33e', -- Frequency Tables
      '1c06d50d-295f-52d0-8347-738af21b8dd3', -- Calendars
      'dbaba388-56e9-5ae8-baed-b1770ee1de40', -- Currency Exchange Tables
      'd34881b4-cfef-5ccc-98e8-67747ddaa0b3', -- Financial Statements
      '34110545-29ce-5952-9ef5-cd786862eb75', -- Invoices
      'bf87497f-0b75-5cc8-af92-e2bcab739bff', -- Price Lists
      '89cb9609-9be9-5ce6-a4a1-17a6970538a4', -- Population Data Tables
      '9873278c-4c4d-57eb-b895-35bf8ddd49ad', -- Diagrams
      'c4ed7537-ad09-5e52-a777-9fd03524a9fc'  -- Infographics
    );
END $$;
