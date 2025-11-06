-- ========================
-- CREATE RESOURCES STORAGE BUCKET
-- ========================

-- Create the resources bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('resources', 'resources', false)
ON CONFLICT (id) DO NOTHING;

-- ========================
-- STORAGE POLICIES FOR RESOURCES BUCKET
-- ========================
-- Note: In Supabase, storage policies need to be created with proper role context
-- We use a DO block to handle this gracefully

DO $$
BEGIN
  -- Drop existing policies if they exist (idempotent)
  BEGIN
    DROP POLICY IF EXISTS "Admin users can upload files to resources bucket" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Admin users can read files from resources bucket" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Admin users can update files in resources bucket" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Admin users can delete files from resources bucket" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Create INSERT policy
  BEGIN
    EXECUTE 'CREATE POLICY "Admin users can upload files to resources bucket"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = ''resources'' AND
        COALESCE(
          (SELECT role FROM public.staff WHERE staff.user_id = auth.uid()),
          ''''
        ) = ''ADMIN''
      )';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping INSERT policy creation - insufficient privileges';
  END;

  -- Create SELECT policy
  BEGIN
    EXECUTE 'CREATE POLICY "Admin users can read files from resources bucket"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = ''resources'' AND
        COALESCE(
          (SELECT role FROM public.staff WHERE staff.user_id = auth.uid()),
          ''''
        ) = ''ADMIN''
      )';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping SELECT policy creation - insufficient privileges';
  END;

  -- Create UPDATE policy
  BEGIN
    EXECUTE 'CREATE POLICY "Admin users can update files in resources bucket"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = ''resources'' AND
        COALESCE(
          (SELECT role FROM public.staff WHERE staff.user_id = auth.uid()),
          ''''
        ) = ''ADMIN''
      )
      WITH CHECK (
        bucket_id = ''resources'' AND
        COALESCE(
          (SELECT role FROM public.staff WHERE staff.user_id = auth.uid()),
          ''''
        ) = ''ADMIN''
      )';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping UPDATE policy creation - insufficient privileges';
  END;

  -- Create DELETE policy
  BEGIN
    EXECUTE 'CREATE POLICY "Admin users can delete files from resources bucket"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = ''resources'' AND
        COALESCE(
          (SELECT role FROM public.staff WHERE staff.user_id = auth.uid()),
          ''''
        ) = ''ADMIN''
      )';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping DELETE policy creation - insufficient privileges';
  END;
END $$;

