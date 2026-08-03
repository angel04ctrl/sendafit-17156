-- Beta Nutrition - Validacion de correccion arquitectonica.
-- Ejecutar despues de docs/beta-food-architecture-correction.sql.
-- Esperado: 0 filas critical.

WITH expected_tables AS (
  SELECT unnest(ARRAY[
    'nutrition_physical_states',
    'nutrition_preparation_methods',
    'nutrition_canonical_food_groups',
    'nutrition_food_group_members',
    'nutrition_food_relationships'
  ]) AS table_name
),
valid_food_kinds AS (
  SELECT unnest(ARRAY[
    'ingredient',
    'prepared_variant',
    'component',
    'composite_food',
    'recipe',
    'branded_product',
    'restaurant_item',
    'supplement',
    'beverage',
    'unclassified',
    'generic',
    'branded',
    'restaurant',
    'user_custom',
    'ai_estimated'
  ]) AS value
),
valid_verification_status AS (
  SELECT unnest(ARRAY[
    'unverified',
    'needs_review',
    'partially_verified',
    'verified',
    'rejected',
    'deprecated'
  ]) AS value
),
valid_relationship_types AS (
  SELECT unnest(ARRAY[
    'variant_of',
    'preparation_of',
    'component_of',
    'part_of',
    'derived_from',
    'cut_of',
    'equivalent_to',
    'related_to'
  ]) AS value
),
required_units AS (
  SELECT unnest(ARRAY[
    'mg', 'g', 'kg', 'oz', 'lb',
    'ml', 'l', 'tsp', 'tbsp', 'cup', 'fl_oz',
    'piece', 'unit', 'slice', 'scoop', 'package', 'can', 'bottle'
  ]) AS code
),
required_physical_states AS (
  SELECT unnest(ARRAY[
    'raw', 'cooked', 'dried', 'frozen', 'canned', 'drained', 'ready_to_eat', 'unknown'
  ]) AS code
),
required_preparation_methods AS (
  SELECT unnest(ARRAY[
    'none', 'boiled', 'steamed', 'grilled', 'roasted', 'baked', 'pan_seared',
    'fried', 'air_fried', 'poached', 'scrambled', 'microwaved', 'unknown'
  ]) AS code
)
SELECT 'critical' AS severity, 'missing_architecture_table' AS check_name,
       table_name AS entity, NULL::text AS details
FROM expected_tables
WHERE to_regclass('public.' || table_name) IS NULL

UNION ALL
SELECT 'critical', 'nutrition_food_count_changed',
       'nutrition_foods',
       COUNT(*)::text
FROM public.nutrition_foods
HAVING COUNT(*) <> 169

UNION ALL
SELECT 'critical', 'nutrition_food_nutrient_count_changed',
       'nutrition_food_nutrients',
       COUNT(*)::text
FROM public.nutrition_food_nutrients
HAVING COUNT(*) <> 892

UNION ALL
SELECT 'critical', 'invalid_food_kind',
       'nutrition_foods',
       CONCAT(id, ': ', food_kind)
FROM public.nutrition_foods
WHERE food_kind NOT IN (SELECT value FROM valid_food_kinds)

UNION ALL
SELECT 'critical', 'invalid_food_verification_status',
       'nutrition_foods',
       CONCAT(id, ': ', verification_status)
FROM public.nutrition_foods
WHERE verification_status NOT IN (SELECT value FROM valid_verification_status)

UNION ALL
SELECT 'critical', 'invalid_serving_verification_status',
       'nutrition_food_servings',
       CONCAT(id, ': ', verification_status)
FROM public.nutrition_food_servings
WHERE verification_status NOT IN (SELECT value FROM valid_verification_status)

UNION ALL
SELECT 'critical', 'invalid_nutrient_verification_status',
       'nutrition_food_nutrients',
       CONCAT(id, ': ', verification_status)
FROM public.nutrition_food_nutrients
WHERE verification_status NOT IN (SELECT value FROM valid_verification_status)

UNION ALL
SELECT 'critical', 'missing_required_unit',
       'nutrition_units',
       code
FROM required_units ru
WHERE NOT EXISTS (
  SELECT 1 FROM public.nutrition_units u WHERE u.code = ru.code
)

UNION ALL
SELECT 'critical', 'missing_required_physical_state',
       'nutrition_physical_states',
       code
FROM required_physical_states rs
WHERE NOT EXISTS (
  SELECT 1 FROM public.nutrition_physical_states s WHERE s.code = rs.code
)

UNION ALL
SELECT 'critical', 'missing_required_preparation_method',
       'nutrition_preparation_methods',
       code
FROM required_preparation_methods rm
WHERE NOT EXISTS (
  SELECT 1 FROM public.nutrition_preparation_methods m WHERE m.code = rm.code
)

UNION ALL
SELECT 'critical', 'orphan_group_default_food',
       'nutrition_canonical_food_groups',
       CONCAT(id, ': ', default_food_id)
FROM public.nutrition_canonical_food_groups g
WHERE default_food_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.nutrition_foods f WHERE f.id = g.default_food_id
  )

UNION ALL
SELECT 'critical', 'orphan_group_member_group',
       'nutrition_food_group_members',
       CONCAT(id, ': ', group_id)
FROM public.nutrition_food_group_members m
WHERE NOT EXISTS (
  SELECT 1 FROM public.nutrition_canonical_food_groups g WHERE g.id = m.group_id
)

UNION ALL
SELECT 'critical', 'orphan_group_member_food',
       'nutrition_food_group_members',
       CONCAT(id, ': ', food_id)
FROM public.nutrition_food_group_members m
WHERE NOT EXISTS (
  SELECT 1 FROM public.nutrition_foods f WHERE f.id = m.food_id
)

UNION ALL
SELECT 'critical', 'invalid_group_member_variant_type',
       'nutrition_food_group_members',
       CONCAT(id, ': ', variant_type)
FROM public.nutrition_food_group_members
WHERE variant_type NOT IN (
  'ingredient',
  'prepared_variant',
  'component',
  'composite_food',
  'recipe',
  'branded_product',
  'restaurant_item',
  'supplement',
  'beverage',
  'unclassified',
  'legacy_generic'
)

UNION ALL
SELECT 'critical', 'duplicate_group_member_food',
       'nutrition_food_group_members',
       CONCAT(food_id, ': count=', COUNT(*))
FROM public.nutrition_food_group_members
GROUP BY food_id
HAVING COUNT(*) > 1

UNION ALL
SELECT 'critical', 'duplicate_group_default',
       'nutrition_food_group_members',
       CONCAT(group_id, ': count=', COUNT(*))
FROM public.nutrition_food_group_members
WHERE is_default IS TRUE
GROUP BY group_id
HAVING COUNT(*) > 1

UNION ALL
SELECT 'critical', 'orphan_relationship_parent',
       'nutrition_food_relationships',
       CONCAT(id, ': ', parent_food_id)
FROM public.nutrition_food_relationships r
WHERE NOT EXISTS (
  SELECT 1 FROM public.nutrition_foods f WHERE f.id = r.parent_food_id
)

UNION ALL
SELECT 'critical', 'orphan_relationship_child',
       'nutrition_food_relationships',
       CONCAT(id, ': ', child_food_id)
FROM public.nutrition_food_relationships r
WHERE NOT EXISTS (
  SELECT 1 FROM public.nutrition_foods f WHERE f.id = r.child_food_id
)

UNION ALL
SELECT 'critical', 'invalid_relationship_type',
       'nutrition_food_relationships',
       CONCAT(id, ': ', relationship_type)
FROM public.nutrition_food_relationships
WHERE relationship_type NOT IN (SELECT value FROM valid_relationship_types)

UNION ALL
SELECT 'critical', 'self_relationship',
       'nutrition_food_relationships',
       id::text
FROM public.nutrition_food_relationships
WHERE parent_food_id = child_food_id

UNION ALL
SELECT 'warning', 'legacy_generic_foods_still_unclassified',
       'nutrition_foods',
       COUNT(*)::text
FROM public.nutrition_foods
WHERE food_kind = 'generic'
HAVING COUNT(*) > 0

UNION ALL
SELECT 'warning', 'foods_without_canonical_group',
       'nutrition_foods',
       COUNT(*)::text
FROM public.nutrition_foods f
WHERE NOT EXISTS (
  SELECT 1 FROM public.nutrition_food_group_members m WHERE m.food_id = f.id
)
HAVING COUNT(*) > 0

UNION ALL
SELECT 'warning', 'serving_unit_generic_serving',
       'nutrition_food_servings',
       COUNT(*)::text
FROM public.nutrition_food_servings s
JOIN public.nutrition_units u ON u.id = s.unit_id
WHERE u.code = 'serving'
HAVING COUNT(*) > 0

UNION ALL
SELECT 'info', 'nutrition_food_count',
       'nutrition_foods',
       COUNT(*)::text
FROM public.nutrition_foods

UNION ALL
SELECT 'info', 'nutrition_food_nutrient_count',
       'nutrition_food_nutrients',
       COUNT(*)::text
FROM public.nutrition_food_nutrients

UNION ALL
SELECT 'info', 'canonical_group_count',
       'nutrition_canonical_food_groups',
       COUNT(*)::text
FROM public.nutrition_canonical_food_groups

UNION ALL
SELECT 'info', 'food_relationship_count',
       'nutrition_food_relationships',
       COUNT(*)::text
FROM public.nutrition_food_relationships

ORDER BY severity, check_name, entity;
