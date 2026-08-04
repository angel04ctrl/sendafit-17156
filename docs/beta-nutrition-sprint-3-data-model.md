# Beta Nutrition Sprint 3 - Modelo de datos

## Arquitectura final

El modelo separa la identidad mutable de una receta de sus composiciones inmutables:

```text
nutrition_recipes
  1 -> N nutrition_recipe_versions
            1 -> N nutrition_recipe_ingredients
            1 -> N nutrition_recipe_steps
            1 -> N nutrition_recipe_nutrients

nutrition_meal_log_items
  N -> 1 nutrition_recipes
  N -> 1 nutrition_recipe_versions
```

`nutrition_recipes.current_version_id` selecciona la versión publicada que se muestra y registra actualmente. Un cambio crea otra versión y archiva la anterior; no modifica filas históricas.

## Entidades

### `nutrition_recipes`

Se reutiliza como identidad. Conserva propietario, nombre, descripción, visibilidad, estado, origen, locale, categoría, dificultad, tags, tipos de comida, atributos dietéticos, alérgenos, fuente de duplicación y versión actual. Las recetas de usuario nacen privadas. Las globales del sistema son legibles, pero no editables por usuarios normales.

### `nutrition_recipe_versions`

Nueva tabla de revisiones. Conserva número de versión, estado, porciones, rendimiento, peso final opcional aportado por el usuario, volumen final opcional, suma de gramos de ingredientes, tiempos, notas, estado del cálculo, nutrientes ausentes, fecha de cálculo e idempotencia.

`total_weight_g` significa peso final conocido. `ingredient_weight_g` es solo la suma calculada de ingredientes. Nunca se usa la segunda como sustituto automático de la primera.

### `nutrition_recipe_ingredients`

Se amplía la tabla existente y cada fila queda ligada a una versión. La selección conserva `canonical_group_id`, el `food_id` concreto, `serving_id`, `unit_id`, cantidad decimal, gramos/mililitros resueltos, orden y snapshots de nombres, porción, unidad y nutrientes.

El cálculo siempre usa `food_id`; el grupo canónico solo aporta navegación y validación.

### `nutrition_recipe_steps`

Pasos normalizados, ordenados y únicos por versión. El texto se guarda sin HTML y React lo muestra escapado.

### `nutrition_recipe_nutrients`

Tabla normalizada por nutriente y versión. Conserva total, valor por porción y valor por 100 g cuando hay peso final. Soporta micronutrientes nuevos sin columnas adicionales.

### `nutrition_meal_log_items`

Se añade `recipe_version_id`. Un registro de receta conserva identidad, versión, porciones y macros como snapshot. La restricción impide combinar simultáneamente `food_id` y `recipe_id`, sin romper ítems legacy que no usan ninguno.

## Fórmula autoritativa

```text
gramos ingrediente = gramos de la porción x cantidad seleccionada
nutriente ingrediente = amount_per_100g x gramos ingrediente / 100
nutriente receta = suma de nutrientes de ingredientes
nutriente por porción = nutriente receta / porciones de la receta
nutriente por 100 g = nutriente receta / peso final informado x 100
nutriente consumido = nutriente por porción x porciones consumidas
```

La vista previa del cliente replica la fórmula para respuesta inmediata. `save_nutrition_recipe` descarta cualquier macro enviado por el cliente y vuelve a resolver porción, equivalencias y nutrientes desde `nutrition_*`.

## Valores ausentes

Cero y “no reportado” son estados diferentes. Si cualquier ingrediente carece de energía, proteína, carbohidratos o grasa:

- el código se agrega a `missing_nutrient_codes`;
- `calculation_complete` queda en `false`;
- la UI muestra “Información nutricional parcialmente disponible”;
- el valor ausente se muestra como “No disponible”, no como cero;
- el registro en una comida se bloquea hasta contar con los cuatro macros centrales.

## Versionado y snapshots

- Crear publica versión 1.
- Editar una receta propia publica N+1 y archiva N.
- Duplicar crea una identidad privada nueva y registra `source_recipe_id`.
- Archivar oculta la identidad sin eliminar versiones ni meal logs.
- Ingredientes y nutrientes de versiones publicadas no tienen permisos de escritura directa para `authenticated`.
- Un meal log referencia la versión consumida y además conserva nombre, cantidad y nutrientes consumidos.

## RLS

Las identidades privadas solo son visibles para su propietario. Las recetas globales activas son visibles para usuarios autenticados. Versiones, ingredientes, pasos y nutrientes heredan acceso mediante la receta padre. No hay grants directos de `INSERT`, `UPDATE` o `DELETE`; las escrituras pasan por RPCs `SECURITY DEFINER` con `auth.uid()`, ownership y `search_path = public`.

## Compatibilidad

El registro crea en la misma transacción:

1. `nutrition_meal_logs`;
2. un único `nutrition_meal_log_items` de receta;
3. el espejo legacy `meals`;
4. un único `meal_ingredients` de receta.

No crea ítems diarios por ingrediente, por lo que no duplica calorías. El flujo de alimentos del Sprint 2 y los registros anteriores permanecen sin cambios.
