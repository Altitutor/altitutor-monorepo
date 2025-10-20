-- Assertions for precreate→signup linking and dual-role guard

-- 1) After signup, staff.invite@test.local should be linked via invite_token
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.staff s
    JOIN auth.users u ON u.id = s.user_id
    WHERE s.email = 'staff.invite@test.local'
      AND u.email = 'staff.invite@test.local'
  ) THEN
    RAISE EXCEPTION 'Staff invite_token linking failed';
  END IF;
END$$;

-- 2) After signup, student.email@test.local should be linked via email fallback
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.students st
    JOIN auth.users u ON u.id = st.user_id
    WHERE st.student_email = 'student.email@test.local'
      AND u.email = 'student.email@test.local'
  ) THEN
    RAISE EXCEPTION 'Student email linking failed';
  END IF;
END$$;

-- 3) Dual user: staff should link via invite_token; student should remain NULL user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.staff WHERE email = 'dual@test.local' AND user_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Dual: staff did not link';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.students WHERE student_email = 'dual@test.local' AND user_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Dual: student should remain unlinked';
  END IF;
END$$;

-- 4) Guard prevents activating both roles for same user
DO $$
DECLARE v_user uuid; v_err text; BEGIN
  SELECT user_id INTO v_user FROM public.staff WHERE email = 'dual@test.local';
  BEGIN
    UPDATE public.students SET status = 'TRIAL', user_id = v_user WHERE student_email = 'dual@test.local';
    RAISE EXCEPTION 'Expected dual-role guard to block activation';
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    IF position('active staff' IN v_err) = 0 THEN
      RAISE EXCEPTION 'Unexpected error: %', v_err;
    END IF;
  END;
END$$;


