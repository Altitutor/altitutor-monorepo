-- Hosted Altitutor projects were created with Supabase's legacy PostgREST
-- grants. New local stacks no longer add those grants automatically, even
-- though this schema's RLS policies and views were authored against them.
-- Restore that hosted-project baseline locally; RLS still controls row access.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
