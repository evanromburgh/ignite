-- Explicit grants. This project does not automatically expose new tables.
-- Client roles can read published content and change only their own rows.
-- Lock, reservation, and cron writes stay on service_role.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.units FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.agents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.wishlists FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.reservations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.project_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.site_maps FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.site_map_shapes FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.units TO anon, authenticated;
GRANT SELECT ON TABLE public.agents TO anon, authenticated;
GRANT SELECT ON TABLE public.project_settings TO anon, authenticated;
GRANT SELECT ON TABLE public.documents TO anon, authenticated;
GRANT SELECT ON TABLE public.site_maps TO anon, authenticated;
GRANT SELECT ON TABLE public.site_map_shapes TO anon, authenticated;

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.wishlists TO authenticated;
GRANT SELECT ON TABLE public.reservations TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.profiles,
  public.units,
  public.agents,
  public.wishlists,
  public.reservations,
  public.project_settings,
  public.documents,
  public.site_maps,
  public.site_map_shapes
TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
