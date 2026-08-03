-- Nutrition import v2.1 - pre-import database validation.
-- Run before apply if you want an independent SQL check.
-- Expected approval signal: 0 rows where severity = 'critical'.

WITH required_tables AS (
  SELECT unnest(ARRAY[
    'nutrition_sources',
    'nutrition_brands',
    'nutrition_categories',
    'nutrition_units',
    'nutrition_nutrients',
    'nutrition_foods',
    'nutrition_food_aliases',
    'nutrition_food_categories',
    'nutrition_food_servings',
    'nutrition_food_nutrients',
    'nutrition_barcodes',
    'nutrition_food_preparations',
    'nutrition_physical_states',
    'nutrition_preparation_methods',
    'nutrition_canonical_food_groups',
    'nutrition_food_group_members',
    'nutrition_food_relationships'
  ]) AS table_name
),
required_columns AS (
  SELECT * FROM (VALUES
    ('nutrition_foods', 'verification_status'),
    ('nutrition_foods', 'physical_state_id'),
    ('nutrition_foods', 'preparation_method_id'),
    ('nutrition_food_servings', 'verification_status'),
    ('nutrition_food_nutrients', 'verification_status'),
    ('nutrition_canonical_food_groups', 'client_key')
  ) AS c(table_name, column_name)
)
SELECT 'critical' AS severity, 'missing_required_table' AS check_name,
       table_name AS expected_value, NULL::text AS actual_value,
       false AS passed, table_name AS details
FROM required_tables
WHERE to_regclass('public.' || table_name) IS NULL

UNION ALL
SELECT 'critical', 'missing_required_column',
       rc.table_name || '.' || rc.column_name, NULL::text,
       false, rc.table_name || '.' || rc.column_name
FROM required_columns rc
WHERE NOT EXISTS (
  SELECT 1
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = rc.table_name
    AND c.column_name = rc.column_name
)

UNION ALL
SELECT 'critical', 'server_encoding_not_utf8',
       'UTF8', current_setting('server_encoding'),
       current_setting('server_encoding') = 'UTF8',
       current_setting('server_encoding')
WHERE current_setting('server_encoding') <> 'UTF8'

UNION ALL
SELECT 'critical', 'client_encoding_not_utf8',
       'UTF8', current_setting('client_encoding'),
       current_setting('client_encoding') = 'UTF8',
       current_setting('client_encoding')
WHERE current_setting('client_encoding') <> 'UTF8'

UNION ALL
SELECT 'info', 'current_catalog_food_count',
       NULL::text, COUNT(*)::text, true, COUNT(*)::text
FROM public.nutrition_foods

UNION ALL
SELECT 'info', 'current_catalog_nutrient_count',
       NULL::text, COUNT(*)::text, true, COUNT(*)::text
FROM public.nutrition_food_nutrients

ORDER BY severity, check_name, details;
