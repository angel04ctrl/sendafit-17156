-- Sprint 5.1: nutrition food source metadata and ingredient-level meal tracking.
-- Safe compatibility migration: keeps the existing Spanish columns used by the app.

ALTER TABLE public.foods
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS normalized_name text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS group_name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'legacy_seed',
  ADD COLUMN IF NOT EXISTS source_license text,
  ADD COLUMN IF NOT EXISTS source_version text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS fdc_id bigint,
  ADD COLUMN IF NOT EXISTS data_type text,
  ADD COLUMN IF NOT EXISTS serving_size numeric,
  ADD COLUMN IF NOT EXISTS serving_unit text,
  ADD COLUMN IF NOT EXISTS grams_per_serving numeric,
  ADD COLUMN IF NOT EXISTS calories_per_100g numeric,
  ADD COLUMN IF NOT EXISTS protein_per_100g numeric,
  ADD COLUMN IF NOT EXISTS carbs_per_100g numeric,
  ADD COLUMN IF NOT EXISTS fat_per_100g numeric,
  ADD COLUMN IF NOT EXISTS fiber_per_100g numeric,
  ADD COLUMN IF NOT EXISTS sugar_per_100g numeric,
  ADD COLUMN IF NOT EXISTS sodium_mg_per_100g numeric,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'es-MX',
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.foods
SET
  name = COALESCE(name, nombre),
  normalized_name = COALESCE(normalized_name, lower(nombre)),
  serving_size = COALESCE(serving_size, racion),
  serving_unit = COALESCE(serving_unit, unidad),
  grams_per_serving = COALESCE(
    grams_per_serving,
    CASE
      WHEN lower(unidad) IN ('g', 'gr', 'gramo', 'gramos') THEN racion
      WHEN lower(unidad) IN ('ml', 'mililitro', 'mililitros') THEN racion
      ELSE 100
    END
  ),
  calories_per_100g = COALESCE(
    calories_per_100g,
    CASE WHEN lower(unidad) IN ('g', 'gr', 'gramo', 'gramos') AND racion > 0 THEN calorias / racion * 100 ELSE calorias END
  ),
  protein_per_100g = COALESCE(
    protein_per_100g,
    CASE WHEN lower(unidad) IN ('g', 'gr', 'gramo', 'gramos') AND racion > 0 THEN proteinas / racion * 100 ELSE proteinas END
  ),
  carbs_per_100g = COALESCE(
    carbs_per_100g,
    CASE WHEN lower(unidad) IN ('g', 'gr', 'gramo', 'gramos') AND racion > 0 THEN carbohidratos / racion * 100 ELSE carbohidratos END
  ),
  fat_per_100g = COALESCE(
    fat_per_100g,
    CASE WHEN lower(unidad) IN ('g', 'gr', 'gramo', 'gramos') AND racion > 0 THEN grasas / racion * 100 ELSE grasas END
  )
WHERE name IS NULL
   OR normalized_name IS NULL
   OR serving_size IS NULL
   OR serving_unit IS NULL
   OR grams_per_serving IS NULL
   OR calories_per_100g IS NULL
   OR protein_per_100g IS NULL
   OR carbs_per_100g IS NULL
   OR fat_per_100g IS NULL;

DROP INDEX IF EXISTS public.foods_fdc_id_unique_idx;

CREATE UNIQUE INDEX foods_fdc_id_unique_idx
  ON public.foods (fdc_id);

CREATE INDEX IF NOT EXISTS foods_normalized_name_idx
  ON public.foods (normalized_name);

CREATE INDEX IF NOT EXISTS foods_source_idx
  ON public.foods (source, is_verified);

SELECT setval(
  pg_get_serial_sequence('public.foods', 'id'),
  COALESCE((SELECT MAX(id) FROM public.foods), 1),
  true
);

CREATE TABLE IF NOT EXISTS public.meal_ingredients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_id uuid NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  food_id integer REFERENCES public.foods(id) ON DELETE SET NULL,
  ingredient_name text NOT NULL,
  source text NOT NULL DEFAULT 'user_custom',
  is_verified boolean NOT NULL DEFAULT false,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'g',
  grams numeric NOT NULL,
  calories numeric NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  carbs numeric NOT NULL DEFAULT 0,
  fat numeric NOT NULL DEFAULT 0,
  fiber numeric,
  sugar numeric,
  sodium_mg numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meal_ingredients_grams_positive CHECK (grams > 0),
  CONSTRAINT meal_ingredients_quantity_positive CHECK (quantity > 0),
  CONSTRAINT meal_ingredients_macros_non_negative CHECK (
    calories >= 0 AND protein >= 0 AND carbs >= 0 AND fat >= 0
  )
);

ALTER TABLE public.meal_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own meal ingredients" ON public.meal_ingredients;
DROP POLICY IF EXISTS "Users can insert own meal ingredients" ON public.meal_ingredients;
DROP POLICY IF EXISTS "Users can update own meal ingredients" ON public.meal_ingredients;
DROP POLICY IF EXISTS "Users can delete own meal ingredients" ON public.meal_ingredients;

CREATE POLICY "Users can view own meal ingredients"
  ON public.meal_ingredients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meal ingredients"
  ON public.meal_ingredients FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.meals
      WHERE meals.id = meal_ingredients.meal_id
        AND meals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own meal ingredients"
  ON public.meal_ingredients FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own meal ingredients"
  ON public.meal_ingredients FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS handle_meal_ingredients_updated_at ON public.meal_ingredients;
CREATE TRIGGER handle_meal_ingredients_updated_at
  BEFORE UPDATE ON public.meal_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.meal_ingredients IS 'Ingredient-level meal breakdown used to recalculate nutrition from quantities.';
COMMENT ON COLUMN public.foods.source IS 'Nutrition source, e.g. USDA_FDC, legacy_seed, user_custom, ai_estimated, SMAE_licensed.';
COMMENT ON COLUMN public.foods.source_license IS 'License for nutrition data source. USDA FDC uses CC0_1_0.';
COMMENT ON COLUMN public.foods.fdc_id IS 'USDA FoodData Central identifier when source = USDA_FDC.';
