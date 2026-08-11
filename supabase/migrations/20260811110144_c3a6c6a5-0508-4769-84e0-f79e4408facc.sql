DROP POLICY IF EXISTS "Fresh cache rows are viewable by everyone" ON public.places_cache;
REVOKE SELECT ON public.places_cache FROM anon, authenticated;
GRANT ALL ON public.places_cache TO service_role;