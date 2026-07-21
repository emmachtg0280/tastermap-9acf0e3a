CREATE TABLE public.restaurant_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  favorite boolean NOT NULL DEFAULT false,
  personal_rating integer,
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, place_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_visits TO authenticated;
GRANT ALL ON public.restaurant_visits TO service_role;

ALTER TABLE public.restaurant_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own visits" 
  ON public.restaurant_visits
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_restaurant_visits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_restaurant_visits_updated_at
  BEFORE UPDATE ON public.restaurant_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_restaurant_visits_updated_at();