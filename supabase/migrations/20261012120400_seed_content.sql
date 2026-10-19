-- Seeded Ignite development content. Paths resolve against the new project URL at runtime.
INSERT INTO public.project_settings (
  id, brand_name, tagline, profile_intro, documents_intro, footer_contact_email,
  wordmark_lead, wordmark_tail, seo_title, seo_description,
  seo_image_path, logo_light_path, logo_dark_path, favicon_path,
  theme, hero_image_urls, paystack_public_key,
  lock_duration_ms, presence_ttl_ms, reservation_deposit_cents,
  bond_rate, rates_base, rates_multiplier, levy_per_sqm,
  short_term_multiplier, long_term_multiplier,
  price_filter_min, price_filter_max, price_filter_step, price_filter_amounts,
  password_min_length
) VALUES (
  1,
  'Ignite Studios',
  'Property Sales, Reimagined.',
  'View the details of your {brand} account.',
  'Comprehensive access to all legal frameworks and site development blueprints.',
  'info@ignite-studios.co.za',
  'IGNITE',
  'STUDIOS',
  'Streamline Your Unit Reservation Process',
  'Ignite Studios gives your team one portal to view available units, reserve them, and keep required reservation documents organized.',
  'assets/images/seo_image.webp',
  'assets/branding/logo_light.svg',
  'assets/branding/logo_dark.svg',
  'assets/branding/favicon.png',
  '{"--theme-bg":"#f5f5f4","--theme-surface":"#ffffff","--theme-surface-hover":"#fafafa","--theme-surface-elevated":"#ffffff","--theme-border":"#e4e4e7","--theme-border-strong":"#d4d4d8","--theme-overlay":"rgba(0, 0, 0, 0.4)","--theme-overlay-nav":"#18181b","--theme-overlay-dropdown":"#ffffff","--theme-card-overlay":"rgba(0, 0, 0, 0.6)","--theme-input-bg":"#f4f4f5","--theme-text-primary":"#18181b","--theme-text-muted":"#52525b","--theme-text-muted-2":"#71717a","--theme-accent-green":"#22c55e","--theme-footer-bg":"#18181b"}'::jsonb,
  ARRAY['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1920', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1920'],
  '',
  600000,
  12000,
  1000000,
  0.01047,
  850,
  0.0005,
  24,
  1.27,
  0.86,
  1500000,
  9000000,
  50000,
  ARRAY[1500000, 2000000, 3000000, 5000000, 7000000],
  8
);

INSERT INTO public.documents (id, title, description, file_path, file_type, file_size, sort_order, published) VALUES (
  'site-development-plan', 'Site Development Plan', 'Architectural overview detailing building placement, landscaping zones, and site infrastructure.', 'downloads/site-development-plan.pdf', 'PDF', '5.88 MB', 0, true
);
INSERT INTO public.documents (id, title, description, file_path, file_type, file_size, sort_order, published) VALUES (
  'floorplan-pack', 'Floorplan Pack', 'Comprehensive technical layouts for all standard and premium configuration variants.', 'downloads/floorplan-pack.pdf', 'PDF', '1.03 MB', 1, true
);
INSERT INTO public.documents (id, title, description, file_path, file_type, file_size, sort_order, published) VALUES (
  'electrical-schedule', 'Electrical Schedule', 'Complete technical layout of lighting, power points, and smart-home integration conduits for all unit types.', 'downloads/electrical-schedule.pdf', 'PDF', '1.97 MB', 2, true
);
INSERT INTO public.documents (id, title, description, file_path, file_type, file_size, sort_order, published) VALUES (
  'conduct-rules', 'Conduct Rules', 'Official regulatory framework ensuring the maintenance of Ignite’s luxury standards and communal harmony.', 'downloads/conduct-rules.pdf', 'PDF', '1.57 MB', 3, true
);
INSERT INTO public.documents (id, title, description, file_path, file_type, file_size, sort_order, published) VALUES (
  'list-of-specifications', 'List of Specifications', 'Technical breakdown of luxury finishes, fixtures, and premium structural materials.', 'downloads/list-of-specifications.pdf', 'PDF', '381 KB', 4, true
);

INSERT INTO public.site_maps (id, kind, label, image_path, view_box, sort_order, published) VALUES (
  'master', 'master', 'BLOCK G', 'sitemap/location-background.webp', '0 0 1 1', 0, true
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, label, path_d, sort_order) VALUES (
  'master', 'building', 'BLOCK G', 'M 0.3766 0.4787 L 0.3906 0.4620 L 0.4099 0.4667 L 0.4307 0.4417 L 0.5724 0.4852 L 0.5714 0.5676 L 0.5193 0.6148 L 0.5057 0.6157 L 0.5057 0.6102 L 0.3786 0.5509 Z', 0
);
INSERT INTO public.site_maps (
  id, kind, label, image_path, mobile_image_path, view_box,
  rotate_hotspots_clockwise_on_mobile, frame_building_title,
  frame_facing_top, frame_facing_bottom, frame_facing_left, frame_facing_right,
  sort_order, published
) VALUES (
  'ground', 'floor', 'Ground floor', 'sitemap/ground-floor-plan.webp', NULL, '0 0 1 1',
  false, 'BLOCK G',
  'Stellenbosch Mountain Skyline', 'Tygerberg Hills outlook', 'Durbanville Hills outlook', 'Table Mountain views',
  1, true
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'ground', 'unit', '812', 'M 0.0007 0.078 L 0.0933 0.078 L 0.0933 0.0719 L 0.168 0.0719 L 0.168 0.078 L 0.1852 0.078 L 0.1852 0.4205 L 0.0007 0.4205 Z', 0
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'ground', 'unit', '811', 'M 0.1852 0.078 L 0.2016 0.078 L 0.2016 0.0719 L 0.2689 0.0719 L 0.2689 0.078 L 0.3422 0.078 L 0.3422 0.4205 L 0.1852 0.4205 Z', 1
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'ground', 'unit', '810', 'M 0.3422 0.078 L 0.4163 0.078 L 0.4163 0.0719 L 0.4835 0.0719 L 0.4835 0.078 L 0.5007 0.078 L 0.5007 0.4205 L 0.3422 0.4205 Z', 2
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'ground', 'unit', '809', 'M 0.5007 0.078 L 0.5171 0.078 L 0.5171 0.0719 L 0.585 0.0719 L 0.585 0.078 L 0.6584 0.078 L 0.6584 0.4205 L 0.5007 0.4205 Z', 3
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'ground', 'unit', '808', 'M 0.6584 0.078 L 0.7325 0.078 L 0.7325 0.0719 L 0.7997 0.0719 L 0.7997 0.078 L 0.8162 0.078 L 0.8162 0.4205 L 0.6584 0.4205 Z', 4
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'ground', 'unit', '807', 'M 0.8162 0.078 L 0.8333 0.078 L 0.8333 0.0719 L 0.9081 0.0719 L 0.9081 0.078 L 0.9993 0.078 L 0.9993 0.4205 L 0.8162 0.4205 Z', 5
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'ground', 'unit', '801', 'M 0.0007 0.922 L 0.0933 0.922 L 0.0933 0.9281 L 0.168 0.9281 L 0.168 0.922 L 0.1852 0.922 L 0.1852 0.5795 L 0.0007 0.5795 Z', 6
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'ground', 'unit', '802', 'M 0.1852 0.922 L 0.2016 0.922 L 0.2016 0.9281 L 0.2689 0.9281 L 0.2689 0.922 L 0.3422 0.922 L 0.3422 0.5795 L 0.1852 0.5795 Z', 7
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'ground', 'unit', '803', 'M 0.3422 0.922 L 0.4163 0.922 L 0.4163 0.9281 L 0.4835 0.9281 L 0.4835 0.922 L 0.5007 0.922 L 0.5007 0.5795 L 0.3422 0.5795 Z', 8
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'ground', 'unit', '804', 'M 0.5007 0.922 L 0.5171 0.922 L 0.5171 0.9281 L 0.585 0.9281 L 0.585 0.922 L 0.6584 0.922 L 0.6584 0.5795 L 0.5007 0.5795 Z', 9
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'ground', 'unit', '805', 'M 0.6584 0.922 L 0.7325 0.922 L 0.7325 0.9281 L 0.7997 0.9281 L 0.7997 0.922 L 0.8162 0.922 L 0.8162 0.5795 L 0.6584 0.5795 Z', 10
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'ground', 'unit', '806', 'M 0.8162 0.922 L 0.8333 0.922 L 0.8333 0.9281 L 0.9081 0.9281 L 0.9081 0.922 L 0.9993 0.922 L 0.9993 0.5795 L 0.8162 0.5795 Z', 11
);
INSERT INTO public.site_maps (
  id, kind, label, image_path, mobile_image_path, view_box,
  rotate_hotspots_clockwise_on_mobile, frame_building_title,
  frame_facing_top, frame_facing_bottom, frame_facing_left, frame_facing_right,
  sort_order, published
) VALUES (
  'first', 'floor', 'First floor', 'sitemap/first-floor-plan.webp', NULL, '0 0 1 1',
  false, 'BLOCK G',
  'Stellenbosch Mountain Skyline', 'Tygerberg Hills outlook', 'Durbanville Hills outlook', 'Table Mountain views',
  2, true
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'first', 'unit', '824', 'M 0.0007 0.078 L 0.0933 0.078 L 0.0933 0.0719 L 0.168 0.0719 L 0.168 0.078 L 0.1852 0.078 L 0.1852 0.4205 L 0.0007 0.4205 Z', 0
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'first', 'unit', '823', 'M 0.1852 0.078 L 0.2016 0.078 L 0.2016 0.0719 L 0.2689 0.0719 L 0.2689 0.078 L 0.3422 0.078 L 0.3422 0.4205 L 0.1852 0.4205 Z', 1
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'first', 'unit', '822', 'M 0.3422 0.078 L 0.4163 0.078 L 0.4163 0.0719 L 0.4835 0.0719 L 0.4835 0.078 L 0.5007 0.078 L 0.5007 0.4205 L 0.3422 0.4205 Z', 2
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'first', 'unit', '821', 'M 0.5007 0.078 L 0.5171 0.078 L 0.5171 0.0719 L 0.585 0.0719 L 0.585 0.078 L 0.6584 0.078 L 0.6584 0.4205 L 0.5007 0.4205 Z', 3
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'first', 'unit', '820', 'M 0.6584 0.078 L 0.7325 0.078 L 0.7325 0.0719 L 0.7997 0.0719 L 0.7997 0.078 L 0.8162 0.078 L 0.8162 0.4205 L 0.6584 0.4205 Z', 4
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'first', 'unit', '819', 'M 0.8162 0.078 L 0.8333 0.078 L 0.8333 0.0719 L 0.9081 0.0719 L 0.9081 0.078 L 0.9993 0.078 L 0.9993 0.4205 L 0.8162 0.4205 Z', 5
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'first', 'unit', '818', 'M 0.8162 0.922 L 0.8333 0.922 L 0.8333 0.9281 L 0.9081 0.9281 L 0.9081 0.922 L 0.9993 0.922 L 0.9993 0.5795 L 0.8162 0.5795 Z', 6
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'first', 'unit', '817', 'M 0.6584 0.922 L 0.7325 0.922 L 0.7325 0.9281 L 0.7997 0.9281 L 0.7997 0.922 L 0.8162 0.922 L 0.8162 0.5795 L 0.6584 0.5795 Z', 7
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'first', 'unit', '816', 'M 0.5007 0.922 L 0.5171 0.922 L 0.5171 0.9281 L 0.585 0.9281 L 0.585 0.922 L 0.6584 0.922 L 0.6584 0.5795 L 0.5007 0.5795 Z', 8
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'first', 'unit', '815', 'M 0.3422 0.922 L 0.4163 0.922 L 0.4163 0.9281 L 0.4835 0.9281 L 0.4835 0.922 L 0.5007 0.922 L 0.5007 0.5795 L 0.3422 0.5795 Z', 9
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'first', 'unit', '814', 'M 0.1852 0.922 L 0.2016 0.922 L 0.2016 0.9281 L 0.2689 0.9281 L 0.2689 0.922 L 0.3422 0.922 L 0.3422 0.5795 L 0.1852 0.5795 Z', 10
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'first', 'unit', '813', 'M 0.0007 0.922 L 0.0933 0.922 L 0.0933 0.9281 L 0.168 0.9281 L 0.168 0.922 L 0.1852 0.922 L 0.1852 0.5795 L 0.0007 0.5795 Z', 11
);
INSERT INTO public.site_maps (
  id, kind, label, image_path, mobile_image_path, view_box,
  rotate_hotspots_clockwise_on_mobile, frame_building_title,
  frame_facing_top, frame_facing_bottom, frame_facing_left, frame_facing_right,
  sort_order, published
) VALUES (
  'second', 'floor', 'Second floor', 'sitemap/second-floor-plan.webp', NULL, '0 0 1 1',
  false, 'BLOCK G',
  'Stellenbosch Mountain Skyline', 'Tygerberg Hills outlook', 'Durbanville Hills outlook', 'Table Mountain views',
  3, true
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'second', 'unit', '836', 'M 0.0007 0.078 L 0.0933 0.078 L 0.0933 0.0719 L 0.168 0.0719 L 0.168 0.078 L 0.1852 0.078 L 0.1852 0.4205 L 0.0007 0.4205 Z', 0
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'second', 'unit', '835', 'M 0.1852 0.078 L 0.2016 0.078 L 0.2016 0.0719 L 0.2689 0.0719 L 0.2689 0.078 L 0.3422 0.078 L 0.3422 0.4205 L 0.1852 0.4205 Z', 1
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'second', 'unit', '834', 'M 0.3422 0.078 L 0.4163 0.078 L 0.4163 0.0719 L 0.4835 0.0719 L 0.4835 0.078 L 0.5007 0.078 L 0.5007 0.4205 L 0.3422 0.4205 Z', 2
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'second', 'unit', '833', 'M 0.5007 0.078 L 0.5171 0.078 L 0.5171 0.0719 L 0.585 0.0719 L 0.585 0.078 L 0.6584 0.078 L 0.6584 0.4205 L 0.5007 0.4205 Z', 3
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'second', 'unit', '832', 'M 0.6584 0.078 L 0.7325 0.078 L 0.7325 0.0719 L 0.7997 0.0719 L 0.7997 0.078 L 0.8162 0.078 L 0.8162 0.4205 L 0.6584 0.4205 Z', 4
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'second', 'unit', '831', 'M 0.8162 0.078 L 0.8333 0.078 L 0.8333 0.0719 L 0.9081 0.0719 L 0.9081 0.078 L 0.9993 0.078 L 0.9993 0.4205 L 0.8162 0.4205 Z', 5
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'second', 'unit', '830', 'M 0.8162 0.922 L 0.8333 0.922 L 0.8333 0.9281 L 0.9081 0.9281 L 0.9081 0.922 L 0.9993 0.922 L 0.9993 0.5795 L 0.8162 0.5795 Z', 6
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'second', 'unit', '829', 'M 0.6584 0.922 L 0.7325 0.922 L 0.7325 0.9281 L 0.7997 0.9281 L 0.7997 0.922 L 0.8162 0.922 L 0.8162 0.5795 L 0.6584 0.5795 Z', 7
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'second', 'unit', '828', 'M 0.5007 0.922 L 0.5171 0.922 L 0.5171 0.9281 L 0.585 0.9281 L 0.585 0.922 L 0.6584 0.922 L 0.6584 0.5795 L 0.5007 0.5795 Z', 8
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'second', 'unit', '827', 'M 0.3422 0.922 L 0.4163 0.922 L 0.4163 0.9281 L 0.4835 0.9281 L 0.4835 0.922 L 0.5007 0.922 L 0.5007 0.5795 L 0.3422 0.5795 Z', 9
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'second', 'unit', '826', 'M 0.1852 0.922 L 0.2016 0.922 L 0.2016 0.9281 L 0.2689 0.9281 L 0.2689 0.922 L 0.3422 0.922 L 0.3422 0.5795 L 0.1852 0.5795 Z', 10
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'second', 'unit', '825', 'M 0.0007 0.922 L 0.0933 0.922 L 0.0933 0.9281 L 0.168 0.9281 L 0.168 0.922 L 0.1852 0.922 L 0.1852 0.5795 L 0.0007 0.5795 Z', 11
);
INSERT INTO public.site_maps (
  id, kind, label, image_path, mobile_image_path, view_box,
  rotate_hotspots_clockwise_on_mobile, frame_building_title,
  frame_facing_top, frame_facing_bottom, frame_facing_left, frame_facing_right,
  sort_order, published
) VALUES (
  'third', 'floor', 'Third floor', 'sitemap/third-floor-plan.webp', NULL, '0 0 1 1',
  false, 'BLOCK G',
  'Stellenbosch Mountain Skyline', 'Tygerberg Hills outlook', 'Durbanville Hills outlook', 'Table Mountain views',
  4, true
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'third', 'unit', '848', 'M 0.0007 0.078 L 0.0933 0.078 L 0.0933 0.0719 L 0.168 0.0719 L 0.168 0.078 L 0.1852 0.078 L 0.1852 0.4205 L 0.0007 0.4205 Z', 0
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'third', 'unit', '847', 'M 0.1852 0.078 L 0.2016 0.078 L 0.2016 0.0719 L 0.2689 0.0719 L 0.2689 0.078 L 0.3422 0.078 L 0.3422 0.4205 L 0.1852 0.4205 Z', 1
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'third', 'unit', '846', 'M 0.3422 0.078 L 0.4163 0.078 L 0.4163 0.0719 L 0.4835 0.0719 L 0.4835 0.078 L 0.5007 0.078 L 0.5007 0.4205 L 0.3422 0.4205 Z', 2
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'third', 'unit', '845', 'M 0.5007 0.078 L 0.5171 0.078 L 0.5171 0.0719 L 0.585 0.0719 L 0.585 0.078 L 0.6584 0.078 L 0.6584 0.4205 L 0.5007 0.4205 Z', 3
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'third', 'unit', '844', 'M 0.6584 0.078 L 0.7325 0.078 L 0.7325 0.0719 L 0.7997 0.0719 L 0.7997 0.078 L 0.8162 0.078 L 0.8162 0.4205 L 0.6584 0.4205 Z', 4
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'third', 'unit', '843', 'M 0.8162 0.078 L 0.8333 0.078 L 0.8333 0.0719 L 0.9081 0.0719 L 0.9081 0.078 L 0.9993 0.078 L 0.9993 0.4205 L 0.8162 0.4205 Z', 5
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'third', 'unit', '842', 'M 0.8162 0.922 L 0.8333 0.922 L 0.8333 0.9281 L 0.9081 0.9281 L 0.9081 0.922 L 0.9993 0.922 L 0.9993 0.5795 L 0.8162 0.5795 Z', 6
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'third', 'unit', '841', 'M 0.6584 0.922 L 0.7325 0.922 L 0.7325 0.9281 L 0.7997 0.9281 L 0.7997 0.922 L 0.8162 0.922 L 0.8162 0.5795 L 0.6584 0.5795 Z', 7
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'third', 'unit', '840', 'M 0.5007 0.922 L 0.5171 0.922 L 0.5171 0.9281 L 0.585 0.9281 L 0.585 0.922 L 0.6584 0.922 L 0.6584 0.5795 L 0.5007 0.5795 Z', 8
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'third', 'unit', '839', 'M 0.3422 0.922 L 0.4163 0.922 L 0.4163 0.9281 L 0.4835 0.9281 L 0.4835 0.922 L 0.5007 0.922 L 0.5007 0.5795 L 0.3422 0.5795 Z', 9
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'third', 'unit', '838', 'M 0.1852 0.922 L 0.2016 0.922 L 0.2016 0.9281 L 0.2689 0.9281 L 0.2689 0.922 L 0.3422 0.922 L 0.3422 0.5795 L 0.1852 0.5795 Z', 10
);
INSERT INTO public.site_map_shapes (site_map_id, shape_kind, unit_number, path_d, sort_order) VALUES (
  'third', 'unit', '837', 'M 0.0007 0.922 L 0.0933 0.922 L 0.0933 0.9281 L 0.168 0.9281 L 0.168 0.922 L 0.1852 0.922 L 0.1852 0.5795 L 0.0007 0.5795 Z', 11
);
