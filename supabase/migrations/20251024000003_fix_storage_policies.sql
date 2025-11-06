-- Fix storage policies for resources bucket
-- The existing policies are too restrictive, this allows authenticated users to upload
-- Note: In local development, these policies may not be creatable due to ownership constraints

DO $$
BEGIN
  -- Drop existing policies if they exist
  BEGIN
    DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DROP POLICY IF EXISTS "Allow authenticated uploads to resources" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DROP POLICY IF EXISTS "Allow authenticated reads from resources" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DROP POLICY IF EXISTS "Allow authenticated deletes from resources" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DROP POLICY IF EXISTS "Allow authenticated updates to resources" ON storage.objects;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Create new policies for the resources bucket
  BEGIN
    EXECUTE 'CREATE POLICY "Allow authenticated uploads to resources"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = ''resources'')';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping INSERT policy creation - insufficient privileges';
  END;

  BEGIN
    EXECUTE 'CREATE POLICY "Allow authenticated reads from resources"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = ''resources'')';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping SELECT policy creation - insufficient privileges';
  END;

  BEGIN
    EXECUTE 'CREATE POLICY "Allow authenticated deletes from resources"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = ''resources'')';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping DELETE policy creation - insufficient privileges';
  END;

  BEGIN
    EXECUTE 'CREATE POLICY "Allow authenticated updates to resources"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = ''resources'')
      WITH CHECK (bucket_id = ''resources'')';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping UPDATE policy creation - insufficient privileges';
  END;
END $$;

