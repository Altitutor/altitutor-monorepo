-- Seed auth.users for local development and testing
-- This file creates auth.users entries and links them to staff/students
-- Runs after 01_core_entities.sql (but before other seed files that might need user_id)
-- Password for all test users: 'test-password'

-- Ensure pgcrypto extension is enabled for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Local Supabase instance ID (all zeros for local dev)
DO $$
DECLARE
  local_instance_id UUID := '00000000-0000-0000-0000-000000000000';
  
  -- ========================
  -- ADMIN STAFF USERS
  -- ========================
  staff_record RECORD;
  user_id_val UUID;
  
  -- ========================
  -- TUTOR USERS
  -- ========================
  tutor_record RECORD;
  
  -- ========================
  -- STUDENT USERS
  -- ========================
  student_record RECORD;
BEGIN
  -- Create auth.users for admin staff
  FOR staff_record IN 
    SELECT id, email, role FROM public.staff 
    WHERE role = 'ADMINSTAFF' AND user_id IS NULL
  LOOP
    -- Use staff ID as user ID for consistency
    user_id_val := staff_record.id;
    
    -- Create auth user
    BEGIN
      INSERT INTO auth.users (
        instance_id,
        id, 
        aud,
        email, 
        encrypted_password, 
        email_confirmed_at, 
        created_at, 
        updated_at, 
        raw_app_meta_data, 
        raw_user_meta_data, 
        is_super_admin, 
        role
      )
      VALUES (
        local_instance_id,
        user_id_val,
        'authenticated',
        staff_record.email,
        crypt('test-password', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('user_role', 'ADMINSTAFF'),
        false,
        'authenticated'
      );
      
      -- Create auth.identities entry (required for email/password login)
      -- For email providers, provider_id must equal user_id
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        user_id_val,
        jsonb_build_object('sub', user_id_val::text, 'email', staff_record.email),
        'email',
        user_id_val::text,
        NOW(),
        NOW(),
        NOW()
      );
      
      -- Update staff record to link to auth user
      UPDATE public.staff 
      SET user_id = user_id_val 
      WHERE id = staff_record.id;
      
      RAISE NOTICE 'Created auth user for admin: % (%)', staff_record.email, user_id_val;
    EXCEPTION
      WHEN unique_violation THEN
        -- User already exists, just update the link
        UPDATE public.staff 
        SET user_id = user_id_val 
        WHERE id = staff_record.id;
        RAISE NOTICE 'Auth user already exists for admin: %, linked staff record', staff_record.email;
    END;
  END LOOP;

  -- ========================
  -- TUTOR USERS
  -- ========================
  FOR tutor_record IN 
    SELECT id, email, role FROM public.staff 
    WHERE role = 'TUTOR' AND user_id IS NULL
  LOOP
    -- Use staff ID as user ID for consistency
    user_id_val := tutor_record.id;
    
    -- Create auth user
    BEGIN
      INSERT INTO auth.users (
        instance_id,
        id, 
        aud,
        email, 
        encrypted_password, 
        email_confirmed_at, 
        created_at, 
        updated_at, 
        raw_app_meta_data, 
        raw_user_meta_data, 
        is_super_admin, 
        role
      )
      VALUES (
        local_instance_id,
        user_id_val,
        'authenticated',
        tutor_record.email,
        crypt('test-password', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('user_role', 'TUTOR'),
        false,
        'authenticated'
      );
      
      -- Create auth.identities entry (required for email/password login)
      -- For email providers, provider_id must equal user_id
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        user_id_val,
        jsonb_build_object('sub', user_id_val::text, 'email', tutor_record.email),
        'email',
        user_id_val::text,
        NOW(),
        NOW(),
        NOW()
      );
      
      -- Update staff record to link to auth user
      UPDATE public.staff 
      SET user_id = user_id_val 
      WHERE id = tutor_record.id;
      
      RAISE NOTICE 'Created auth user for tutor: % (%)', tutor_record.email, user_id_val;
    EXCEPTION
      WHEN unique_violation THEN
        -- User already exists, just update the link
        UPDATE public.staff 
        SET user_id = user_id_val 
        WHERE id = tutor_record.id;
        RAISE NOTICE 'Auth user already exists for tutor: %, linked staff record', tutor_record.email;
    END;
  END LOOP;

  -- ========================
  -- STUDENT USERS
  -- ========================
  FOR student_record IN 
    SELECT id, email FROM public.students 
    WHERE user_id IS NULL
  LOOP
    -- Use student ID as user ID for consistency
    user_id_val := student_record.id;
    
    -- Create auth user
    BEGIN
      INSERT INTO auth.users (
        instance_id,
        id, 
        aud,
        email, 
        encrypted_password, 
        email_confirmed_at, 
        created_at, 
        updated_at, 
        raw_app_meta_data, 
        raw_user_meta_data, 
        is_super_admin, 
        role
      )
      VALUES (
        local_instance_id,
        user_id_val,
        'authenticated',
        student_record.email,
        crypt('test-password', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('user_role', 'STUDENT'),
        false,
        'authenticated'
      );
      
      -- Create auth.identities entry (required for email/password login)
      -- For email providers, provider_id must equal user_id
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        user_id_val,
        jsonb_build_object('sub', user_id_val::text, 'email', student_record.email),
        'email',
        user_id_val::text,
        NOW(),
        NOW(),
        NOW()
      );
      
      -- Update student record to link to auth user
      UPDATE public.students 
      SET user_id = user_id_val 
      WHERE id = student_record.id;
      
      RAISE NOTICE 'Created auth user for student: % (%)', student_record.email, user_id_val;
    EXCEPTION
      WHEN unique_violation THEN
        -- User already exists, just update the link
        UPDATE public.students 
        SET user_id = user_id_val 
        WHERE id = student_record.id;
        RAISE NOTICE 'Auth user already exists for student: %, linked student record', student_record.email;
    END;
  END LOOP;
END $$;
