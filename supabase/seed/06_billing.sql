-- Seed data for billing: students_billing, student_payment_methods, student_subsidies, payment_attempts
-- Depends on: students, subjects, sessions_students

DO $$
DECLARE
  math_subject_id UUID;
  bio_subject_id UUID;
  session1_id UUID := '50000000-0000-0000-0000-000000000001';
  session2_id UUID := '50000000-0000-0000-0000-000000000002';
  sessions_students1_id UUID;
  sessions_students2_id UUID;
BEGIN
  -- Get subject IDs
  SELECT id INTO math_subject_id FROM public.subjects WHERE name = 'Mathematical Methods' AND year_level = 12 AND curriculum = 'SACE' LIMIT 1;
  SELECT id INTO bio_subject_id FROM public.subjects WHERE name = 'Biology' AND year_level = 12 AND curriculum = 'SACE' LIMIT 1;

  -- Get sessions_students IDs
  SELECT id INTO sessions_students1_id FROM public.sessions_students WHERE session_id = session1_id AND student_id = '10000000-0000-0000-0000-000000000001' LIMIT 1;
  SELECT id INTO sessions_students2_id FROM public.sessions_students WHERE session_id = session2_id AND student_id = '10000000-0000-0000-0000-000000000004' LIMIT 1;

  -- ========================
  -- STUDENTS_BILLING
  -- ========================
  INSERT INTO public.students_billing (student_id, stripe_customer_id)
  VALUES
    ('10000000-0000-0000-0000-000000000001', 'cus_test_alice_williams'),
    ('10000000-0000-0000-0000-000000000002', 'cus_test_bob_taylor'),
    ('10000000-0000-0000-0000-000000000003', 'cus_test_charlie_martinez'),
    ('10000000-0000-0000-0000-000000000004', 'cus_test_diana_garcia'),
    ('10000000-0000-0000-0000-000000000005', 'cus_test_edward_lee'),
    ('10000000-0000-0000-0000-000000000006', 'cus_test_fiona_harris')
  ON CONFLICT (student_id) DO NOTHING;

  -- ========================
  -- STUDENT_PAYMENT_METHODS
  -- ========================
  INSERT INTO public.student_payment_methods (id, student_id, stripe_payment_method_id, is_default, card_brand, card_last4, card_exp_month, card_exp_year, card_country)
  VALUES
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'pm_test_visa_1', true, 'visa', '4242', 12, 2025, 'AU'),
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', 'pm_test_mastercard_1', true, 'mastercard', '5555', 6, 2026, 'AU'),
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000003', 'pm_test_amex_1', true, 'amex', '0005', 9, 2025, 'AU'),
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000004', 'pm_test_visa_2', true, 'visa', '1234', 3, 2026, 'AU'),
    -- Alice has a second payment method
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'pm_test_visa_backup', false, 'visa', '8888', 12, 2027, 'AU')
  ON CONFLICT (stripe_payment_method_id) DO NOTHING;

  -- ========================
  -- STUDENT_SUBSIDIES
  -- ========================
  INSERT INTO public.student_subsidies (id, student_id, subject_id, billing_type, price_cents, currency, effective_from, effective_until)
  VALUES
    -- Alice has a subsidy for Math
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', math_subject_id, 'CLASS', 5000, 'AUD', '2024-01-01'::TIMESTAMPTZ, NULL),
    -- Edward (trial student) has a discount
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000005', bio_subject_id, 'CLASS', 3000, 'AUD', '2024-03-01'::TIMESTAMPTZ, '2024-06-01'::TIMESTAMPTZ)
  ON CONFLICT DO NOTHING;

  -- ========================
  -- PAYMENT_ATTEMPTS
  -- ========================
  -- Only create payment attempts if sessions_students records exist
  IF sessions_students1_id IS NOT NULL THEN
    INSERT INTO public.payment_attempts (
      id, sessions_students_id, student_id, session_id, attempt_number,
      amount_cents, currency, stripe_payment_intent_id, status,
      created_at, charged_at
    )
    VALUES
      (gen_random_uuid(), sessions_students1_id, '10000000-0000-0000-0000-000000000001', session1_id, 1,
       5000, 'AUD', 'pi_test_success_1', 'succeeded',
       NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days')
    ON CONFLICT DO NOTHING;
  END IF;

  IF sessions_students2_id IS NOT NULL THEN
    INSERT INTO public.payment_attempts (
      id, sessions_students_id, student_id, session_id, attempt_number,
      amount_cents, currency, stripe_payment_intent_id, status,
      created_at
    )
    VALUES
      (gen_random_uuid(), sessions_students2_id, '10000000-0000-0000-0000-000000000004', session2_id, 1,
       6000, 'AUD', 'pi_test_pending_1', 'pending',
       NOW() - INTERVAL '6 days'),
      -- Failed attempt that was retried
      (gen_random_uuid(), sessions_students2_id, '10000000-0000-0000-0000-000000000004', session2_id, 2,
       6000, 'AUD', 'pi_test_failed_1', 'failed',
       NOW() - INTERVAL '5 days')
    ON CONFLICT DO NOTHING;
  END IF;

END $$;

