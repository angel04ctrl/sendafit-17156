-- Nutrition import v2.1 - pre-import catalog backup.
-- Creates one immutable catalog snapshot table. Does not include user meal logs,
-- goals, AI logs, favorites, shopping lists or legacy tables.

BEGIN;

CREATE TABLE IF NOT EXISTS public.nutrition_catalog_backup_v2_1_20260803 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_name text NOT NULL DEFAULT 'nutrition_catalog_backup_v2_1_20260803',
  table_name text NOT NULL,
  entity_id text NOT NULL,
  row_data jsonb NOT NULL,
  row_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (backup_name, table_name, entity_id)
);

INSERT INTO public.nutrition_catalog_backup_v2_1_20260803 (table_name, entity_id, row_data, row_sha256)
SELECT table_name, entity_id, row_data, encode(sha256(row_data::text::bytea), 'hex')
FROM (
  SELECT 'nutrition_sources' AS table_name, id::text AS entity_id, to_jsonb(t) AS row_data FROM public.nutrition_sources t
  UNION ALL SELECT 'nutrition_brands', id::text, to_jsonb(t) FROM public.nutrition_brands t
  UNION ALL SELECT 'nutrition_categories', id::text, to_jsonb(t) FROM public.nutrition_categories t
  UNION ALL SELECT 'nutrition_units', id::text, to_jsonb(t) FROM public.nutrition_units t
  UNION ALL SELECT 'nutrition_nutrients', id::text, to_jsonb(t) FROM public.nutrition_nutrients t
  UNION ALL SELECT 'nutrition_foods', id::text, to_jsonb(t) FROM public.nutrition_foods t
  UNION ALL SELECT 'nutrition_food_aliases', id::text, to_jsonb(t) FROM public.nutrition_food_aliases t
  UNION ALL SELECT 'nutrition_food_categories', food_id::text || ':' || category_id::text, to_jsonb(t) FROM public.nutrition_food_categories t
  UNION ALL SELECT 'nutrition_food_servings', id::text, to_jsonb(t) FROM public.nutrition_food_servings t
  UNION ALL SELECT 'nutrition_food_nutrients', id::text, to_jsonb(t) FROM public.nutrition_food_nutrients t
  UNION ALL SELECT 'nutrition_barcodes', id::text, to_jsonb(t) FROM public.nutrition_barcodes t
  UNION ALL SELECT 'nutrition_food_preparations', id::text, to_jsonb(t) FROM public.nutrition_food_preparations t
  UNION ALL SELECT 'nutrition_physical_states', id::text, to_jsonb(t) FROM public.nutrition_physical_states t
  UNION ALL SELECT 'nutrition_preparation_methods', id::text, to_jsonb(t) FROM public.nutrition_preparation_methods t
  UNION ALL SELECT 'nutrition_canonical_food_groups', id::text, to_jsonb(t) FROM public.nutrition_canonical_food_groups t
  UNION ALL SELECT 'nutrition_food_group_members', id::text, to_jsonb(t) FROM public.nutrition_food_group_members t
  UNION ALL SELECT 'nutrition_food_relationships', id::text, to_jsonb(t) FROM public.nutrition_food_relationships t
) snapshot
ON CONFLICT (backup_name, table_name, entity_id) DO NOTHING;

COMMIT;

SELECT
  backup_name,
  table_name,
  COUNT(*) AS rows_backed_up,
  MIN(created_at) AS created_at
FROM public.nutrition_catalog_backup_v2_1_20260803
GROUP BY backup_name, table_name
ORDER BY table_name;
