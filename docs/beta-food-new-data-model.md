# Beta Nutrition Sprint 1B - Nuevo modelo de datos nutricional

Este documento define la arquitectura objetivo para alimentos, comidas, recetas, porciones, fuentes y analisis IA de SendaFit. El diseno es paralelo al modelo actual: no reemplaza `foods`, `meals`, `meal_ingredients` ni `food_analysis_logs` en la primera fase. La migracion copia referencias hacia tablas `nutrition_*` y conserva los IDs legacy para compatibilidad.

## Resumen ejecutivo

La auditoria 1A muestra que el sistema actual funciona para registrar macros diarios, pero combina catalogo, fuente externa, porciones, busqueda, verificacion y datos legacy en una sola tabla `foods`. Tambien hay registros de comidas agregados en `meals`, desglose parcial en `meal_ingredients` y analisis IA en `food_analysis_logs`.

El nuevo modelo separa responsabilidades:

- Catalogo canonico de alimentos.
- Marcas, categorias y aliases normalizados.
- Unidades y porciones reutilizables.
- Nutrientes como catalogo extensible, no como columnas fijas.
- Logs de comidas con snapshots nutricionales para preservar historial.
- Recetas y sus ingredientes.
- Historial IA y detecciones estructuradas.
- Metas nutricionales versionadas por usuario.

## Hallazgos de Sprint 1A usados como base

- `foods`: 169 alimentos.
- `meals`: 13 registros.
- `meal_ingredients`: 3 ingredientes detallados.
- `food_analysis_logs`: 1 analisis IA.
- 149 alimentos sin aliases.
- 97 alimentos sin categoria.
- 97 alimentos sin descripcion.
- 23 alimentos con calorias inconsistentes contra macros por mas de 20%.
- 10 comidas sin desglose de ingredientes.
- No existen tablas separadas para marcas, unidades, porciones, recetas, barcodes o micronutrientes completos.
- `src/integrations/supabase/types.ts` esta desactualizado respecto al schema nutricional real.

## Problemas de la arquitectura actual

1. `foods` hace demasiadas cosas: catalogo visible, datos legacy, USDA/FDC, busqueda, porciones, verificacion y macros.
2. Las unidades son texto libre, lo que dificulta equivalencias como taza, pieza, scoop, ml o g.
3. No existe una tabla de porciones por alimento; solo hay una porcion default.
4. Los micronutrientes no son extensibles: fibra, azucar y sodio estan en columnas fijas.
5. No hay marca, barcode ni fuente externa normalizada.
6. Las comidas guardan totales, pero muchas no tienen desglose suficiente para auditoria.
7. Los alimentos creados por IA o por usuario no tienen un espacio claro distinto del catalogo publico.
8. No hay recetas reutilizables ni ingredientes versionados.
9. Los logs IA guardan JSON util, pero no hay detecciones normalizadas para busqueda o correccion posterior.
10. Las metas nutricionales viven en `profiles`; no hay historial de cambios por fecha.

## Requisitos funcionales

El modelo nuevo debe permitir:

- Buscar alimentos genericos y de marca.
- Guardar alimentos globales, personalizados del usuario y estimados por IA.
- Mantener valores por 100 g y por porcion.
- Soportar multiples porciones por alimento.
- Soportar marcas, restaurantes, fabricantes y barcodes.
- Registrar aliases en espanol y otros locales.
- Registrar micronutrientes sin alterar schema por cada nutriente nuevo.
- Crear recetas con ingredientes reutilizables.
- Guardar comidas reales como snapshots para no cambiar el historial si el catalogo se corrige despues.
- Relacionar analisis IA con items detectados y comidas guardadas.
- Versionar objetivos diarios de macros por usuario.
- Mantener compatibilidad con tablas legacy durante la transicion.

## Capas del nuevo modelo

### 1. Referencias

- `nutrition_sources`: origen de datos, licencia y version.
- `nutrition_units`: unidades normalizadas.
- `nutrition_nutrients`: definicion de nutrientes.
- `nutrition_categories`: taxonomia jerarquica.
- `nutrition_brands`: marcas, restaurantes o fabricantes.

### 2. Catalogo

- `nutrition_foods`: alimento canonico o personalizado.
- `nutrition_food_aliases`: nombres alternativos.
- `nutrition_food_categories`: relacion muchos-a-muchos con categorias.
- `nutrition_food_servings`: porciones y equivalencias.
- `nutrition_food_nutrients`: valores nutricionales extensibles por 100 g.
- `nutrition_barcodes`: codigos de barras.
- `nutrition_food_preparations`: relacion entre alimento base y preparaciones.

### 3. Recetas

- `nutrition_recipes`: receta reutilizable.
- `nutrition_recipe_ingredients`: ingredientes de receta con cantidad, unidad, gramos y orden.

### 4. Registro diario

- `nutrition_meal_logs`: cabecera de comida registrada.
- `nutrition_meal_log_items`: items ingeridos con snapshot de macros y micros.

### 5. Personalizacion

- `nutrition_user_goals`: metas versionadas de calorias/macros.
- `nutrition_favorites`: favoritos de alimentos o recetas.
- `nutrition_ingredient_substitutions`: equivalencias y sustituciones.

### 6. IA

- `nutrition_ai_analysis_logs`: historial normalizado de analisis IA.
- `nutrition_ai_detected_items`: alimentos detectados dentro de cada analisis.

## Decisiones importantes

- Se usan tablas nuevas `nutrition_*` para evitar romper flujos actuales.
- Se preservan columnas `legacy_food_id`, `legacy_meal_id`, `legacy_meal_ingredient_id` y `legacy_food_analysis_log_id`.
- Los totales de comidas se guardan como snapshot, no se recalculan automaticamente desde el catalogo historico.
- Los nutrientes se modelan como filas, no como columnas fijas, para soportar micros futuros.
- Los check constraints usan texto controlado en vez de enums nuevos para facilitar cambios futuros sin migraciones complejas.
- El catalogo global puede convivir con alimentos privados del usuario mediante `scope` y `owner_user_id`.

## Tablas legacy que desaparecen

Ninguna en esta fase.

Las tablas `foods`, `meals`, `meal_ingredients` y `food_analysis_logs` quedan intactas. En una fase futura podrian quedar como compatibilidad o ser reemplazadas por vistas/API, pero no se eliminan en Sprint 1B.

## Riesgos

- El frontend actual sigue leyendo tablas legacy; aplicar solo la migracion no cambia la UI.
- Si el codigo empieza a usar `nutrition_*`, se debe actualizar `types.ts` y los hooks de macros.
- Las comidas legacy sin ingredientes seguiran incompletas aun despues de migrar; solo se conserva el total.
- Los valores legacy con macros inconsistentes se copian como snapshot para auditoria, no se corrigen.
- El rollback elimina solo las tablas nuevas; no recupera cambios futuros hechos directamente en `nutrition_*` si ya hubo uso productivo.

## Estrategia de migracion

1. Crear tablas `nutrition_*`.
2. Activar RLS y policies.
3. Insertar catalogos base: fuentes, unidades y nutrientes.
4. Copiar `foods` a `nutrition_foods`, preservando `legacy_food_id`.
5. Copiar aliases, categorias, porciones y nutrientes por 100 g.
6. Copiar `meals` a `nutrition_meal_logs`.
7. Copiar `meal_ingredients` a `nutrition_meal_log_items`.
8. Copiar `food_analysis_logs` a `nutrition_ai_analysis_logs`.
9. Crear detecciones desde `detected_foods` JSON cuando sea posible.
10. Copiar metas actuales de `profiles` a `nutrition_user_goals`.
11. Ejecutar validacion.

## Estrategia de rollback

Ejecutar `docs/beta-food-rollback.sql`. El rollback elimina views y tablas `nutrition_*` en orden inverso de dependencia. No toca tablas legacy.

## Orden recomendado en Supabase

1. Ejecutar `docs/beta-food-migration.sql`.
2. Ejecutar `docs/beta-food-migration-validation.sql`.
3. Si la validacion devuelve `critical`, revisar antes de conectar el frontend.
4. Solo si necesitas revertir la arquitectura nueva, ejecutar `docs/beta-food-rollback.sql`.
