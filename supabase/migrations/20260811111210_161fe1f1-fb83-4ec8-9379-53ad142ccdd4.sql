-- places_cache is an internal, server-only cache of third-party place content.
-- It must never be readable or writable by anon/authenticated clients: the app
-- reads it exclusively from server-side code with the service role.

REVOKE ALL ON TABLE public.places_cache FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.places_cache TO service_role;

ALTER TABLE public.places_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places_cache FORCE ROW LEVEL SECURITY;

-- Explicit deny-all policy so the intent is documented in the schema itself and
-- no client role can ever read or write, even if a GRANT is added by mistake.
DROP POLICY IF EXISTS "No client access to places cache" ON public.places_cache;
CREATE POLICY "No client access to places cache"
  ON public.places_cache
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.places_cache IS 'Server-only cache of third-party place content. No client access by design: reads/writes go through server functions using the service role.';