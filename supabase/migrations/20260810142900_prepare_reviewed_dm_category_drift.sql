-- Production contained three stable IDs whose categories no longer matched the
-- ALTI-540 review's original source assumption. Move only those exact observed
-- states back through the immutable reviewed migration; a following migration
-- restores the semantically approved final categories.
DO $$
DECLARE
  v_syllogisms_id CONSTANT UUID := 'b35d193a-d054-4ac2-8ae3-669ac1ff79bc';
  v_iidc_id CONSTANT UUID := '24df84c6-47d7-45d3-a255-e32d23c20eef';
  v_logical_puzzles_id CONSTANT UUID := '1ec3d39d-ae61-4ea6-9cef-bd149a96fd3a';
  v_probability_id CONSTANT UUID := 'af97ced6-4266-4926-988b-2cc6cf288e23';
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.question_stems stem
    JOIN (
      VALUES
        ('00e845fc-83db-455d-91c8-f3d436563a1c'::UUID, v_logical_puzzles_id, v_iidc_id),
        ('611ad210-c7c7-4093-880a-0ee9870b2daa'::UUID, v_probability_id, v_iidc_id),
        ('cfbff7c7-baaf-4856-bc06-4cdd2034306f'::UUID, v_logical_puzzles_id, v_syllogisms_id)
    ) AS correction(stem_id, observed_category_id, reviewed_target_category_id)
      ON correction.stem_id = stem.id
    WHERE stem.question_stem_category_id NOT IN (
      correction.observed_category_id,
      v_syllogisms_id,
      correction.reviewed_target_category_id
    )
  ) THEN
    RAISE EXCEPTION 'ALTI-540 category drift correction found an unexpected source category';
  END IF;

  UPDATE public.question_stems stem
  SET question_stem_category_id = v_syllogisms_id
  FROM (
    VALUES
      ('00e845fc-83db-455d-91c8-f3d436563a1c'::UUID, v_logical_puzzles_id),
      ('611ad210-c7c7-4093-880a-0ee9870b2daa'::UUID, v_probability_id),
      ('cfbff7c7-baaf-4856-bc06-4cdd2034306f'::UUID, v_logical_puzzles_id)
  ) AS correction(stem_id, observed_category_id)
  WHERE stem.id = correction.stem_id
    AND stem.question_stem_category_id = correction.observed_category_id;
END;
$$;
