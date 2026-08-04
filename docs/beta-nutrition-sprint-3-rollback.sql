-- Beta Nutrition Sprint 3 - Guarded rollback.
-- Do not run as a routine operation. It intentionally refuses to continue after
-- any Sprint 3 recipe creation/edit or recipe meal registration.

BEGIN;

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.nutrition_meal_logs
    WHERE source = 'nutrition_recipe'
  ) THEN
    RAISE EXCEPTION 'rollback_blocked_recipe_meal_history_exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.nutrition_recipe_versions
    WHERE metadata ->> 'backfilled_by' IS DISTINCT FROM 'beta_nutrition_sprint3'
  ) THEN
    RAISE EXCEPTION 'rollback_blocked_new_or_edited_recipe_versions_exist';
  END IF;
END
$guard$;

DROP FUNCTION IF EXISTS public.register_nutrition_recipe_meal(uuid, uuid, numeric, text, date, uuid);
DROP FUNCTION IF EXISTS public.archive_nutrition_recipe(uuid);
DROP FUNCTION IF EXISTS public.duplicate_nutrition_recipe(uuid, uuid);
DROP FUNCTION IF EXISTS public.save_nutrition_recipe(jsonb);
DROP FUNCTION IF EXISTS public.get_nutrition_recipe(uuid);
DROP FUNCTION IF EXISTS public.search_nutrition_recipes(text, integer, integer);

DROP POLICY IF EXISTS "Users can read nutrition recipe nutrients" ON public.nutrition_recipe_nutrients;
DROP POLICY IF EXISTS "Users can read nutrition recipe steps" ON public.nutrition_recipe_steps;
DROP POLICY IF EXISTS "Users can read nutrition recipe versions" ON public.nutrition_recipe_versions;
DROP POLICY IF EXISTS "Users can read nutrition recipe ingredients" ON public.nutrition_recipe_ingredients;
DROP POLICY IF EXISTS "Users can read nutrition recipes" ON public.nutrition_recipes;
DROP POLICY IF EXISTS "Users can insert own nutrition recipes" ON public.nutrition_recipes;
DROP POLICY IF EXISTS "Users can update own nutrition recipes" ON public.nutrition_recipes;
DROP POLICY IF EXISTS "Users can delete own nutrition recipes" ON public.nutrition_recipes;

DROP FUNCTION IF EXISTS public.nutrition_can_edit_recipe(uuid);
DROP FUNCTION IF EXISTS public.nutrition_can_read_recipe(uuid);

DROP TRIGGER IF EXISTS handle_nutrition_recipe_ingredients_updated_at
ON public.nutrition_recipe_ingredients;

ALTER TABLE public.nutrition_meal_log_items
  DROP CONSTRAINT IF EXISTS nutrition_meal_log_items_unambiguous_source_check,
  DROP COLUMN IF EXISTS recipe_version_id;

ALTER TABLE public.nutrition_recipes
  DROP CONSTRAINT IF EXISTS nutrition_recipes_current_version_fk,
  DROP CONSTRAINT IF EXISTS nutrition_recipes_status_check,
  DROP CONSTRAINT IF EXISTS nutrition_recipes_origin_check,
  DROP CONSTRAINT IF EXISTS nutrition_recipes_difficulty_check,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS origin,
  DROP COLUMN IF EXISTS locale,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS difficulty,
  DROP COLUMN IF EXISTS image_url,
  DROP COLUMN IF EXISTS tags,
  DROP COLUMN IF EXISTS meal_types,
  DROP COLUMN IF EXISTS dietary_labels,
  DROP COLUMN IF EXISTS allergens,
  DROP COLUMN IF EXISTS attribute_evaluation_complete,
  DROP COLUMN IF EXISTS source_recipe_id,
  DROP COLUMN IF EXISTS current_version_id,
  DROP COLUMN IF EXISTS published_at,
  DROP COLUMN IF EXISTS archived_at;

ALTER TABLE public.nutrition_recipe_ingredients
  DROP COLUMN IF EXISTS recipe_version_id,
  DROP COLUMN IF EXISTS canonical_group_id,
  DROP COLUMN IF EXISTS serving_id,
  DROP COLUMN IF EXISTS food_name_snapshot,
  DROP COLUMN IF EXISTS serving_label_snapshot,
  DROP COLUMN IF EXISTS unit_label_snapshot,
  DROP COLUMN IF EXISTS milliliters,
  DROP COLUMN IF EXISTS nutrient_snapshot,
  DROP COLUMN IF EXISTS updated_at;

DROP TABLE IF EXISTS public.nutrition_recipe_nutrients;
DROP TABLE IF EXISTS public.nutrition_recipe_steps;
DROP TABLE IF EXISTS public.nutrition_recipe_versions;

CREATE POLICY "Users can read nutrition recipes"
ON public.nutrition_recipes FOR SELECT
USING (user_id = auth.uid() OR visibility = 'global');

CREATE POLICY "Users can insert own nutrition recipes"
ON public.nutrition_recipes FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own nutrition recipes"
ON public.nutrition_recipes FOR UPDATE
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own nutrition recipes"
ON public.nutrition_recipes FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can read nutrition recipe ingredients"
ON public.nutrition_recipe_ingredients FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.nutrition_recipes recipe
    WHERE recipe.id = recipe_id
      AND (recipe.user_id = auth.uid() OR recipe.visibility = 'global')
  )
);

CREATE POLICY "Users can insert own nutrition recipe ingredients"
ON public.nutrition_recipe_ingredients FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.nutrition_recipes recipe
    WHERE recipe.id = recipe_id AND recipe.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own nutrition recipe ingredients"
ON public.nutrition_recipe_ingredients FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.nutrition_recipes recipe
    WHERE recipe.id = recipe_id AND recipe.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.nutrition_recipes recipe
    WHERE recipe.id = recipe_id AND recipe.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own nutrition recipe ingredients"
ON public.nutrition_recipe_ingredients FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.nutrition_recipes recipe
    WHERE recipe.id = recipe_id AND recipe.user_id = auth.uid()
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_recipes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_recipe_ingredients TO authenticated;

COMMIT;
