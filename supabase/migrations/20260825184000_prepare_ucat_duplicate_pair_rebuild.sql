-- Production has not applied 20260825184500 yet, while development has.
-- Empty the comparison projection only on databases that still need to run
-- that migration so its legacy per-row trigger backfill becomes a no-op. A
-- later migration restores the projection and rebuilds every pair set-wise.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM supabase_migrations.schema_migrations migration
    WHERE migration.version = '20260825184500'
  ) THEN
    UPDATE public.ucat_question_catalog_projection
    SET stem_comparison_text = ''
    WHERE stem_comparison_text <> '';
  END IF;
END;
$$;
