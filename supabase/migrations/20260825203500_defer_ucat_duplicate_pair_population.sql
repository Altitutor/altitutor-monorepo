-- Production still needs to apply 20260825204000, whose final ANALYZE can
-- exceed the hosted statement timeout after populating the full pair cache.
-- Temporarily rewrite that migration's INSERT to a no-op; the following
-- migration removes this rule and performs the same set-wise rebuild without
-- the unnecessary synchronous statistics refresh.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM supabase_migrations.schema_migrations migration
    WHERE migration.version = '20260825204000'
  ) THEN
    EXECUTE $rule$
      CREATE OR REPLACE RULE defer_ucat_duplicate_pair_population
      AS ON INSERT TO public.ucat_duplicate_stem_pairs
      DO INSTEAD NOTHING
    $rule$;
  END IF;
END;
$$;
