-- The service-only invoker functions for staging and expiring Teaching PDFs
-- consult queue state. Grant only the columns they read.
GRANT SELECT (file_id, status, completed_at, updated_at) ON public.print_jobs TO service_role;
