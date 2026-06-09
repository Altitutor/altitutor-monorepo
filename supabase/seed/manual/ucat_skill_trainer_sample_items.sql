-- =============================================================================
-- UCAT skill trainer — sample items for manual E2E testing
-- =============================================================================
-- NOT a migration. Paste into the Supabase Dashboard SQL Editor (dev sandbox).
--
-- Prerequisites:
--   • Migration 20260609140000_ucat_skill_trainers.sql has been applied
--   • Six catalog rows exist in ucat_skill_trainers (seeded by that migration)
--
-- Safe to re-run: fixed item UUIDs with ON CONFLICT (id) DO UPDATE.
-- All items are approved + active so students can start attempts immediately.
-- =============================================================================

INSERT INTO public.ucat_skill_trainer_items (
  id,
  skill_trainer_id,
  content,
  is_active,
  approval_status,
  approved_at
)
VALUES
  -- ---------------------------------------------------------------------------
  -- Find the word (VR) — drag keyword to sentence index (0-based)
  -- ---------------------------------------------------------------------------
  (
    'b1000001-0000-4000-8000-000000000011',
    'a1000001-0000-4000-8000-000000000001',
    jsonb_build_object(
      'passage',
      jsonb_build_object(
        'type', 'doc',
        'content', jsonb_build_array(
          jsonb_build_object(
            'type', 'paragraph',
            'content', jsonb_build_array(
              jsonb_build_object(
                'type', 'text',
                'text', 'The hospital opened a new wing. Nurses trained on the ward daily. Dr Patel led the pilot.'
              )
            )
          )
        )
      ),
      'keywords', jsonb_build_array(
        jsonb_build_object('id', 'kw1', 'text', 'hospital', 'target_sentence_index', 0),
        jsonb_build_object('id', 'kw2', 'text', 'Nurses', 'target_sentence_index', 1),
        jsonb_build_object('id', 'kw3', 'text', 'Patel', 'target_sentence_index', 2)
      )
    ),
    true,
    'approved',
    NOW()
  ),
  (
    'b1000001-0000-4000-8000-000000000012',
    'a1000001-0000-4000-8000-000000000001',
    jsonb_build_object(
      'passage',
      jsonb_build_object(
        'type', 'doc',
        'content', jsonb_build_array(
          jsonb_build_object(
            'type', 'paragraph',
            'content', jsonb_build_array(
              jsonb_build_object(
                'type', 'text',
                'text', 'The curator restored the painting. Visitors queued before noon. Security checked every bag.'
              )
            )
          )
        )
      ),
      'keywords', jsonb_build_array(
        jsonb_build_object('id', 'kw1', 'text', 'curator', 'target_sentence_index', 0),
        jsonb_build_object('id', 'kw2', 'text', 'Visitors', 'target_sentence_index', 1),
        jsonb_build_object('id', 'kw3', 'text', 'Security', 'target_sentence_index', 2)
      )
    ),
    true,
    'approved',
    NOW()
  ),

  -- ---------------------------------------------------------------------------
  -- Find the concept (VR) — char offsets in plain text (end exclusive)
  -- Passage 1 plain: "The climate in London is mild. Many discuss climate policy each year."
  --   climate @ 4–11 and 44–51
  -- Passage 2 plain: "Hospital staff reviewed the budget. The budget was approved before April."
  --   budget @ 28–34 and 40–46
  -- ---------------------------------------------------------------------------
  (
    'b1000001-0000-4000-8000-000000000021',
    'a1000001-0000-4000-8000-000000000002',
    jsonb_build_object(
      'passage',
      jsonb_build_object(
        'type', 'doc',
        'content', jsonb_build_array(
          jsonb_build_object(
            'type', 'paragraph',
            'content', jsonb_build_array(
              jsonb_build_object(
                'type', 'text',
                'text', 'The climate in London is mild. Many discuss climate policy each year.'
              )
            )
          )
        )
      ),
      'concept', 'climate',
      'occurrences', jsonb_build_array(
        jsonb_build_object('start', 4, 'end', 11),
        jsonb_build_object('start', 44, 'end', 51)
      )
    ),
    true,
    'approved',
    NOW()
  ),
  (
    'b1000001-0000-4000-8000-000000000022',
    'a1000001-0000-4000-8000-000000000002',
    jsonb_build_object(
      'passage',
      jsonb_build_object(
        'type', 'doc',
        'content', jsonb_build_array(
          jsonb_build_object(
            'type', 'paragraph',
            'content', jsonb_build_array(
              jsonb_build_object(
                'type', 'text',
                'text', 'Hospital staff reviewed the budget. The budget was approved before April.'
              )
            )
          )
        )
      ),
      'concept', 'budget',
      'occurrences', jsonb_build_array(
        jsonb_build_object('start', 28, 'end', 34),
        jsonb_build_object('start', 40, 'end', 46)
      )
    ),
    true,
    'approved',
    NOW()
  ),

  -- ---------------------------------------------------------------------------
  -- Quick syllogisms (DM)
  -- ---------------------------------------------------------------------------
  (
    'b1000001-0000-4000-8000-000000000031',
    'a1000001-0000-4000-8000-000000000003',
    '{"statement": "All mammals breathe air. Whales are mammals. Therefore whales breathe air.", "answer": true}'::jsonb,
    true,
    'approved',
    NOW()
  ),
  (
    'b1000001-0000-4000-8000-000000000032',
    'a1000001-0000-4000-8000-000000000003',
    '{"statement": "No reptiles are warm-blooded. All snakes are reptiles. Therefore some snakes are warm-blooded.", "answer": false}'::jsonb,
    true,
    'approved',
    NOW()
  ),
  (
    'b1000001-0000-4000-8000-000000000033',
    'a1000001-0000-4000-8000-000000000003',
    '{"statement": "If it rains, the pitch gets wet. It is raining. Therefore the pitch is wet.", "answer": true}'::jsonb,
    true,
    'approved',
    NOW()
  ),

  -- ---------------------------------------------------------------------------
  -- Mental maths (QR)
  -- ---------------------------------------------------------------------------
  (
    'b1000001-0000-4000-8000-000000000041',
    'a1000001-0000-4000-8000-000000000004',
    '{"expression": "17 + 8", "answer": 25}'::jsonb,
    true,
    'approved',
    NOW()
  ),
  (
    'b1000001-0000-4000-8000-000000000042',
    'a1000001-0000-4000-8000-000000000004',
    '{"expression": "144 ÷ 12", "answer": 12}'::jsonb,
    true,
    'approved',
    NOW()
  ),
  (
    'b1000001-0000-4000-8000-000000000043',
    'a1000001-0000-4000-8000-000000000004',
    '{"expression": "23 × 4", "answer": 92}'::jsonb,
    true,
    'approved',
    NOW()
  ),

  -- ---------------------------------------------------------------------------
  -- Numpad speed (QR) — UCAT calculator button labels
  -- ---------------------------------------------------------------------------
  (
    'b1000001-0000-4000-8000-000000000051',
    'a1000001-0000-4000-8000-000000000005',
    '{"button_sequence": ["7", "+", "3"], "label": "7 + 3"}'::jsonb,
    true,
    'approved',
    NOW()
  ),
  (
    'b1000001-0000-4000-8000-000000000052',
    'a1000001-0000-4000-8000-000000000005',
    '{"button_sequence": ["1", "2", "×", "5"], "label": "12 × 5"}'::jsonb,
    true,
    'approved',
    NOW()
  ),
  (
    'b1000001-0000-4000-8000-000000000053',
    'a1000001-0000-4000-8000-000000000005',
    '{"button_sequence": ["9", "÷", "3"], "label": "9 ÷ 3"}'::jsonb,
    true,
    'approved',
    NOW()
  ),

  -- ---------------------------------------------------------------------------
  -- Calculator maths speed (QR)
  -- ---------------------------------------------------------------------------
  (
    'b1000001-0000-4000-8000-000000000061',
    'a1000001-0000-4000-8000-000000000006',
    '{"expression": "15% of 200", "answer": 30}'::jsonb,
    true,
    'approved',
    NOW()
  ),
  (
    'b1000001-0000-4000-8000-000000000062',
    'a1000001-0000-4000-8000-000000000006',
    '{"expression": "A train travels 60 km in 1.5 hours. Average speed (km/h)?", "answer": 40}'::jsonb,
    true,
    'approved',
    NOW()
  ),
  (
    'b1000001-0000-4000-8000-000000000063',
    'a1000001-0000-4000-8000-000000000006',
    '{"expression": "3.5 × 8", "answer": 28}'::jsonb,
    true,
    'approved',
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  skill_trainer_id = EXCLUDED.skill_trainer_id,
  content = EXCLUDED.content,
  is_active = EXCLUDED.is_active,
  approval_status = EXCLUDED.approval_status,
  approved_at = EXCLUDED.approved_at,
  updated_at = NOW();

-- Quick sanity check (optional — comment out if your editor runs only one statement)
SELECT
  t.key,
  t.name,
  COUNT(i.id) AS approved_active_items
FROM public.ucat_skill_trainers t
LEFT JOIN public.ucat_skill_trainer_items i
  ON i.skill_trainer_id = t.id
  AND i.deleted_at IS NULL
  AND i.is_active = true
  AND i.approval_status = 'approved'
WHERE t.id IN (
  'a1000001-0000-4000-8000-000000000001',
  'a1000001-0000-4000-8000-000000000002',
  'a1000001-0000-4000-8000-000000000003',
  'a1000001-0000-4000-8000-000000000004',
  'a1000001-0000-4000-8000-000000000005',
  'a1000001-0000-4000-8000-000000000006'
)
GROUP BY t.key, t.name, t.sort_order
ORDER BY t.sort_order;
