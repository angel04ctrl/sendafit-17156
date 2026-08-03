WITH global_foods AS (
  SELECT f.*
  FROM public.nutrition_foods f
  WHERE f.scope = 'global'
),
aliases_agg AS (
  SELECT
    a.food_id,
    jsonb_agg(
      jsonb_build_object(
        'alias_record', to_jsonb(a),
        'alias_id', a.id,
        'food_id', a.food_id,
        'alias', a.alias,
        'normalized_alias', a.normalized_alias,
        'locale', a.locale,
        'source', a.source,
        'created_at', a.created_at
      )
      ORDER BY a.normalized_alias, a.alias, a.id
    ) AS aliases_json
  FROM public.nutrition_food_aliases a
  JOIN global_foods f ON f.id = a.food_id
  GROUP BY a.food_id
),
categories_agg AS (
  SELECT
    fc.food_id,
    string_agg(c.name, ' | ' ORDER BY fc.is_primary DESC, c.category_level, c.normalized_name)
      FILTER (WHERE c.category_level = 'category') AS category,
    string_agg(c.name, ' | ' ORDER BY c.normalized_name)
      FILTER (WHERE c.category_level = 'subcategory') AS subcategory,
    jsonb_agg(
      jsonb_build_object(
        'food_category_record', to_jsonb(fc),
        'category_record', to_jsonb(c),
        'category_id', c.id,
        'category_name', c.name,
        'normalized_name', c.normalized_name,
        'category_level', c.category_level,
        'locale', c.locale,
        'is_primary', fc.is_primary,
        'parent_id', c.parent_id
      )
      ORDER BY fc.is_primary DESC, c.category_level, c.normalized_name, c.id
    ) AS categories_json
  FROM public.nutrition_food_categories fc
  JOIN global_foods f ON f.id = fc.food_id
  JOIN public.nutrition_categories c ON c.id = fc.category_id
  GROUP BY fc.food_id
),
servings_agg AS (
  SELECT
    s.food_id,
    jsonb_agg(
      jsonb_build_object(
        'serving_record', to_jsonb(s),
        'unit_record', to_jsonb(u),
        'serving_id', s.id,
        'food_id', s.food_id,
        'unit_id', s.unit_id,
        'unit_code', u.code,
        'unit_name', u.name,
        'unit_dimension', u.dimension,
        'serving_label', s.serving_label,
        'quantity', s.quantity,
        'grams', s.grams,
        'milliliters', s.milliliters,
        'is_default', s.is_default,
        'source', s.source,
        'confidence_score', s.confidence_score
      )
      ORDER BY s.is_default DESC, s.quantity, s.serving_label, s.id
    ) AS servings_json
  FROM public.nutrition_food_servings s
  JOIN global_foods f ON f.id = s.food_id
  JOIN public.nutrition_units u ON u.id = s.unit_id
  GROUP BY s.food_id
),
default_serving AS (
  SELECT DISTINCT ON (s.food_id)
    s.food_id,
    s.quantity AS base_amount,
    u.code AS base_unit,
    s.grams AS serving_grams
  FROM public.nutrition_food_servings s
  JOIN public.nutrition_units u ON u.id = s.unit_id
  JOIN global_foods f ON f.id = s.food_id
  ORDER BY s.food_id, s.is_default DESC, s.created_at, s.id
),
nutrients_agg AS (
  SELECT
    fn.food_id,
    max(fn.amount_per_100g) FILTER (WHERE n.code = 'energy_kcal') AS calories_100g,
    max(fn.amount_per_100g) FILTER (WHERE n.code = 'protein_g') AS protein_100g,
    max(fn.amount_per_100g) FILTER (WHERE n.code = 'carbs_g') AS carbohydrates_100g,
    max(fn.amount_per_100g) FILTER (WHERE n.code = 'fat_g') AS fat_100g,
    max(fn.amount_per_100g) FILTER (WHERE n.code = 'fiber_g') AS fiber_100g,
    max(fn.amount_per_100g) FILTER (WHERE n.code = 'sugar_g') AS sugars_100g,
    max(fn.amount_per_100g) FILTER (WHERE n.code = 'sodium_mg') AS sodium_mg_100g,
    jsonb_agg(
      jsonb_build_object(
        'food_nutrient_record', to_jsonb(fn),
        'nutrient_record', to_jsonb(n),
        'source_record', to_jsonb(src),
        'food_nutrient_id', fn.id,
        'food_id', fn.food_id,
        'nutrient_id', fn.nutrient_id,
        'nutrient_code', n.code,
        'nutrient_name', n.name,
        'nutrient_group', n.nutrient_group,
        'amount', fn.amount_per_100g,
        'unit', n.unit,
        'basis_amount', 100,
        'basis_unit', 'g',
        'source_id', fn.source_id,
        'source_code', src.code,
        'confidence_score', fn.confidence_score,
        'is_verified', fn.is_verified,
        'updated_at', fn.updated_at
      )
      ORDER BY n.display_order, n.code, fn.id
    ) AS nutrients_json
  FROM public.nutrition_food_nutrients fn
  JOIN global_foods f ON f.id = fn.food_id
  JOIN public.nutrition_nutrients n ON n.id = fn.nutrient_id
  LEFT JOIN public.nutrition_sources src ON src.id = fn.source_id
  GROUP BY fn.food_id
),
barcodes_agg AS (
  SELECT
    b.food_id,
    jsonb_agg(
      jsonb_build_object(
        'barcode_record', to_jsonb(b),
        'barcode_id', b.id,
        'food_id', b.food_id,
        'barcode', b.barcode,
        'symbology', b.symbology,
        'created_at', b.created_at
      )
      ORDER BY b.barcode, b.id
    ) AS barcodes_json
  FROM public.nutrition_barcodes b
  JOIN global_foods f ON f.id = b.food_id
  GROUP BY b.food_id
),
preparations_agg AS (
  SELECT
    food_id,
    jsonb_agg(preparation_json ORDER BY direction, related_food_name, preparation_state, preparation_id) AS preparations_json
  FROM (
    SELECT
      p.base_food_id AS food_id,
      'base_to_prepared' AS direction,
      p.id AS preparation_id,
      p.preparation_state,
      prepared.display_name AS related_food_name,
      jsonb_build_object(
        'preparation_record', to_jsonb(p),
        'direction', 'base_to_prepared',
        'base_food_id', p.base_food_id,
        'base_food_name', base.display_name,
        'prepared_food_id', p.prepared_food_id,
        'prepared_food_name', prepared.display_name,
        'preparation_state', p.preparation_state,
        'yield_factor', p.yield_factor,
        'notes', p.notes
      ) AS preparation_json
    FROM public.nutrition_food_preparations p
    JOIN global_foods base ON base.id = p.base_food_id
    JOIN global_foods prepared ON prepared.id = p.prepared_food_id
    UNION ALL
    SELECT
      p.prepared_food_id AS food_id,
      'prepared_from_base' AS direction,
      p.id AS preparation_id,
      p.preparation_state,
      base.display_name AS related_food_name,
      jsonb_build_object(
        'preparation_record', to_jsonb(p),
        'direction', 'prepared_from_base',
        'base_food_id', p.base_food_id,
        'base_food_name', base.display_name,
        'prepared_food_id', p.prepared_food_id,
        'prepared_food_name', prepared.display_name,
        'preparation_state', p.preparation_state,
        'yield_factor', p.yield_factor,
        'notes', p.notes
      ) AS preparation_json
    FROM public.nutrition_food_preparations p
    JOIN global_foods base ON base.id = p.base_food_id
    JOIN global_foods prepared ON prepared.id = p.prepared_food_id
  ) p
  GROUP BY food_id
),
substitutions_agg AS (
  SELECT
    food_id,
    jsonb_agg(substitution_json ORDER BY direction, related_food_name, substitution_id) AS substitutions_json
  FROM (
    SELECT
      s.original_food_id AS food_id,
      'original_to_substitute' AS direction,
      s.id AS substitution_id,
      substitute.display_name AS related_food_name,
      jsonb_build_object(
        'substitution_record', to_jsonb(s),
        'direction', 'original_to_substitute',
        'original_food_id', s.original_food_id,
        'original_food_name', original.display_name,
        'substitute_food_id', s.substitute_food_id,
        'substitute_food_name', substitute.display_name,
        'reason', s.reason,
        'context', s.context,
        'score', s.score
      ) AS substitution_json
    FROM public.nutrition_ingredient_substitutions s
    JOIN global_foods original ON original.id = s.original_food_id
    JOIN global_foods substitute ON substitute.id = s.substitute_food_id
    UNION ALL
    SELECT
      s.substitute_food_id AS food_id,
      'substitute_for_original' AS direction,
      s.id AS substitution_id,
      original.display_name AS related_food_name,
      jsonb_build_object(
        'substitution_record', to_jsonb(s),
        'direction', 'substitute_for_original',
        'original_food_id', s.original_food_id,
        'original_food_name', original.display_name,
        'substitute_food_id', s.substitute_food_id,
        'substitute_food_name', substitute.display_name,
        'reason', s.reason,
        'context', s.context,
        'score', s.score
      ) AS substitution_json
    FROM public.nutrition_ingredient_substitutions s
    JOIN global_foods original ON original.id = s.original_food_id
    JOIN global_foods substitute ON substitute.id = s.substitute_food_id
  ) s
  GROUP BY food_id
),
source_rows AS (
  SELECT DISTINCT
    f.id AS food_id,
    src.id,
    src.code,
    src.name,
    to_jsonb(src) AS source_record
  FROM global_foods f
  JOIN public.nutrition_sources src ON src.id = f.source_id
  UNION
  SELECT DISTINCT
    fn.food_id,
    src.id,
    src.code,
    src.name,
    to_jsonb(src) AS source_record
  FROM public.nutrition_food_nutrients fn
  JOIN global_foods f ON f.id = fn.food_id
  JOIN public.nutrition_sources src ON src.id = fn.source_id
),
sources_agg AS (
  SELECT
    food_id,
    jsonb_agg(
      jsonb_build_object(
        'source_record', source_record,
        'source_id', id,
        'source_code', code,
        'source_name', name
      )
      ORDER BY code, id
    ) AS sources_json
  FROM source_rows
  GROUP BY food_id
),
external_references AS (
  SELECT
    f.id AS food_id,
    jsonb_agg(ref_json ORDER BY ref_type, ref_value) AS external_references_json
  FROM global_foods f
  CROSS JOIN LATERAL (
    SELECT 'source_external_id' AS ref_type, f.source_external_id AS ref_value
    WHERE f.source_external_id IS NOT NULL
    UNION ALL
    SELECT 'source_url', f.metadata ->> 'source_url'
    WHERE f.metadata ? 'source_url'
    UNION ALL
    SELECT 'source_version', f.metadata ->> 'source_version'
    WHERE f.metadata ? 'source_version'
    UNION ALL
    SELECT 'source_license', f.metadata ->> 'source_license'
    WHERE f.metadata ? 'source_license'
  ) ref
  CROSS JOIN LATERAL (
    SELECT jsonb_build_object(
      'type', ref.ref_type,
      'value', ref.ref_value,
      'food_id', f.id,
      'source_id', f.source_id
    ) AS ref_json
  ) built_ref
  GROUP BY f.id
),
brand_rows AS (
  SELECT
    f.id AS food_id,
    CASE
      WHEN b.id IS NULL THEN NULL::jsonb
      ELSE jsonb_build_object(
        'brand_record', to_jsonb(b),
        'brand_id', b.id,
        'brand_name', b.name,
        'normalized_name', b.normalized_name,
        'brand_type', b.brand_type,
        'country_code', b.country_code,
        'website_url', b.website_url
      )
    END AS brand_json,
    b.name AS brand_name
  FROM global_foods f
  LEFT JOIN public.nutrition_brands b ON b.id = f.brand_id
),
reference_catalog AS (
  SELECT jsonb_build_object(
    'sources', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.code, s.id) FROM public.nutrition_sources s), '[]'::jsonb),
    'brands', COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.normalized_name, b.id) FROM public.nutrition_brands b), '[]'::jsonb),
    'categories', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.category_level, c.normalized_name, c.id) FROM public.nutrition_categories c), '[]'::jsonb),
    'units', COALESCE((SELECT jsonb_agg(to_jsonb(u) ORDER BY u.dimension, u.code, u.id) FROM public.nutrition_units u), '[]'::jsonb),
    'nutrients', COALESCE((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.display_order, n.code, n.id) FROM public.nutrition_nutrients n), '[]'::jsonb),
    'food_kinds', COALESCE((SELECT jsonb_agg(DISTINCT f.food_kind ORDER BY f.food_kind) FROM public.nutrition_foods f), '[]'::jsonb),
    'scopes', COALESCE((SELECT jsonb_agg(DISTINCT f.scope ORDER BY f.scope) FROM public.nutrition_foods f), '[]'::jsonb),
    'preparation_states', COALESCE((SELECT jsonb_agg(DISTINCT f.preparation_state ORDER BY f.preparation_state) FROM public.nutrition_foods f WHERE f.preparation_state IS NOT NULL), '[]'::jsonb)
  ) AS reference_catalog_json
),
orphan_catalog_records AS (
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'aliases', COALESCE((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.normalized_alias, a.id)
      FROM public.nutrition_food_aliases a
      LEFT JOIN public.nutrition_foods f ON f.id = a.food_id
      WHERE f.id IS NULL
    ), '[]'::jsonb),
    'servings', COALESCE((
      SELECT jsonb_agg(to_jsonb(s) ORDER BY s.serving_label, s.id)
      FROM public.nutrition_food_servings s
      LEFT JOIN public.nutrition_foods f ON f.id = s.food_id
      WHERE f.id IS NULL
    ), '[]'::jsonb),
    'food_nutrients', COALESCE((
      SELECT jsonb_agg(to_jsonb(fn) ORDER BY fn.id)
      FROM public.nutrition_food_nutrients fn
      LEFT JOIN public.nutrition_foods f ON f.id = fn.food_id
      WHERE f.id IS NULL
    ), '[]'::jsonb),
    'food_categories', COALESCE((
      SELECT jsonb_agg(to_jsonb(fc) ORDER BY fc.food_id, fc.category_id)
      FROM public.nutrition_food_categories fc
      LEFT JOIN public.nutrition_foods f ON f.id = fc.food_id
      LEFT JOIN public.nutrition_categories c ON c.id = fc.category_id
      WHERE f.id IS NULL OR c.id IS NULL
    ), '[]'::jsonb),
    'barcodes', COALESCE((
      SELECT jsonb_agg(to_jsonb(b) ORDER BY b.barcode, b.id)
      FROM public.nutrition_barcodes b
      LEFT JOIN public.nutrition_foods f ON f.id = b.food_id
      WHERE f.id IS NULL
    ), '[]'::jsonb),
    'food_preparations', COALESCE((
      SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id)
      FROM public.nutrition_food_preparations p
      LEFT JOIN public.nutrition_foods base_food ON base_food.id = p.base_food_id
      LEFT JOIN public.nutrition_foods prepared_food ON prepared_food.id = p.prepared_food_id
      WHERE base_food.id IS NULL OR prepared_food.id IS NULL
    ), '[]'::jsonb),
    'ingredient_substitutions', COALESCE((
      SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id)
      FROM public.nutrition_ingredient_substitutions s
      LEFT JOIN public.nutrition_foods original_food ON original_food.id = s.original_food_id
      LEFT JOIN public.nutrition_foods substitute_food ON substitute_food.id = s.substitute_food_id
      WHERE original_food.id IS NULL OR substitute_food.id IS NULL
    ), '[]'::jsonb)
  )) AS orphan_catalog_records_json
),
audit_base AS (
  SELECT
    f.id AS food_id,
    (a.aliases_json IS NOT NULL AND jsonb_array_length(a.aliases_json) > 0) AS audit_has_aliases,
    (c.categories_json IS NOT NULL AND jsonb_array_length(c.categories_json) > 0) AS audit_has_category,
    (NULLIF(btrim(COALESCE(f.description, '')), '') IS NOT NULL) AS audit_has_description,
    (sv.servings_json IS NOT NULL AND jsonb_array_length(sv.servings_json) > 0) AS audit_has_servings,
    (src.sources_json IS NOT NULL AND jsonb_array_length(src.sources_json) > 0) AS audit_has_source,
    (n.calories_100g IS NOT NULL) AS audit_has_calories,
    (n.protein_100g IS NOT NULL) AS audit_has_protein,
    (n.carbohydrates_100g IS NOT NULL) AS audit_has_carbohydrates,
    (n.fat_100g IS NOT NULL) AS audit_has_fat,
    (n.protein_100g * 4 + n.carbohydrates_100g * 4 + n.fat_100g * 9) AS audit_macro_energy_calculated,
    CASE
      WHEN n.calories_100g IS NULL THEN NULL
      ELSE n.calories_100g - (COALESCE(n.protein_100g, 0) * 4 + COALESCE(n.carbohydrates_100g, 0) * 4 + COALESCE(n.fat_100g, 0) * 9)
    END AS audit_macro_energy_difference,
    f.normalized_name AS audit_possible_duplicate_key,
    COUNT(*) OVER (PARTITION BY f.normalized_name) AS duplicate_name_count
  FROM global_foods f
  LEFT JOIN aliases_agg a ON a.food_id = f.id
  LEFT JOIN categories_agg c ON c.food_id = f.id
  LEFT JOIN servings_agg sv ON sv.food_id = f.id
  LEFT JOIN nutrients_agg n ON n.food_id = f.id
  LEFT JOIN sources_agg src ON src.food_id = f.id
),
audit_final AS (
  SELECT
    ab.*,
    (ab.audit_has_calories AND ab.audit_has_protein AND ab.audit_has_carbohydrates AND ab.audit_has_fat) AS audit_has_complete_macros,
    to_jsonb(array_remove(ARRAY[
      CASE WHEN NOT ab.audit_has_aliases THEN 'missing_aliases' END,
      CASE WHEN NOT ab.audit_has_category THEN 'missing_category' END,
      CASE WHEN NOT ab.audit_has_description THEN 'missing_description' END,
      CASE WHEN NOT ab.audit_has_servings THEN 'missing_servings' END,
      CASE WHEN NOT ab.audit_has_source THEN 'missing_source' END,
      CASE WHEN NOT ab.audit_has_calories THEN 'missing_calories' END,
      CASE WHEN NOT ab.audit_has_protein THEN 'missing_protein' END,
      CASE WHEN NOT ab.audit_has_carbohydrates THEN 'missing_carbohydrates' END,
      CASE WHEN NOT ab.audit_has_fat THEN 'missing_fat' END,
      CASE WHEN ab.duplicate_name_count > 1 THEN 'possible_duplicate_normalized_name' END,
      CASE WHEN ab.audit_macro_energy_difference IS NOT NULL AND abs(ab.audit_macro_energy_difference) > 20 THEN 'macro_energy_mismatch_gt_20_kcal' END
    ], NULL)) AS audit_review_reasons
  FROM audit_base ab
),
ranked_foods AS (
  SELECT
    f.*,
    row_number() OVER (ORDER BY f.normalized_name, f.display_name, f.id) AS export_row_number,
    count(*) OVER () AS export_total_foods
  FROM global_foods f
)
SELECT
  rf.export_row_number,
  rf.export_total_foods,
  rf.id AS food_id,
  rf.legacy_food_id,
  rf.canonical_name,
  rf.display_name,
  rf.normalized_name,
  rf.description,
  rf.food_kind AS food_type,
  rf.scope,
  br.brand_name,
  br.brand_json,
  ca.category,
  ca.subcategory,
  rf.preparation_state AS preparation,
  ds.base_amount,
  ds.base_unit,
  ds.serving_grams,
  nu.calories_100g,
  nu.protein_100g,
  nu.carbohydrates_100g,
  nu.fat_100g,
  nu.fiber_100g,
  nu.sugars_100g,
  nu.sodium_mg_100g,
  primary_source.code AS source_code,
  rf.source_external_id,
  CASE WHEN rf.is_verified THEN 'verified' ELSE 'not_verified' END AS verification_status,
  rf.locale,
  rf.confidence_score,
  rf.is_visible,
  rf.is_common,
  rf.visibility_priority,
  COALESCE(al.aliases_json, '[]'::jsonb) AS aliases_json,
  COALESCE(ca.categories_json, '[]'::jsonb) AS categories_json,
  COALESCE(pr.preparations_json, '[]'::jsonb) AS preparations_json,
  COALESCE(se.servings_json, '[]'::jsonb) AS servings_json,
  COALESCE(nu.nutrients_json, '[]'::jsonb) AS nutrients_json,
  COALESCE(so.sources_json, '[]'::jsonb) AS sources_json,
  COALESCE(er.external_references_json, '[]'::jsonb) AS external_references_json,
  COALESCE(ba.barcodes_json, '[]'::jsonb) AS barcodes_json,
  COALESCE(su.substitutions_json, '[]'::jsonb) AS substitutions_json,
  to_jsonb(rf) - 'export_row_number' - 'export_total_foods' AS food_record_json,
  CASE WHEN rf.export_row_number = 1 THEN rc.reference_catalog_json ELSE NULL::jsonb END AS reference_catalog_json,
  CASE WHEN rf.export_row_number = 1 THEN oc.orphan_catalog_records_json ELSE NULL::jsonb END AS orphan_catalog_records_json,
  af.audit_has_aliases,
  af.audit_has_category,
  af.audit_has_description,
  af.audit_has_servings,
  af.audit_has_source,
  af.audit_has_calories,
  af.audit_has_protein,
  af.audit_has_carbohydrates,
  af.audit_has_fat,
  af.audit_has_complete_macros,
  af.audit_possible_duplicate_key,
  af.audit_macro_energy_calculated,
  af.audit_macro_energy_difference,
  (jsonb_array_length(af.audit_review_reasons) > 0) AS audit_needs_review,
  af.audit_review_reasons,
  rf.created_at,
  rf.updated_at
FROM ranked_foods rf
LEFT JOIN aliases_agg al ON al.food_id = rf.id
LEFT JOIN categories_agg ca ON ca.food_id = rf.id
LEFT JOIN servings_agg se ON se.food_id = rf.id
LEFT JOIN default_serving ds ON ds.food_id = rf.id
LEFT JOIN nutrients_agg nu ON nu.food_id = rf.id
LEFT JOIN barcodes_agg ba ON ba.food_id = rf.id
LEFT JOIN preparations_agg pr ON pr.food_id = rf.id
LEFT JOIN substitutions_agg su ON su.food_id = rf.id
LEFT JOIN sources_agg so ON so.food_id = rf.id
LEFT JOIN external_references er ON er.food_id = rf.id
LEFT JOIN brand_rows br ON br.food_id = rf.id
LEFT JOIN public.nutrition_sources primary_source ON primary_source.id = rf.source_id
LEFT JOIN audit_final af ON af.food_id = rf.id
CROSS JOIN reference_catalog rc
CROSS JOIN orphan_catalog_records oc
ORDER BY rf.normalized_name, rf.display_name, rf.id;
