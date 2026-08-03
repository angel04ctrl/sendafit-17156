# Beta Nutrition Sprint 1B - Nuevas relaciones nutricionales

Este documento describe las relaciones objetivo del nuevo modelo `nutrition_*`. No modifica relaciones existentes y no elimina tablas legacy.

## Compatibilidad legacy

Las tablas actuales siguen vivas:

- `foods`
- `meals`
- `meal_ingredients`
- `food_analysis_logs`
- `profiles`

El nuevo modelo conserva referencias a esos registros mediante columnas legacy:

- `nutrition_foods.legacy_food_id -> foods.id`
- `nutrition_meal_logs.legacy_meal_id -> meals.id`
- `nutrition_meal_log_items.legacy_meal_ingredient_id -> meal_ingredients.id`
- `nutrition_ai_analysis_logs.legacy_food_analysis_log_id -> food_analysis_logs.id`

## Relaciones de catalogo

### `nutrition_sources`

Fuente de datos nutricionales. Puede representar USDA/FDC, seed legacy, usuario o IA.

Relaciones entrantes:

- `nutrition_foods.source_id`
- `nutrition_food_nutrients.source_id`
- `nutrition_ai_analysis_logs.source_id`

### `nutrition_brands`

Marca, restaurante, tienda o fabricante.

Relaciones entrantes:

- `nutrition_foods.brand_id`

### `nutrition_categories`

Taxonomia jerarquica. Una categoria puede tener padre.

Relaciones salientes:

- `nutrition_categories.parent_id -> nutrition_categories.id`

Relaciones entrantes:

- `nutrition_food_categories.category_id`

### `nutrition_foods`

Catalogo canonico. Puede ser global o privado de un usuario.

Relaciones salientes:

- `owner_user_id -> profiles.id`
- `brand_id -> nutrition_brands.id`
- `source_id -> nutrition_sources.id`
- `legacy_food_id -> foods.id`

Relaciones entrantes:

- `nutrition_food_aliases.food_id`
- `nutrition_food_categories.food_id`
- `nutrition_food_servings.food_id`
- `nutrition_food_nutrients.food_id`
- `nutrition_barcodes.food_id`
- `nutrition_food_preparations.base_food_id`
- `nutrition_food_preparations.prepared_food_id`
- `nutrition_recipe_ingredients.food_id`
- `nutrition_meal_log_items.food_id`
- `nutrition_favorites.food_id`
- `nutrition_ingredient_substitutions.original_food_id`
- `nutrition_ingredient_substitutions.substitute_food_id`
- `nutrition_ai_detected_items.matched_food_id`

### `nutrition_food_aliases`

Aliases por alimento y locale.

Relaciones salientes:

- `food_id -> nutrition_foods.id`

### `nutrition_food_categories`

Relacion muchos-a-muchos entre alimentos y categorias.

Relaciones salientes:

- `food_id -> nutrition_foods.id`
- `category_id -> nutrition_categories.id`

### `nutrition_units`

Catalogo de unidades. Incluye unidad base aproximada, dimension y conversiones cuando son globales.

Relaciones entrantes:

- `nutrition_food_servings.unit_id`
- `nutrition_recipe_ingredients.unit_id`
- `nutrition_meal_log_items.unit_id`
- `nutrition_meal_plan_items.unit_id`
- `nutrition_shopping_list_items.unit_id`

### `nutrition_food_servings`

Porciones disponibles para cada alimento.

Relaciones salientes:

- `food_id -> nutrition_foods.id`
- `unit_id -> nutrition_units.id`

Relaciones entrantes:

- `nutrition_meal_log_items.serving_id`

### `nutrition_nutrients`

Catalogo de nutrientes.

Relaciones entrantes:

- `nutrition_food_nutrients.nutrient_id`

### `nutrition_food_nutrients`

Valores por 100 g por alimento y nutriente.

Relaciones salientes:

- `food_id -> nutrition_foods.id`
- `nutrient_id -> nutrition_nutrients.id`
- `source_id -> nutrition_sources.id`

### `nutrition_barcodes`

Codigos de barras por alimento.

Relaciones salientes:

- `food_id -> nutrition_foods.id`

### `nutrition_food_preparations`

Conecta alimentos crudos/preparados o variantes de preparacion.

Relaciones salientes:

- `base_food_id -> nutrition_foods.id`
- `prepared_food_id -> nutrition_foods.id`

## Relaciones de recetas

### `nutrition_recipes`

Receta global o de usuario.

Relaciones salientes:

- `user_id -> profiles.id`

Relaciones entrantes:

- `nutrition_recipe_ingredients.recipe_id`
- `nutrition_meal_log_items.recipe_id`
- `nutrition_favorites.recipe_id`
- `nutrition_meal_plan_items.recipe_id`

### `nutrition_recipe_ingredients`

Ingredientes reutilizables de receta.

Relaciones salientes:

- `recipe_id -> nutrition_recipes.id`
- `food_id -> nutrition_foods.id`
- `unit_id -> nutrition_units.id`

## Relaciones de comidas registradas

### `nutrition_meal_logs`

Cabecera de comida registrada.

Relaciones salientes:

- `user_id -> profiles.id`
- `legacy_meal_id -> meals.id`
- `ai_analysis_id -> nutrition_ai_analysis_logs.id`

Relaciones entrantes:

- `nutrition_meal_log_items.meal_log_id`

### `nutrition_meal_log_items`

Detalle de items consumidos. Guarda macros como snapshot.

Relaciones salientes:

- `meal_log_id -> nutrition_meal_logs.id`
- `food_id -> nutrition_foods.id`
- `recipe_id -> nutrition_recipes.id`
- `serving_id -> nutrition_food_servings.id`
- `unit_id -> nutrition_units.id`
- `legacy_meal_ingredient_id -> meal_ingredients.id`

## Relaciones de metas y personalizacion

### `nutrition_user_goals`

Historial de metas nutricionales por usuario.

Relaciones salientes:

- `user_id -> profiles.id`

### `nutrition_favorites`

Favoritos del usuario.

Relaciones salientes:

- `user_id -> profiles.id`
- `food_id -> nutrition_foods.id`
- `recipe_id -> nutrition_recipes.id`

### `nutrition_ingredient_substitutions`

Sustituciones nutricionales o equivalencias.

Relaciones salientes:

- `original_food_id -> nutrition_foods.id`
- `substitute_food_id -> nutrition_foods.id`

## Relaciones de IA

### `nutrition_ai_analysis_logs`

Historial de analisis IA de alimentos.

Relaciones salientes:

- `user_id -> profiles.id`
- `source_id -> nutrition_sources.id`
- `legacy_food_analysis_log_id -> food_analysis_logs.id`

Relaciones entrantes:

- `nutrition_ai_detected_items.analysis_id`
- `nutrition_meal_logs.ai_analysis_id`

### `nutrition_ai_detected_items`

Items detectados por IA.

Relaciones salientes:

- `analysis_id -> nutrition_ai_analysis_logs.id`
- `matched_food_id -> nutrition_foods.id`

## Planes de comida y compras

### `nutrition_meal_plans`

Plan nutricional por usuario.

Relaciones salientes:

- `user_id -> profiles.id`

Relaciones entrantes:

- `nutrition_meal_plan_days.plan_id`

### `nutrition_meal_plan_days`

Dia dentro de un plan.

Relaciones salientes:

- `plan_id -> nutrition_meal_plans.id`

Relaciones entrantes:

- `nutrition_meal_plan_items.plan_day_id`

### `nutrition_meal_plan_items`

Item planeado para un dia.

Relaciones salientes:

- `plan_day_id -> nutrition_meal_plan_days.id`
- `food_id -> nutrition_foods.id`
- `recipe_id -> nutrition_recipes.id`
- `unit_id -> nutrition_units.id`

### `nutrition_shopping_lists`

Lista de compras por usuario.

Relaciones salientes:

- `user_id -> profiles.id`

Relaciones entrantes:

- `nutrition_shopping_list_items.shopping_list_id`

### `nutrition_shopping_list_items`

Items de una lista de compras.

Relaciones salientes:

- `shopping_list_id -> nutrition_shopping_lists.id`
- `food_id -> nutrition_foods.id`
- `unit_id -> nutrition_units.id`
