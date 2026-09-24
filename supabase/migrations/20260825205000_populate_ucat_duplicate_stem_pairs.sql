-- Remove the one-deploy compatibility rule and populate the fresh duplicate
-- cache. Do not synchronously ANALYZE the potentially large pair table here;
-- autovacuum will gather statistics after deployment.
DROP RULE IF EXISTS defer_ucat_duplicate_pair_population
  ON public.ucat_duplicate_stem_pairs;

SELECT public.rebuild_ucat_duplicate_stem_pairs();
