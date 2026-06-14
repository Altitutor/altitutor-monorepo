-- Seed Quantitative Reasoning stem categories and question tags from the QR breakdown.
-- Stem categories are refined to mutually exclusive presentation formats.
-- IDs are deterministic so this migration can run safely in dev and prod.

DO $$
DECLARE
  v_qr_section_id UUID;
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
    ('aab95252-6be3-5ca9-9616-aeb5e2a6113f', 'Data Tables', NULL, v_qr_section_id, NULL, NULL, NULL),
    ('afe45c18-2a27-57ad-9a35-a32cb4a286c4', 'Graphs and Charts', NULL, v_qr_section_id, NULL, NULL, NULL),
    ('c83053ac-82d4-50f3-bdaf-a1639075ec55', 'Timetables and Calendars', NULL, v_qr_section_id, NULL, NULL, NULL),
    ('9873278c-4c4d-57eb-b895-35bf8ddd49ad', 'Maps and Diagrams', NULL, v_qr_section_id, NULL, NULL, NULL),
    ('c4ed7537-ad09-5e52-a777-9fd03524a9fc', 'Mixed Data Sources', NULL, v_qr_section_id, NULL, NULL, NULL),
    ('ba4f0242-b6c7-5134-beb6-fd261095ac4a', 'Text-Only Scenarios', NULL, v_qr_section_id, NULL, NULL, NULL)
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    ucat_section_id = EXCLUDED.ucat_section_id,
    parent_question_stem_category_id = NULL,
    updated_at = NOW();

  DELETE FROM public.question_stem_categories
  WHERE ucat_section_id = v_qr_section_id
    AND id NOT IN (
      'aab95252-6be3-5ca9-9616-aeb5e2a6113f',
      'afe45c18-2a27-57ad-9a35-a32cb4a286c4',
      'c83053ac-82d4-50f3-bdaf-a1639075ec55',
      '9873278c-4c4d-57eb-b895-35bf8ddd49ad',
      'c4ed7537-ad09-5e52-a777-9fd03524a9fc',
      'ba4f0242-b6c7-5134-beb6-fd261095ac4a'
    );

  INSERT INTO public.question_tags (
    id,
    name,
    description,
    parent_question_tag_id,
    ucat_section_id,
    created_by,
    updated_by
  )
  VALUES
    ('e70e4471-ba9f-55dd-a784-4ef70fd7f93d', 'Arithmetic', NULL, NULL, v_qr_section_id, NULL, NULL),
    ('01185402-8175-588f-b36f-c1a2ca3062db', 'Addition', NULL, 'e70e4471-ba9f-55dd-a784-4ef70fd7f93d', NULL, NULL, NULL),
    ('bb36ce3d-d6e5-59ca-b531-2b999c798a11', 'Subtraction', NULL, 'e70e4471-ba9f-55dd-a784-4ef70fd7f93d', NULL, NULL, NULL),
    ('2c372bf6-faec-54dc-a9a9-2f864066ad41', 'Multiplication', NULL, 'e70e4471-ba9f-55dd-a784-4ef70fd7f93d', NULL, NULL, NULL),
    ('3b37efaf-6b6a-50aa-962d-7e5029abfcd7', 'Division', NULL, 'e70e4471-ba9f-55dd-a784-4ef70fd7f93d', NULL, NULL, NULL),
    ('a92ca94f-9ec7-5bfc-9cb3-78c1ea1c84fa', 'Mental maths', NULL, 'e70e4471-ba9f-55dd-a784-4ef70fd7f93d', NULL, NULL, NULL),
    ('4b6a0773-f2fd-5797-a7bf-8d48d3f98a36', 'Estimation', NULL, 'e70e4471-ba9f-55dd-a784-4ef70fd7f93d', NULL, NULL, NULL),
    ('dd965815-7058-57ef-8258-5e5a602dc897', 'Rounding', NULL, 'e70e4471-ba9f-55dd-a784-4ef70fd7f93d', NULL, NULL, NULL),
    ('c7455d1b-d65b-5758-88e6-4aa5c57bada5', 'Order of operations (BEDMAS)', NULL, 'e70e4471-ba9f-55dd-a784-4ef70fd7f93d', NULL, NULL, NULL),

    ('09896719-3a62-5549-92a2-beb465585fe0', 'Fractions', NULL, NULL, v_qr_section_id, NULL, NULL),
    ('4ccccb91-3209-573b-a209-c7a3dcf892c4', 'Simplifying fractions', NULL, '09896719-3a62-5549-92a2-beb465585fe0', NULL, NULL, NULL),
    ('93c2eb9a-0be2-54ac-98fd-9476c4d9771f', 'Equivalent fractions', NULL, '09896719-3a62-5549-92a2-beb465585fe0', NULL, NULL, NULL),
    ('6457f3e1-7d4b-5a09-bb24-8919e53be401', 'Adding fractions', NULL, '09896719-3a62-5549-92a2-beb465585fe0', NULL, NULL, NULL),
    ('cf9a721c-35bb-5558-accd-1864668262df', 'Subtracting fractions', NULL, '09896719-3a62-5549-92a2-beb465585fe0', NULL, NULL, NULL),
    ('9df31c1a-feef-5a00-8633-6c77a97c5032', 'Multiplying fractions', NULL, '09896719-3a62-5549-92a2-beb465585fe0', NULL, NULL, NULL),
    ('4c6c9905-83d8-54dc-b4df-2d31b34877d1', 'Dividing fractions', NULL, '09896719-3a62-5549-92a2-beb465585fe0', NULL, NULL, NULL),
    ('f3ae2d47-97cc-5421-8626-4f2371557cf2', 'Converting fractions to decimals', NULL, '09896719-3a62-5549-92a2-beb465585fe0', NULL, NULL, NULL),
    ('4e9a6287-30c6-5934-b0f3-15491f3599b9', 'Converting fractions to percentages', NULL, '09896719-3a62-5549-92a2-beb465585fe0', NULL, NULL, NULL),

    ('ae55e78c-aa95-53d1-86f7-9d3a61dd0472', 'Decimals', NULL, NULL, v_qr_section_id, NULL, NULL),
    ('9ea17261-e198-5eb1-a647-c48c5be0ed59', 'Addition/subtraction', NULL, 'ae55e78c-aa95-53d1-86f7-9d3a61dd0472', NULL, NULL, NULL),
    ('b9e7f3c8-53ba-5f79-b097-2958b4ba1c32', 'Multiplication', NULL, 'ae55e78c-aa95-53d1-86f7-9d3a61dd0472', NULL, NULL, NULL),
    ('5d4bd2ae-93be-5253-a349-1e9f2a615c3e', 'Division', NULL, 'ae55e78c-aa95-53d1-86f7-9d3a61dd0472', NULL, NULL, NULL),
    ('14ad2349-13b1-58ef-b982-1f8978d5ff5e', 'Decimal place conversions', NULL, 'ae55e78c-aa95-53d1-86f7-9d3a61dd0472', NULL, NULL, NULL),
    ('aa7daa20-11cd-5def-840a-98da13113522', 'Rounding', NULL, 'ae55e78c-aa95-53d1-86f7-9d3a61dd0472', NULL, NULL, NULL),

    ('9a3520e7-7991-5a0c-b4f8-435aa8d4c5d4', 'Percentages', NULL, NULL, v_qr_section_id, NULL, NULL),
    ('4cbc5edb-907f-5970-b072-011afc2f8543', 'Finding a percentage of a quantity', NULL, '9a3520e7-7991-5a0c-b4f8-435aa8d4c5d4', NULL, NULL, NULL),
    ('380984cf-3fa4-5205-bbf8-dea768cd7f97', 'Percentage increase', NULL, '9a3520e7-7991-5a0c-b4f8-435aa8d4c5d4', NULL, NULL, NULL),
    ('eb967821-526f-556c-961a-8cb497227615', 'Percentage decrease', NULL, '9a3520e7-7991-5a0c-b4f8-435aa8d4c5d4', NULL, NULL, NULL),
    ('73145a57-529c-5e5a-9313-e927cd1c56b2', 'Reverse percentages', NULL, '9a3520e7-7991-5a0c-b4f8-435aa8d4c5d4', NULL, NULL, NULL),
    ('40d56912-7e29-5f10-af90-5e40c4eabc87', 'Percentage change', NULL, '9a3520e7-7991-5a0c-b4f8-435aa8d4c5d4', NULL, NULL, NULL),
    ('102afbb4-d082-56ce-beeb-1d03c757051d', 'Percentage difference', NULL, '9a3520e7-7991-5a0c-b4f8-435aa8d4c5d4', NULL, NULL, NULL),
    ('0e3740ef-9749-5d69-bba4-50de15a8ca6b', 'Compound percentage change', NULL, '9a3520e7-7991-5a0c-b4f8-435aa8d4c5d4', NULL, NULL, NULL),

    ('96016d7d-ab3d-5e53-8a75-a3e458ce6c5d', 'Ratios', NULL, NULL, v_qr_section_id, NULL, NULL),
    ('01e8afbf-b14b-57eb-b424-061c48af88cb', 'Simplifying ratios', NULL, '96016d7d-ab3d-5e53-8a75-a3e458ce6c5d', NULL, NULL, NULL),
    ('5142536a-dd8b-5584-acec-db904099c76c', 'Sharing amounts in a ratio', NULL, '96016d7d-ab3d-5e53-8a75-a3e458ce6c5d', NULL, NULL, NULL),
    ('5bc9df88-9c9b-512f-a486-f74a79b9e43d', 'Ratio interpretation', NULL, '96016d7d-ab3d-5e53-8a75-a3e458ce6c5d', NULL, NULL, NULL),
    ('ab352cd5-6756-5bb6-940f-56aca184bb17', 'Comparing ratios', NULL, '96016d7d-ab3d-5e53-8a75-a3e458ce6c5d', NULL, NULL, NULL),

    ('d8cdb235-1c9c-5ed1-bac7-2d2bc47fd563', 'Proportion', NULL, NULL, v_qr_section_id, NULL, NULL),
    ('16e28751-d6e7-540d-b19c-09c73942eb30', 'Direct proportion', NULL, 'd8cdb235-1c9c-5ed1-bac7-2d2bc47fd563', NULL, NULL, NULL),
    ('75212004-de60-5de8-b5d2-58125ceb0333', 'Inverse proportion', NULL, 'd8cdb235-1c9c-5ed1-bac7-2d2bc47fd563', NULL, NULL, NULL),
    ('90e8521a-938e-5d24-9cbd-ada078856af0', 'Scaling', NULL, 'd8cdb235-1c9c-5ed1-bac7-2d2bc47fd563', NULL, NULL, NULL),

    ('694c9a10-cfb4-5a71-b115-0c309e15b125', 'Speed - Distance - Time', NULL, NULL, v_qr_section_id, NULL, NULL),

    ('c1be2fc6-3abe-5ebd-ba20-acecf292fc8f', 'Unit Conversions', NULL, NULL, v_qr_section_id, NULL, NULL),
    ('4a1019d7-6310-589d-a15e-b0f3b1b64a8f', 'Length', NULL, 'c1be2fc6-3abe-5ebd-ba20-acecf292fc8f', NULL, NULL, NULL),
    ('bcf9123a-d086-545f-9d06-a940a6571fe1', 'mm', NULL, '4a1019d7-6310-589d-a15e-b0f3b1b64a8f', NULL, NULL, NULL),
    ('2e27e157-dd8b-52b5-81d3-5957e861f802', 'cm', NULL, '4a1019d7-6310-589d-a15e-b0f3b1b64a8f', NULL, NULL, NULL),
    ('9c7d6d89-6c18-5fb3-9b29-1e6db3508cd1', 'm', NULL, '4a1019d7-6310-589d-a15e-b0f3b1b64a8f', NULL, NULL, NULL),
    ('0ec03afc-11de-5a5d-8651-7c013a753afb', 'km', NULL, '4a1019d7-6310-589d-a15e-b0f3b1b64a8f', NULL, NULL, NULL),
    ('7b509f16-5cfe-5a61-9db9-593e88d27060', 'Weight', NULL, 'c1be2fc6-3abe-5ebd-ba20-acecf292fc8f', NULL, NULL, NULL),
    ('2009f286-e4b2-5bc0-8d00-19ed0dd32c2c', 'mg', NULL, '7b509f16-5cfe-5a61-9db9-593e88d27060', NULL, NULL, NULL),
    ('f7e90343-cdcd-5ade-a52b-a356932d6273', 'g', NULL, '7b509f16-5cfe-5a61-9db9-593e88d27060', NULL, NULL, NULL),
    ('014dcbac-d19b-53bd-8af5-9acab9a886e3', 'kg', NULL, '7b509f16-5cfe-5a61-9db9-593e88d27060', NULL, NULL, NULL),
    ('050c7716-ca04-57ae-8312-d66b1ea8fac7', 'Tonnes', NULL, '7b509f16-5cfe-5a61-9db9-593e88d27060', NULL, NULL, NULL),
    ('0b406133-2c81-533c-912b-ce888ec5f56a', 'Volume', NULL, 'c1be2fc6-3abe-5ebd-ba20-acecf292fc8f', NULL, NULL, NULL),
    ('c3b46110-651d-5eef-9665-804db9c93e31', 'mL', NULL, '0b406133-2c81-533c-912b-ce888ec5f56a', NULL, NULL, NULL),
    ('cd88d217-8f57-5d97-9df2-29795d0ff14a', 'L', NULL, '0b406133-2c81-533c-912b-ce888ec5f56a', NULL, NULL, NULL),
    ('c5d4edf4-0c3c-51e7-92ed-52673d8c8fbf', 'Time', NULL, 'c1be2fc6-3abe-5ebd-ba20-acecf292fc8f', NULL, NULL, NULL),
    ('8829402c-215a-5419-903f-70f77649efc6', 'seconds', NULL, 'c5d4edf4-0c3c-51e7-92ed-52673d8c8fbf', NULL, NULL, NULL),
    ('65f40f79-7b5e-5d83-acfc-c7459fb17819', 'minutes', NULL, 'c5d4edf4-0c3c-51e7-92ed-52673d8c8fbf', NULL, NULL, NULL),
    ('040f72b7-ba60-518f-93f8-adcb51e62fd6', 'hours', NULL, 'c5d4edf4-0c3c-51e7-92ed-52673d8c8fbf', NULL, NULL, NULL),
    ('d5beee98-2123-504b-aec5-ea1e06324c82', 'days', NULL, 'c5d4edf4-0c3c-51e7-92ed-52673d8c8fbf', NULL, NULL, NULL),
    ('ca099a9d-20ca-5691-8f70-89fb7d52691d', 'Currency', NULL, 'c1be2fc6-3abe-5ebd-ba20-acecf292fc8f', NULL, NULL, NULL),
    ('0ee1ff8f-7273-506c-9c2d-6fe46a7bc317', 'Exchange rates', NULL, 'ca099a9d-20ca-5691-8f70-89fb7d52691d', NULL, NULL, NULL),
    ('9d59b1ac-ce44-502f-a789-30c4fde496b5', 'Foreign currencies', NULL, 'ca099a9d-20ca-5691-8f70-89fb7d52691d', NULL, NULL, NULL),

    ('76097ffd-7de0-5286-9b75-ecdbe77da34e', 'Averages', NULL, NULL, v_qr_section_id, NULL, NULL),
    ('8c65ab68-aa25-5764-adff-8e043f859cce', 'Mean', NULL, '76097ffd-7de0-5286-9b75-ecdbe77da34e', NULL, NULL, NULL),
    ('93651691-a8ef-55d9-8bad-e7630c67f9f3', 'Median', NULL, '76097ffd-7de0-5286-9b75-ecdbe77da34e', NULL, NULL, NULL),
    ('9d86ff31-0c35-5413-b8e1-4ebb08ced751', 'Mode', NULL, '76097ffd-7de0-5286-9b75-ecdbe77da34e', NULL, NULL, NULL),
    ('6f17d4e9-9222-5c77-8a33-a615d58ce1b0', 'Range', NULL, '76097ffd-7de0-5286-9b75-ecdbe77da34e', NULL, NULL, NULL),

    ('2ce4705b-97bc-58a9-85e4-8f7051da38e3', 'Basic Statistics', NULL, NULL, v_qr_section_id, NULL, NULL),
    ('f2ddcba4-cd93-5b59-80a2-ed486d6c7dd3', 'Comparing datasets', NULL, '2ce4705b-97bc-58a9-85e4-8f7051da38e3', NULL, NULL, NULL),
    ('bcb3cf45-f1ee-5760-9f8a-ee2736129b9b', 'Reading summary statistics', NULL, '2ce4705b-97bc-58a9-85e4-8f7051da38e3', NULL, NULL, NULL),
    ('e6a08314-84b1-586f-8970-0bc9634a5f17', 'Interpreting trends', NULL, '2ce4705b-97bc-58a9-85e4-8f7051da38e3', NULL, NULL, NULL),
    ('ca873273-148a-554e-b850-13515b668b83', 'Comparing means', NULL, '2ce4705b-97bc-58a9-85e4-8f7051da38e3', NULL, NULL, NULL),
    ('c7f85464-5375-5ced-bdb6-ff142d937ddb', 'Comparing percentages', NULL, '2ce4705b-97bc-58a9-85e4-8f7051da38e3', NULL, NULL, NULL),

    ('f65fa849-b6ec-5664-b4e8-b369bf893a66', 'Tables and Financial Maths', NULL, NULL, v_qr_section_id, NULL, NULL),
    ('fc0f0e89-a41b-5340-8f9b-5fccc86d51d2', 'Profit', NULL, 'f65fa849-b6ec-5664-b4e8-b369bf893a66', NULL, NULL, NULL),
    ('4afac79f-3a1a-5e3c-bd3d-a2e0755687b8', 'Loss', NULL, 'f65fa849-b6ec-5664-b4e8-b369bf893a66', NULL, NULL, NULL),
    ('98968071-9b5b-5c99-b82b-a6dbdc0ddd34', 'Mark-up', NULL, 'f65fa849-b6ec-5664-b4e8-b369bf893a66', NULL, NULL, NULL),
    ('a2ebacf8-6464-57b5-b972-9d71e58c33fc', 'Margin', NULL, 'f65fa849-b6ec-5664-b4e8-b369bf893a66', NULL, NULL, NULL),
    ('c08bfcea-c867-5838-bef9-1c92251b6158', 'Discounts', NULL, 'f65fa849-b6ec-5664-b4e8-b369bf893a66', NULL, NULL, NULL),
    ('b571b18c-1224-592b-b9cb-39751669463f', 'VAT/GST', NULL, 'f65fa849-b6ec-5664-b4e8-b369bf893a66', NULL, NULL, NULL),
    ('23764178-824e-5b10-8e16-d1fc1830f7ec', 'Interest', NULL, 'f65fa849-b6ec-5664-b4e8-b369bf893a66', NULL, NULL, NULL),
    ('da514554-7546-5168-95b8-e6035c3c5c2c', 'Simple interest', NULL, '23764178-824e-5b10-8e16-d1fc1830f7ec', NULL, NULL, NULL),
    ('0382e5c2-1b7a-52ce-a88d-5f210aea049b', 'Compound interest', NULL, '23764178-824e-5b10-8e16-d1fc1830f7ec', NULL, NULL, NULL),

    ('51bc9758-4692-5e86-bf10-a3d83e3faa34', 'Algebra', NULL, NULL, v_qr_section_id, NULL, NULL),

    ('ca5cbebd-2fd4-5b36-92e5-8b8924bb2cd4', 'Probability', NULL, NULL, v_qr_section_id, NULL, NULL),
    ('e127e5c7-ea22-560e-b653-0c225cbaffea', 'Simple probability', NULL, 'ca5cbebd-2fd4-5b36-92e5-8b8924bb2cd4', NULL, NULL, NULL),
    ('b28c0e23-e273-5fce-a0ca-b7a8e3289766', 'Expected outcomes', NULL, 'ca5cbebd-2fd4-5b36-92e5-8b8924bb2cd4', NULL, NULL, NULL),

    ('4a3fe410-f61e-507c-b66c-1e749aa804c9', 'Geometry', NULL, NULL, v_qr_section_id, NULL, NULL),
    ('1f59f598-c36f-54ef-8389-06ba2dee1632', 'Area', NULL, '4a3fe410-f61e-507c-b66c-1e749aa804c9', NULL, NULL, NULL),
    ('d708bdf1-64d1-58d0-9145-33984cca1e98', 'Rectangle', NULL, '1f59f598-c36f-54ef-8389-06ba2dee1632', NULL, NULL, NULL),
    ('d8ba0529-2e3f-5528-9593-87f9535804c9', 'Square', NULL, '1f59f598-c36f-54ef-8389-06ba2dee1632', NULL, NULL, NULL),
    ('54d2740d-4f0a-5d79-b481-60dcf1215b8f', 'Triangle', NULL, '1f59f598-c36f-54ef-8389-06ba2dee1632', NULL, NULL, NULL),
    ('cc31525f-11e4-5b26-aee8-b82b650381bf', 'Perimeter', NULL, '4a3fe410-f61e-507c-b66c-1e749aa804c9', NULL, NULL, NULL),
    ('395286f7-3eeb-5c1e-babd-340c151f4109', 'Volume', NULL, '4a3fe410-f61e-507c-b66c-1e749aa804c9', NULL, NULL, NULL),
    ('9fda88b0-35f9-52d3-b726-0622aed84fda', 'Cubes', NULL, '395286f7-3eeb-5c1e-babd-340c151f4109', NULL, NULL, NULL),
    ('835354b0-b481-5989-9072-e60211c1edc4', 'Rectangular prisms', NULL, '395286f7-3eeb-5c1e-babd-340c151f4109', NULL, NULL, NULL),
    ('12fe2818-ab6d-55da-8bc1-3be7e677c3cf', 'Circumference', NULL, '4a3fe410-f61e-507c-b66c-1e749aa804c9', NULL, NULL, NULL),

    ('e7c9591a-7e08-526b-b6cf-540302c87057', 'Time Calculations', NULL, NULL, v_qr_section_id, NULL, NULL),
    ('102bced7-cd78-59df-b5f6-e55a08c52244', 'Timetables', NULL, 'e7c9591a-7e08-526b-b6cf-540302c87057', NULL, NULL, NULL),
    ('f3a095d3-f4bd-54f9-b008-d2cb1809764e', 'Scheduling', NULL, 'e7c9591a-7e08-526b-b6cf-540302c87057', NULL, NULL, NULL),
    ('3325b875-6baf-5e4b-b19e-f6edb93af795', 'Duration', NULL, 'e7c9591a-7e08-526b-b6cf-540302c87057', NULL, NULL, NULL),
    ('fa7fc60b-9f04-53ce-951a-1f4dfc7692af', 'Time zones', NULL, 'e7c9591a-7e08-526b-b6cf-540302c87057', NULL, NULL, NULL),

    ('73fcf9e9-5bd3-541b-ab12-edbe77ce1932', 'Multi-Step Calculations', NULL, NULL, v_qr_section_id, NULL, NULL)
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    parent_question_tag_id = EXCLUDED.parent_question_tag_id,
    ucat_section_id = EXCLUDED.ucat_section_id,
    updated_at = NOW();
END $$;
