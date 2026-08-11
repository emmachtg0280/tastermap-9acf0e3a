-- 1. CITIES
CREATE TABLE public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius integer NOT NULL DEFAULT 8000,
  default_zoom double precision NOT NULL DEFAULT 13,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cities TO anon, authenticated;
GRANT ALL ON public.cities TO service_role;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cities are viewable by everyone" ON public.cities FOR SELECT TO anon, authenticated USING (true);

-- 2. NEIGHBORHOODS
CREATE TABLE public.neighborhoods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  name text NOT NULL,
  geometry jsonb,
  centroid_lat double precision,
  centroid_lng double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, name)
);
CREATE INDEX idx_neighborhoods_city ON public.neighborhoods(city_id);
GRANT SELECT ON public.neighborhoods TO anon, authenticated;
GRANT ALL ON public.neighborhoods TO service_role;
ALTER TABLE public.neighborhoods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Neighborhoods are viewable by everyone" ON public.neighborhoods FOR SELECT TO anon, authenticated USING (true);

-- 3. PLACES (permanent identity, no Google content)
CREATE TABLE public.places (
  place_id text PRIMARY KEY,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  neighborhood_id uuid REFERENCES public.neighborhoods(id) ON DELETE SET NULL,
  geo_cell text,
  status text NOT NULL DEFAULT 'active',
  replaced_by_place_id text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_refreshed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_places_city ON public.places(city_id);
CREATE INDEX idx_places_neighborhood ON public.places(neighborhood_id);
CREATE INDEX idx_places_geo_cell ON public.places(geo_cell);
GRANT SELECT ON public.places TO anon, authenticated;
GRANT ALL ON public.places TO service_role;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Places are viewable by everyone" ON public.places FOR SELECT TO anon, authenticated USING (true);

-- 4. PLACES_CACHE (expiring Google content, <= 30 days)
CREATE TABLE public.places_cache (
  place_id text PRIMARY KEY REFERENCES public.places(place_id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  rating_fetched_at timestamptz
);
CREATE INDEX idx_places_cache_expires ON public.places_cache(expires_at);
GRANT SELECT ON public.places_cache TO anon, authenticated;
GRANT ALL ON public.places_cache TO service_role;
ALTER TABLE public.places_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fresh cache rows are viewable by everyone" ON public.places_cache FOR SELECT TO anon, authenticated USING (expires_at > now());

-- 5. PLACE_TAGS
CREATE TABLE public.place_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id text NOT NULL REFERENCES public.places(place_id) ON DELETE CASCADE,
  tag text NOT NULL,
  source text NOT NULL DEFAULT 'google_types',
  confidence double precision NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (place_id, tag, source)
);
CREATE INDEX idx_place_tags_place ON public.place_tags(place_id);
CREATE INDEX idx_place_tags_tag ON public.place_tags(tag);
GRANT SELECT ON public.place_tags TO anon, authenticated;
GRANT ALL ON public.place_tags TO service_role;
ALTER TABLE public.place_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Place tags are viewable by everyone" ON public.place_tags FOR SELECT TO anon, authenticated USING (true);

-- 6. PLACE_SIGNALS
CREATE TABLE public.place_signals (
  place_id text PRIMARY KEY REFERENCES public.places(place_id) ON DELETE CASCADE,
  visits_30d integer NOT NULL DEFAULT 0,
  favorites_30d integer NOT NULL DEFAULT 0,
  hype_score double precision NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_place_signals_hype ON public.place_signals(hype_score DESC);
GRANT SELECT ON public.place_signals TO anon, authenticated;
GRANT ALL ON public.place_signals TO service_role;
ALTER TABLE public.place_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Place signals are viewable by everyone" ON public.place_signals FOR SELECT TO anon, authenticated USING (true);

-- 7. PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  display_name text,
  home_city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 8. restaurant_visits -> user_places
ALTER TABLE public.restaurant_visits RENAME TO user_places;
ALTER TABLE public.user_places RENAME COLUMN done TO visited;
ALTER TABLE public.user_places ADD COLUMN saved boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_places ADD COLUMN visited_at timestamptz;
UPDATE public.user_places SET visited_at = updated_at WHERE visited = true AND visited_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_places_user ON public.user_places(user_id);
CREATE INDEX IF NOT EXISTS idx_user_places_place ON public.user_places(place_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_places TO authenticated;
GRANT ALL ON public.user_places TO service_role;

-- shared updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_cities_updated_at BEFORE UPDATE ON public.cities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_neighborhoods_updated_at BEFORE UPDATE ON public.neighborhoods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_places_updated_at BEFORE UPDATE ON public.places FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- seed the six supported cities
INSERT INTO public.cities (key, label, lat, lng, radius, default_zoom) VALUES
  ('toulouse', 'Toulouse', 43.6047, 1.4442, 9000, 13),
  ('montpellier', 'Montpellier', 43.6108, 3.8767, 8000, 13),
  ('paris', 'Paris', 48.8566, 2.3522, 10000, 13),
  ('lyon', 'Lyon', 45.7640, 4.8357, 9000, 13),
  ('marseille', 'Marseille', 43.2965, 5.3698, 10000, 13),
  ('bordeaux', 'Bordeaux', 44.8378, -0.5792, 8000, 13);