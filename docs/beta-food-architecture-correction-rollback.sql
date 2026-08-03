-- Beta Nutrition - Rollback de correccion arquitectonica dirigida.
-- Revierte solo esta correccion. No elimina la arquitectura nutrition_* original.

BEGIN;

DROP POLICY IF EXISTS "Nutrition food relationships read" ON public.nutrition_food_relationships;
DROP POLICY IF EXISTS "Nutrition group members read" ON public.nutrition_food_group_members;
DROP POLICY IF EXISTS "Nutrition canonical groups read" ON public.nutrition_canonical_food_groups;
DROP POLICY IF EXISTS "Nutrition preparation methods read" ON public.nutrition_preparation_methods;
DROP POLICY IF EXISTS "Nutrition physical states read" ON public.nutrition_physical_states;

DROP TABLE IF EXISTS public.nutrition_food_relationships;
DROP TABLE IF EXISTS public.nutrition_food_group_members;
DROP TABLE IF EXISTS public.nutrition_canonical_food_groups;

ALTER TABLE public.nutrition_foods
  DROP CONSTRAINT IF EXISTS nutrition_foods_kind_check,
  DROP CONSTRAINT IF EXISTS nutrition_foods_verification_status_check;

ALTER TABLE public.nutrition_foods
  ADD CONSTRAINT nutrition_foods_kind_check
  CHECK (food_kind IN ('generic', 'branded', 'restaurant', 'recipe', 'user_custom', 'ai_estimated'));

ALTER TABLE public.nutrition_food_servings
  DROP CONSTRAINT IF EXISTS nutrition_food_servings_verification_status_check;

ALTER TABLE public.nutrition_food_nutrients
  DROP CONSTRAINT IF EXISTS nutrition_food_nutrients_verification_status_check;

ALTER TABLE public.nutrition_foods
  DROP COLUMN IF EXISTS verification_status,
  DROP COLUMN IF EXISTS physical_state_id,
  DROP COLUMN IF EXISTS preparation_method_id;

ALTER TABLE public.nutrition_food_servings
  DROP COLUMN IF EXISTS verification_status;

ALTER TABLE public.nutrition_food_nutrients
  DROP COLUMN IF EXISTS verification_status;

DROP TABLE IF EXISTS public.nutrition_preparation_methods;
DROP TABLE IF EXISTS public.nutrition_physical_states;

DELETE FROM public.nutrition_units u
WHERE u.code IN ('oz', 'lb', 'fl_oz', 'slice', 'package', 'can', 'bottle')
  AND NOT EXISTS (
    SELECT 1
    FROM public.nutrition_food_servings s
    WHERE s.unit_id = u.id
  );

DELETE FROM public.nutrition_categories c
WHERE c.normalized_name IN (
    'huevos',
    'carnes y aves',
    'pescados y mariscos',
    'lacteos',
    'cereales y granos',
    'panes y tortillas',
    'legumbres',
    'frutas',
    'verduras',
    'tuberculos',
    'frutos secos y semillas',
    'aceites y grasas',
    'bebidas',
    'condimentos',
    'suplementos',
    'comidas preparadas',
    'productos comerciales',
    'restaurantes'
  )
  AND c.metadata ->> 'source' = 'architecture_correction_base_taxonomy'
  AND NOT EXISTS (
    SELECT 1
    FROM public.nutrition_food_categories fc
    WHERE fc.category_id = c.id
  );

COMMIT;

-- Verificacion rapida: debe devolver 0 filas para tablas nuevas.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'nutrition_physical_states',
    'nutrition_preparation_methods',
    'nutrition_canonical_food_groups',
    'nutrition_food_group_members',
    'nutrition_food_relationships'
  )
ORDER BY table_name;
