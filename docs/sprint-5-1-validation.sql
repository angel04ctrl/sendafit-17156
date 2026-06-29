-- Sprint 5.1 validation queries.

-- 1. USDA foods imported and verified.
SELECT count(*) AS usda_foods
FROM public.foods
WHERE source = 'USDA_FDC'
  AND source_license = 'CC0_1_0'
  AND fdc_id IS NOT NULL
  AND is_verified = true;

-- 2. Foods without source metadata.
SELECT id, nombre, name, source, source_license, fdc_id
FROM public.foods
WHERE source IS NULL
   OR source = ''
   OR (source = 'USDA_FDC' AND (source_license IS NULL OR fdc_id IS NULL));

-- 3. Foods without usable macros per 100 g.
SELECT id, nombre, source, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g
FROM public.foods
WHERE calories_per_100g IS NULL
   OR protein_per_100g IS NULL
   OR carbs_per_100g IS NULL
   OR fat_per_100g IS NULL;

-- 4. Duplicate USDA FDC IDs.
SELECT fdc_id, count(*) AS duplicates
FROM public.foods
WHERE fdc_id IS NOT NULL
GROUP BY fdc_id
HAVING count(*) > 1;

-- 5. Meals with negative macros.
SELECT id, user_id, name, calories, protein, carbs, fat, date
FROM public.meals
WHERE calories < 0
   OR protein < 0
   OR carbs < 0
   OR fat < 0;

-- 6. Ingredient rows with invalid quantities or negative macros.
SELECT id, meal_id, user_id, ingredient_name, grams, quantity, calories, protein, carbs, fat
FROM public.meal_ingredients
WHERE grams <= 0
   OR quantity <= 0
   OR calories < 0
   OR protein < 0
   OR carbs < 0
   OR fat < 0;

-- 7. AI-estimated ingredients without food base, expected to be unverified.
SELECT id, meal_id, ingredient_name, source, is_verified, food_id
FROM public.meal_ingredients
WHERE source = 'ai_estimated'
  AND (food_id IS NOT NULL OR is_verified = true);

-- 8. Custom foods/ingredients marked verified by mistake.
SELECT id, meal_id, ingredient_name, source, is_verified
FROM public.meal_ingredients
WHERE source = 'user_custom'
  AND is_verified = true;

-- 9. Meals whose ingredient totals do not match meal totals closely.
WITH ingredient_totals AS (
  SELECT
    meal_id,
    round(sum(calories)) AS calories,
    round(sum(protein)) AS protein,
    round(sum(carbs)) AS carbs,
    round(sum(fat)) AS fat
  FROM public.meal_ingredients
  GROUP BY meal_id
)
SELECT
  m.id,
  m.name,
  m.calories AS meal_calories,
  it.calories AS ingredient_calories,
  m.protein AS meal_protein,
  it.protein AS ingredient_protein,
  m.carbs AS meal_carbs,
  it.carbs AS ingredient_carbs,
  m.fat AS meal_fat,
  it.fat AS ingredient_fat
FROM public.meals m
JOIN ingredient_totals it ON it.meal_id = m.id
WHERE abs(m.calories - it.calories) > 5
   OR abs(m.protein - it.protein) > 2
   OR abs(m.carbs - it.carbs) > 2
   OR abs(m.fat - it.fat) > 2;

-- 10. Confirm no SMAE source is used without explicit licensed marker.
SELECT id, nombre, source
FROM public.foods
WHERE source ILIKE '%SMAE%'
  AND source <> 'SMAE_licensed';
