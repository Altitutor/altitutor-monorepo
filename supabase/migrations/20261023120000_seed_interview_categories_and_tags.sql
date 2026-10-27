-- Seed the MMI station categories and question tags used by the interview bank.
-- Ids are stable so this can be applied again without duplicating rows.

INSERT INTO public.interview_categories (id, name, parent_id)
VALUES
  ('a11e0001-0000-4000-8000-000000000001', 'Personal', NULL),
  ('a11e0001-0000-4000-8000-000000000005', 'Scenario', NULL)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;

INSERT INTO public.interview_categories (id, name, parent_id)
VALUES
  ('a11e0001-0000-4000-8000-000000000002', 'Personal experience', 'a11e0001-0000-4000-8000-000000000001'),
  ('a11e0001-0000-4000-8000-000000000003', 'Personal qualities', 'a11e0001-0000-4000-8000-000000000001'),
  ('a11e0001-0000-4000-8000-000000000004', 'Motivation', 'a11e0001-0000-4000-8000-000000000001'),
  ('a11e0001-0000-4000-8000-000000000006', 'Personal ethical scenarios', 'a11e0001-0000-4000-8000-000000000005'),
  ('a11e0001-0000-4000-8000-000000000007', 'Problem solving scenarios', 'a11e0001-0000-4000-8000-000000000005')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, parent_id = EXCLUDED.parent_id;

INSERT INTO public.interview_tags (id, name)
VALUES
  ('a11e0002-0000-4000-8000-000000000001', 'Medical course'),
  ('a11e0002-0000-4000-8000-000000000002', 'Dentistry course'),
  ('a11e0002-0000-4000-8000-000000000003', 'Oral health course'),
  ('a11e0002-0000-4000-8000-000000000004', 'Rural health'),
  ('a11e0002-0000-4000-8000-000000000005', 'Indigenous health'),
  ('a11e0002-0000-4000-8000-000000000006', 'Medical profession'),
  ('a11e0002-0000-4000-8000-000000000007', 'Dental profession'),
  ('a11e0002-0000-4000-8000-000000000008', 'Oral health profession'),
  ('a11e0002-0000-4000-8000-000000000009', 'Leadership'),
  ('a11e0002-0000-4000-8000-00000000000a', 'Empathy'),
  ('a11e0002-0000-4000-8000-00000000000b', 'Teamwork'),
  ('a11e0002-0000-4000-8000-00000000000c', 'Conflict resolution'),
  ('a11e0002-0000-4000-8000-00000000000d', 'Communication'),
  ('a11e0002-0000-4000-8000-00000000000e', 'Non-maleficence'),
  ('a11e0002-0000-4000-8000-00000000000f', 'Beneficence'),
  ('a11e0002-0000-4000-8000-000000000010', 'Autonomy'),
  ('a11e0002-0000-4000-8000-000000000011', 'Justice'),
  ('a11e0002-0000-4000-8000-000000000012', 'Volunteer experience'),
  ('a11e0002-0000-4000-8000-000000000013', 'Experience in profession')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name;
