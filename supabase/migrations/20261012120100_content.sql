-- Development content. One row of settings, plus published documents and site plans.
-- Anonymous and signed-in users can read published rows. They cannot write them.

CREATE TABLE IF NOT EXISTS public.project_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  brand_name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  profile_intro TEXT NOT NULL,
  documents_intro TEXT NOT NULL,
  footer_contact_email TEXT NOT NULL,
  wordmark_lead TEXT NOT NULL,
  wordmark_tail TEXT NOT NULL,
  seo_title TEXT NOT NULL,
  seo_description TEXT NOT NULL,
  seo_image_path TEXT NOT NULL,
  logo_light_path TEXT NOT NULL,
  logo_dark_path TEXT NOT NULL,
  favicon_path TEXT NOT NULL,
  theme JSONB NOT NULL,
  hero_image_urls TEXT[] NOT NULL,
  paystack_public_key TEXT NOT NULL DEFAULT '',
  lock_duration_ms INTEGER NOT NULL CHECK (lock_duration_ms > 0),
  presence_ttl_ms INTEGER NOT NULL CHECK (presence_ttl_ms > 0),
  reservation_deposit_cents INTEGER NOT NULL CHECK (reservation_deposit_cents > 0),
  bond_rate NUMERIC NOT NULL,
  rates_base NUMERIC NOT NULL,
  rates_multiplier NUMERIC NOT NULL,
  levy_per_sqm NUMERIC NOT NULL,
  short_term_multiplier NUMERIC NOT NULL,
  long_term_multiplier NUMERIC NOT NULL,
  price_filter_min NUMERIC NOT NULL,
  price_filter_max NUMERIC NOT NULL,
  price_filter_step NUMERIC NOT NULL,
  price_filter_amounts NUMERIC[] NOT NULL,
  password_min_length INTEGER NOT NULL CHECK (password_min_length > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_maps (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('master', 'floor')),
  label TEXT NOT NULL,
  image_path TEXT NOT NULL,
  mobile_image_path TEXT,
  view_box TEXT NOT NULL DEFAULT '0 0 1 1',
  rotate_hotspots_clockwise_on_mobile BOOLEAN NOT NULL DEFAULT false,
  frame_building_title TEXT,
  frame_facing_top TEXT,
  frame_facing_bottom TEXT,
  frame_facing_left TEXT,
  frame_facing_right TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_map_shapes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  site_map_id TEXT NOT NULL REFERENCES public.site_maps(id) ON DELETE CASCADE,
  shape_kind TEXT NOT NULL CHECK (shape_kind IN ('building', 'unit')),
  label TEXT,
  unit_number TEXT,
  path_d TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS site_map_shapes_map_idx ON public.site_map_shapes (site_map_id, sort_order);
CREATE INDEX IF NOT EXISTS documents_published_idx ON public.documents (published, sort_order);
CREATE INDEX IF NOT EXISTS site_maps_published_idx ON public.site_maps (published, sort_order);

ALTER TABLE public.project_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_map_shapes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read project settings" ON public.project_settings;
CREATE POLICY "Anyone can read project settings"
  ON public.project_settings FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can read published documents" ON public.documents;
CREATE POLICY "Anyone can read published documents"
  ON public.documents FOR SELECT
  TO anon, authenticated
  USING (published = true);

DROP POLICY IF EXISTS "Anyone can read published site maps" ON public.site_maps;
CREATE POLICY "Anyone can read published site maps"
  ON public.site_maps FOR SELECT
  TO anon, authenticated
  USING (published = true);

DROP POLICY IF EXISTS "Anyone can read published site map shapes" ON public.site_map_shapes;
CREATE POLICY "Anyone can read published site map shapes"
  ON public.site_map_shapes FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.site_maps m
      WHERE m.id = site_map_id AND m.published = true
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.project_settings FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.documents FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.site_maps FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.site_map_shapes FROM anon, authenticated;

DROP TRIGGER IF EXISTS project_settings_updated_at ON public.project_settings;
CREATE TRIGGER project_settings_updated_at
BEFORE UPDATE ON public.project_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS documents_updated_at ON public.documents;
CREATE TRIGGER documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS site_maps_updated_at ON public.site_maps;
CREATE TRIGGER site_maps_updated_at
BEFORE UPDATE ON public.site_maps
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
