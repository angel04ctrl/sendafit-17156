# Nutrition Master Catalog Export Contract

Este documento acompana `docs/nutrition-master-export.sql`. El resultado esperado del SQL es un unico CSV llamado `nutrition-master-catalog.csv`.

## 1. Que representa cada fila

Cada fila representa un registro principal de `public.nutrition_foods` dentro del catalogo maestro global de SendaFit.

La fila no representa una comida registrada por un usuario, un analisis de imagen, un favorito personal ni un objetivo nutricional. Es solamente catalogo alimentario.

## 2. Que representa cada columna

- `export_row_number`: posicion deterministica dentro del export.
- `export_total_foods`: total de alimentos exportados.
- `food_id`: UUID actual del alimento en `nutrition_foods`.
- `legacy_food_id`: ID legacy proveniente de `foods.id`, si existe.
- `canonical_name`: nombre canonico interno.
- `display_name`: nombre visible para usuarios.
- `normalized_name`: nombre normalizado para busqueda y deduplicacion.
- `description`: descripcion editorial.
- `food_type`: valor de `food_kind`; distingue generico, marca, restaurante, custom, estimado IA o receta si aplica.
- `scope`: alcance del alimento. Para este CSV debe ser `global`.
- `brand_name`: nombre de marca si existe.
- `category`: categorias principales agregadas.
- `subcategory`: subcategorias agregadas.
- `preparation`: estado de preparacion del alimento si existe.
- `base_amount`: cantidad de la porcion default.
- `base_unit`: unidad de la porcion default.
- `serving_grams`: gramos de la porcion default.
- `calories_100g`: kcal por 100 g.
- `protein_100g`: proteina por 100 g.
- `carbohydrates_100g`: carbohidratos por 100 g.
- `fat_100g`: grasa por 100 g.
- `fiber_100g`: fibra por 100 g.
- `sugars_100g`: azucares por 100 g.
- `sodium_mg_100g`: sodio en mg por 100 g.
- `source_code`: fuente principal del alimento.
- `source_external_id`: ID externo, por ejemplo FDC ID si aplica.
- `verification_status`: `verified` o `not_verified`.
- `locale`: locale editorial.
- `confidence_score`: confianza si existe.
- `is_visible`: si el alimento esta visible.
- `is_common`: si es comun/frecuente.
- `visibility_priority`: prioridad editorial de visibilidad.
- `created_at`: fecha de creacion.
- `updated_at`: fecha de actualizacion.

## 3. Columnas que contienen JSON

- `brand_json`
- `aliases_json`
- `categories_json`
- `preparations_json`
- `servings_json`
- `nutrients_json`
- `sources_json`
- `external_references_json`
- `barcodes_json`
- `substitutions_json`
- `food_record_json`
- `reference_catalog_json`
- `orphan_catalog_records_json`
- `audit_review_reasons`

Los arrays vacios aparecen como `[]`. Los objetos ausentes aparecen como `null` cuando corresponde.

## 4. Estructura interna de cada JSON

### `food_record_json`

Contiene el registro original completo del alimento desde `nutrition_foods`, usando `to_jsonb()`. Debe preservar IDs, timestamps, `legacy_food_id`, `metadata`, estados y campos tecnicos del alimento.

### `aliases_json`

Array de aliases. Cada objeto contiene:

- `alias_record`: fila original completa de `nutrition_food_aliases`.
- `alias_id`
- `food_id`
- `alias`
- `normalized_alias`
- `locale`
- `source`
- `created_at`

### `categories_json`

Array de relaciones alimento-categoria. Cada objeto contiene:

- `food_category_record`: fila original de `nutrition_food_categories`.
- `category_record`: fila original de `nutrition_categories`.
- `category_id`
- `category_name`
- `normalized_name`
- `category_level`
- `locale`
- `is_primary`
- `parent_id`

### `servings_json`

Array de porciones. Cada objeto contiene:

- `serving_record`: fila original de `nutrition_food_servings`.
- `unit_record`: fila original de `nutrition_units`.
- `serving_id`
- `food_id`
- `unit_id`
- `unit_code`
- `unit_name`
- `unit_dimension`
- `serving_label`
- `quantity`
- `grams`
- `milliliters`
- `is_default`
- `source`
- `confidence_score`

### `nutrients_json`

Array de valores nutricionales. Cada objeto contiene:

- `food_nutrient_record`: fila original de `nutrition_food_nutrients`.
- `nutrient_record`: fila original de `nutrition_nutrients`.
- `source_record`: fila original de `nutrition_sources` si existe.
- `food_nutrient_id`
- `food_id`
- `nutrient_id`
- `nutrient_code`
- `nutrient_name`
- `nutrient_group`
- `amount`
- `unit`
- `basis_amount`: siempre 100.
- `basis_unit`: siempre `g`.
- `source_id`
- `source_code`
- `confidence_score`
- `is_verified`
- `updated_at`

### `preparations_json`

Array de relaciones de preparacion. Puede incluir dos direcciones:

- `base_to_prepared`
- `prepared_from_base`

Cada objeto contiene `preparation_record`, IDs de alimento base/preparado, nombres, estado de preparacion, `yield_factor` y notas.

### `sources_json`

Array de fuentes relacionadas directamente con el alimento o con sus valores nutricionales.

### `external_references_json`

Array calculado con referencias externas detectadas desde columnas y metadata, por ejemplo `source_external_id`, URL, version o licencia de fuente.

### `barcodes_json`

Array de codigos de barras desde `nutrition_barcodes`.

### `substitutions_json`

Array de sustituciones editoriales. Puede incluir direcciones:

- `original_to_substitute`
- `substitute_for_original`

### `reference_catalog_json`

Aparece solamente en la primera fila. En el resto es `null`.

Contiene catalogos globales completos:

- `sources`
- `brands`
- `categories`
- `units`
- `nutrients`
- `food_kinds`
- `scopes`
- `preparation_states`

### `orphan_catalog_records_json`

Aparece solamente en la primera fila. En el resto es `null`.

Contiene registros editoriales huerfanos si existieran:

- `aliases`
- `servings`
- `food_nutrients`
- `food_categories`
- `barcodes`
- `food_preparations`
- `ingredient_substitutions`

Si no hay huerfanos, los arrays aparecen vacios.

## 5. Columnas que puede editar el especialista

El especialista puede proponer cambios editoriales para:

- `canonical_name`
- `display_name`
- `normalized_name`
- `description`
- `food_type`
- `brand_name`
- `category`
- `subcategory`
- `preparation`
- `base_amount`
- `base_unit`
- `serving_grams`
- valores nutricionales por 100 g
- aliases dentro de `aliases_json`
- categorias dentro de `categories_json`
- porciones dentro de `servings_json`
- nutrientes dentro de `nutrients_json`
- preparaciones dentro de `preparations_json`
- codigos de barras dentro de `barcodes_json`
- sustituciones dentro de `substitutions_json`
- flags editoriales como `is_visible`, `is_common`, `visibility_priority` e `is_verified`

## 6. Columnas que no debe modificar

No modificar:

- `food_id`
- `legacy_food_id`
- IDs dentro de cualquier JSON
- `created_at`
- `updated_at`
- `food_record_json`
- `reference_catalog_json`
- `orphan_catalog_records_json`
- columnas `audit_*`

## 7. IDs que debe conservar

Todos los IDs existentes deben conservarse exactamente:

- `food_id`
- `alias_id`
- `category_id`
- `serving_id`
- `nutrient_id`
- `food_nutrient_id`
- `source_id`
- `brand_id`
- IDs de preparaciones, barcodes y sustituciones si existen

## 8. Como agregar alimentos nuevos

No inventar UUIDs.

Para un alimento nuevo, el especialista debe agregar una fila al CSV de parche futuro con:

- `food_id` vacio.
- `legacy_food_id` vacio.
- `client_key` o `patch_key` estable, por ejemplo `new_food_avena_instantanea_mx`.
- datos editoriales completos.

El importador futuro generara el UUID real en Supabase.

## 9. Como usar client_key para registros nuevos

Cuando un alimento nuevo necesite aliases, porciones, categorias o nutrientes nuevos, esas relaciones deben apuntar al mismo `client_key`.

Ejemplo conceptual:

- alimento nuevo: `client_key = new_food_creatina_monohidratada`
- alias nuevo: `food_client_key = new_food_creatina_monohidratada`
- nutriente nuevo: `food_client_key = new_food_creatina_monohidratada`

El importador resolvera `client_key -> food_id` durante la importacion.

## 10. Como representar aliases nuevos

Agregar objetos dentro de `aliases_json` o en el parche futuro:

- dejar `alias_id` vacio.
- conservar `food_id` si el alimento existe.
- usar `food_client_key` si el alimento es nuevo.
- completar `alias`, `normalized_alias`, `locale` y `source`.

## 11. Como representar porciones nuevas

Agregar objetos con:

- `serving_id` vacio.
- `serving_label`
- `quantity`
- `unit_code`
- `grams` o `milliliters`
- `is_default`
- `confidence_score` si aplica.

Debe haber maximo una porcion default clara por alimento, salvo que el importador futuro especifique otra regla.

## 12. Como representar preparaciones nuevas

Usar relaciones entre alimentos:

- `base_food_id` o `base_food_client_key`
- `prepared_food_id` o `prepared_food_client_key`
- `preparation_state`
- `yield_factor`
- `notes`

No mezclar una preparacion con un alias. Una preparacion representa cambio real del alimento o su forma.

## 13. Como representar nutrientes nuevos

Si el nutriente ya existe en `reference_catalog_json.nutrients`, usar su `nutrient_id` o `nutrient_code`.

Si el nutriente no existe:

- proponer `nutrient_client_key`.
- completar nombre, unidad, grupo y orden.
- no inventar UUID.

Para valores nutricionales por alimento:

- conservar `amount`.
- conservar `unit`.
- conservar base 100 g.
- no convertir unidades sin documentarlo.

## 14. Como representar categorias nuevas

Si la categoria existe, usar `category_id` o `normalized_name`.

Si es nueva:

- proponer `category_client_key`.
- completar `name`, `normalized_name`, `category_level`, `locale`.
- para jerarquia nueva, usar `parent_category_client_key`.

## 15. Como marcar registros para revision

Usar razones claras en una futura columna de parche, por ejemplo:

- `missing_source`
- `macro_energy_mismatch`
- `duplicate_candidate`
- `needs_brand`
- `needs_serving`
- `needs_category`
- `deprecate_review`

No borrar filas.

## 16. Como devolver el CSV

El especialista debe devolver el CSV conservando exactamente los encabezados originales.

No cambiar:

- orden de columnas
- nombres de columnas
- encoding
- formato JSON
- comillas necesarias del CSV

## 17. Columnas audit_*

Las columnas `audit_*` son informativas.

No forman parte del schema de la base de datos y no deben importarse directamente.

Sirven para priorizar correcciones:

- alimentos sin aliases
- alimentos sin categoria
- alimentos sin descripcion
- alimentos sin porciones
- alimentos sin macros completos
- posibles duplicados
- diferencias entre kcal declaradas y energia calculada por macros

## 18. Informacion en reference_catalog_json

`reference_catalog_json` contiene catalogos globales completos para que el especialista no tenga que recibir CSV separados.

Solo aparece en la primera fila para evitar inflar el archivo.

## 19. Como preservar JSON valido dentro del CSV

- Mantener comillas dobles validas.
- No pegar JSON con saltos de linea innecesarios.
- No usar comillas tipograficas.
- No convertir arrays JSON en texto libre.
- Validar que cada campo JSON siga siendo parseable.

## 20. Codificacion

El CSV debe mantenerse en UTF-8.

No usar Latin-1, ANSI ni codificaciones que rompan acentos en espanol.
