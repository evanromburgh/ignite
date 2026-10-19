-- ============================================================================
-- Units seed for clean test project
-- - Generates new UUIDs (id omitted)
-- - Resets all statuses to Available
-- - Clears lock/viewer transient state
-- - Uses storage object keys + floorplan per unit type
-- ============================================================================

WITH src(unit_number, bedrooms, bathrooms, parking, size_sqm, price, unit_type) AS (
  VALUES
    ('701', 2, 2, 1, 75, 1814000, 'C1'),
    ('702', 2, 2, 1, 65, 1714000, 'B1'),
    ('703', 2, 2, 1, 65, 1714000, 'B1'),
    ('704', 2, 1, 1, 65, 1664000, 'A1'),
    ('705', 2, 1, 1, 65, 1664000, 'A1'),
    ('706', 2, 2, 1, 75, 1814000, 'C1'),
    ('707', 2, 2, 1, 75, 1764000, 'C2'),
    ('708', 2, 2, 1, 65, 1664000, 'B2'),
    ('709', 2, 2, 1, 65, 1664000, 'B2'),
    ('710', 2, 1, 1, 65, 1614000, 'A2'),
    ('711', 2, 1, 1, 65, 1614000, 'A2'),
    ('712', 2, 2, 1, 75, 1764000, 'C2'),
    ('713', 2, 2, 1, 75, 1744000, 'C1'),
    ('714', 2, 2, 1, 65, 1644000, 'B1'),
    ('715', 2, 2, 1, 65, 1644000, 'B1'),
    ('716', 2, 1, 1, 65, 1594000, 'A1'),
    ('717', 2, 1, 1, 65, 1594000, 'A1'),
    ('718', 2, 2, 1, 75, 1744000, 'C1'),
    ('801', 2, 2, 1, 75, 1814000, 'C1'),
    ('802', 2, 1, 1, 65, 1664000, 'A1'),
    ('803', 2, 1, 1, 65, 1664000, 'A1'),
    ('804', 2, 2, 1, 65, 1714000, 'B1'),
    ('805', 2, 2, 1, 65, 1714000, 'B1'),
    ('806', 2, 2, 1, 75, 1814000, 'C1'),
    ('807', 2, 2, 1, 75, 1814000, 'C1'),
    ('808', 2, 2, 1, 65, 1714000, 'B1'),
    ('809', 2, 2, 1, 65, 1714000, 'B1'),
    ('810', 2, 1, 1, 65, 1664000, 'A1'),
    ('811', 2, 1, 1, 65, 1664000, 'A1'),
    ('812', 2, 2, 1, 75, 1814000, 'C1'),
    ('813', 2, 2, 1, 75, 1764000, 'C2'),
    ('814', 2, 1, 1, 65, 1614000, 'A2'),
    ('815', 2, 1, 1, 65, 1614000, 'A2'),
    ('816', 2, 2, 1, 65, 1664000, 'B2'),
    ('817', 2, 2, 1, 65, 1664000, 'B2'),
    ('818', 2, 2, 1, 75, 1764000, 'C2'),
    ('819', 2, 2, 1, 75, 1764000, 'C1'),
    ('820', 2, 2, 1, 65, 1664000, 'B1'),
    ('821', 2, 2, 1, 65, 1664000, 'B1'),
    ('822', 2, 1, 1, 65, 1725000, 'A1'),
    ('823', 2, 1, 1, 65, 1614000, 'A1'),
    ('824', 2, 2, 1, 75, 1764000, 'C1'),
    ('825', 2, 2, 1, 75, 1875000, 'C1'),
    ('826', 2, 1, 1, 65, 1725000, 'A1'),
    ('827', 2, 1, 1, 65, 1725000, 'A1'),
    ('828', 2, 2, 1, 65, 1775000, 'B1'),
    ('829', 2, 2, 1, 65, 1775000, 'B1'),
    ('830', 2, 2, 1, 75, 1764000, 'C1'),
    ('831', 2, 2, 1, 75, 1764000, 'C1'),
    ('832', 2, 2, 1, 65, 1775000, 'B1'),
    ('833', 2, 2, 1, 65, 1775000, 'B1'),
    ('834', 2, 1, 1, 65, 1725000, 'A1'),
    ('835', 2, 1, 1, 65, 1725000, 'A1'),
    ('836', 2, 2, 1, 75, 1764000, 'C1'),
    ('837', 2, 2, 1, 75, 1744000, 'C2'),
    ('838', 2, 1, 1, 65, 1594000, 'A2'),
    ('839', 2, 1, 1, 65, 1594000, 'A2'),
    ('840', 2, 2, 1, 65, 1644000, 'B2'),
    ('841', 2, 2, 1, 65, 1644000, 'B2'),
    ('842', 2, 2, 1, 75, 1744000, 'C2'),
    ('843', 2, 2, 1, 75, 1744000, 'C1'),
    ('844', 2, 2, 1, 65, 1644000, 'B1'),
    ('845', 2, 2, 1, 65, 1644000, 'B1'),
    ('846', 2, 1, 1, 65, 1594000, 'A1'),
    ('847', 2, 1, 1, 65, 1594000, 'A1'),
    ('848', 2, 2, 1, 75, 1744000, 'C1')
)
INSERT INTO public.units (
  unit_number,
  bedrooms,
  bathrooms,
  parking,
  size_sqm,
  price,
  status,
  unit_type,
  floor,
  direction,
  image_key_1,
  image_key_2,
  image_key_3,
  floorplan_key,
  viewers,
  lock_expires_at,
  locked_by
)
SELECT
  s.unit_number,
  s.bedrooms,
  s.bathrooms,
  s.parking,
  s.size_sqm,
  s.price,
  'Available',
  s.unit_type,
  CASE
    WHEN s.unit_number::int BETWEEN 701 AND 706 THEN 'Ground'
    WHEN s.unit_number::int BETWEEN 707 AND 712 THEN 'First'
    WHEN s.unit_number::int BETWEEN 713 AND 718 THEN 'Second'
    WHEN s.unit_number::int BETWEEN 801 AND 812 THEN 'Ground'
    WHEN s.unit_number::int BETWEEN 813 AND 824 THEN 'First'
    WHEN s.unit_number::int BETWEEN 825 AND 836 THEN 'Second'
    ELSE 'Third'
  END AS floor,
  CASE
    WHEN s.unit_number::int BETWEEN 701 AND 718 THEN 'North'
    WHEN s.unit_number::int BETWEEN 801 AND 806 THEN 'West'
    WHEN s.unit_number::int BETWEEN 807 AND 812 THEN 'East'
    WHEN s.unit_number::int BETWEEN 813 AND 818 THEN 'West'
    WHEN s.unit_number::int BETWEEN 819 AND 824 THEN 'East'
    WHEN s.unit_number::int BETWEEN 825 AND 830 THEN 'West'
    WHEN s.unit_number::int BETWEEN 831 AND 836 THEN 'East'
    WHEN s.unit_number::int BETWEEN 837 AND 842 THEN 'West'
    ELSE 'East'
  END AS direction,
  'gallery/unit_image_1.webp' AS image_key_1,
  'gallery/unit_image_2.webp' AS image_key_2,
  'gallery/unit_image_3.webp' AS image_key_3,
  CASE s.unit_type
    WHEN 'A1' THEN 'axos/type_a1.webp'
    WHEN 'A2' THEN 'axos/type_a2.webp'
    WHEN 'B1' THEN 'axos/type_b1.webp'
    WHEN 'B2' THEN 'axos/type_b2.webp'
    WHEN 'C1' THEN 'axos/type_c1.webp'
    WHEN 'C2' THEN 'axos/type_c2.webp'
    ELSE NULL
  END AS floorplan_key,
  '{}'::jsonb AS viewers,
  NULL::timestamptz AS lock_expires_at,
  NULL::uuid AS locked_by
FROM src s
ORDER BY s.unit_number::int ASC;
