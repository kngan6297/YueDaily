-- Trigger-only SECURITY DEFINER seed must not be callable via PostgREST RPC.
REVOKE ALL ON FUNCTION public.handle_new_user_catalog_seed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_catalog_seed() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_catalog_seed() TO supabase_auth_admin, postgres, service_role;
