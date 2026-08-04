# Beta Nutrition Sprint 3 - Auditoría previa

Fecha: 2026-08-03

## Alcance auditado

La revisión cubrió el modelo `nutrition_*` aplicado, el catálogo v2.1, la integración del Sprint 2, el registro legacy de comidas, los tipos locales de Supabase, servicios, hooks, componentes, RLS y funciones RPC. No se modificaron datos ni schema durante esta fase.

La especificación local `docs/Sprint3-nutricion.md` se revisó completa, incluidas sus 16 fases, entregables, pruebas y criterios de aceptación. La arquitectura propuesta se contrastó con todos esos requisitos antes de implementarse.

## Fuentes de verdad seleccionadas

1. `docs/beta-food-migration.sql`: modelo base `nutrition_*` que el usuario confirmó haber aplicado.
2. `docs/beta-food-architecture-correction.sql`: grupos canónicos, miembros, estados, preparaciones y relaciones posteriores.
3. `scripts/nutrition/import-nutrition-v2.1.ts` y `docs/nutrition-import-v2.1/*`: importación transaccional ya ejecutada.
4. `supabase/migrations/20260803010000_beta_nutrition_sprint2_catalog_integration.sql`: RPC y persistencia vigentes del Sprint 2.
5. `supabase/migrations/20260803020000_beta_nutrition_sprint2_canonical_group_status_repair.sql`: corrección vigente de estados canónicos.
6. `src/integrations/supabase/nutrition-types.ts`, servicios, hooks y componentes del Sprint 2.
7. La última validación remota reportada: 0 `critical`, 235 grupos canónicos activos y 288 variantes visibles.

`supabase/schema_export.sql` y `src/integrations/supabase/types.ts` son anteriores a la arquitectura nutricional nueva. Se conservan como referencia legacy, pero no se usan como contrato del Sprint 3.

## Archivos localizados

### Arquitectura y catálogo

- `docs/beta-food-migration.sql`
- `docs/beta-food-migration-validation.sql`
- `docs/beta-food-new-data-model.md`
- `docs/beta-food-new-relations.md`
- `docs/beta-food-architecture-correction.sql`
- `docs/beta-food-architecture-correction.md`
- `docs/nutrition-master-export-contract-v2.md`
- `docs/nutrition-import-v2.1/*`
- `scripts/nutrition/import-nutrition-v2.1.ts`
- `scripts/nutrition/validate-nutrition-v2.1.ts`

### Integración vigente

- `supabase/migrations/20260803010000_beta_nutrition_sprint2_catalog_integration.sql`
- `src/integrations/supabase/nutrition-types.ts`
- `src/services/nutritionCatalog.ts`
- `src/hooks/useNutritionCatalog.ts`
- `src/components/nutrition/NutritionFoodSelector.tsx`
- `src/pages/Macros.tsx`
- `src/components/MealHistorySection.tsx`
- `src/lib/nutritionCalculator.ts`
- `src/lib/mealValidation.ts`
- `src/hooks/useBackendApi.ts`

### Flujos nutricionales que deben permanecer compatibles

- `src/components/ai/FoodAnalysisModal.tsx`
- `supabase/functions/analyze-food/index.ts`
- `supabase/functions/analyze-meal/index.ts`
- `supabase/functions/coach-chat/index.ts`
- `src/pages/Dashboard.tsx`

## Tablas existentes relacionadas con recetas

### `public.nutrition_recipes`

Ya representa una identidad de receta. Contiene propietario (`user_id`), nombre, nombre normalizado, visibilidad, número de porciones, peso total, instrucciones como `text[]`, metadata y timestamps.

Restricciones existentes:

- visibilidad: `private`, `shared` o `global`;
- porciones mayores que cero;
- peso total nulo o mayor que cero.

### `public.nutrition_recipe_ingredients`

Ya representa ingredientes ligados directamente a la receta. Conserva `food_id`, `unit_id`, nombre, cantidad, gramos, orden y notas.

No conserva `serving_id`, grupo canónico, snapshots nutricionales ni una versión inmutable.

### Relaciones existentes

- `nutrition_recipe_ingredients.recipe_id -> nutrition_recipes.id`
- `nutrition_recipe_ingredients.food_id -> nutrition_foods.id`
- `nutrition_recipe_ingredients.unit_id -> nutrition_units.id`
- `nutrition_meal_log_items.recipe_id -> nutrition_recipes.id`
- `nutrition_favorites.recipe_id -> nutrition_recipes.id`
- `nutrition_meal_plan_items.recipe_id -> nutrition_recipes.id`

### Conceptos similares, pero no equivalentes

- `nutrition_foods.food_kind = 'recipe'` clasifica un alimento compuesto; no modela autoría, instrucciones ni versiones de una receta reutilizable.
- `meals` y `nutrition_meal_logs` representan consumo realizado, no una receta reutilizable.
- `meal_ingredients` y `nutrition_meal_log_items` representan snapshots consumidos, no ingredientes editables de una receta.

No se encontró UI, servicio, hook ni RPC funcional que permita explorar, crear, editar, duplicar o registrar recetas. Tampoco se encontró importación de recetas de producción.

## RLS actual

`nutrition_recipes` y `nutrition_recipe_ingredients` tienen RLS habilitado.

- El propietario puede leer, insertar, actualizar y eliminar su receta.
- Los usuarios pueden leer recetas `global`.
- Los ingredientes heredan lectura y escritura mediante una comprobación `EXISTS` sobre la receta padre.
- Una receta con visibilidad `shared` no es legible por otros usuarios con la policy actual, por lo que ese estado todavía no tiene semántica de compartición real.

Riesgo actual: permitir escrituras directas en varias tablas deja al cliente responsable de la atomicidad. El Sprint 3 debe preferir RPCs `SECURITY DEFINER` con `auth.uid()`, validación explícita, `search_path = public`, permisos mínimos e idempotencia donde corresponda.

## Flujo actual de registro individual

1. `NutritionFoodSelector` pagina grupos mediante `search_nutrition_catalog`.
2. Carga variantes, porciones y nutrientes bajo demanda con `get_nutrition_catalog_group`.
3. El cliente calcula una vista previa con `calculateNutritionSelection`.
4. `register_nutrition_food_meal` vuelve a validar grupo, variante, porción, alcance, estado y cantidad en el servidor.
5. El servidor calcula gramos y nutrientes desde valores por 100 g.
6. En una transacción crea `nutrition_meal_logs` y `nutrition_meal_log_items`.
7. También crea el espejo `meals` y `meal_ingredients` para Dashboard, historial y Coach legacy.
8. `client_request_id` evita duplicados por reintentos.

Fórmula vigente:

```text
gramos consumidos = gramos por porción x cantidad
nutriente consumido = amount_per_100g x gramos consumidos / 100
```

Macronutrientes principales obligatorios: energía, proteína, carbohidratos y grasa. Fibra, azúcar y sodio pueden permanecer nulos.

## Snapshots actuales

`nutrition_meal_log_items` conserva IDs de grupo, variante, porción y unidad, además de nombre, cantidad, etiqueta, gramos, macros, nutrientes opcionales, fuente, verificación y metadata. El espejo legacy conserva macros y metadata equivalente.

Esto protege los valores consumidos aunque cambie el catálogo. Para recetas falta conservar la versión exacta consumida: `recipe_id` por sí solo apunta a una entidad mutable.

## Componentes reutilizables

- Búsqueda paginada y tolerante a acentos de `useNutritionCatalog`.
- Detalle de variantes y porciones de `useNutritionCatalogGroup`.
- Cálculo cliente de `calculateNutritionSelection` para vista previa.
- Patrón de validación Zod y errores sanitizados de `nutritionCatalog.ts`.
- Controles de variante, porción y cantidad de `NutritionFoodSelector`.
- Modal y selección de tipo/fecha de comida de `Macros.tsx`.
- Invalidación/recarga del historial legacy después de registrar.
- Patrón transaccional e idempotente de `register_nutrition_food_meal`.

El selector actual está acoplado al registro inmediato de un alimento. Para recetas conviene extraer un selector reutilizable que entregue una selección calculada sin persistirla automáticamente.

## Carencias detectadas

1. No existe separación entre identidad y versión de receta.
2. Los ingredientes apuntan a la receta mutable y no a una versión.
3. No existe `serving_id` ni `canonical_group_id` en ingredientes de receta.
4. No hay pasos normalizados con orden; solo un array de instrucciones en la identidad.
5. No hay tabla de nutrientes calculados por versión.
6. No hay estado de borrador/publicada/archivada.
7. No hay tiempos de preparación/cocción ni rendimiento descriptivo suficiente.
8. No hay snapshot de nombre, porción, gramos ni nutrientes del ingrediente por versión.
9. Editar una receta podría alterar su significado histórico.
10. No hay RPC atómica para crear, versionar, duplicar o registrar una receta.
11. No hay servicio, hooks, UI ni pruebas de recetas.
12. `shared` no tiene una política de lectura efectiva.

## Arquitectura propuesta

Extender el modelo existente, sin recrear ni eliminar tablas:

- Mantener `nutrition_recipes` como identidad, propietario y visibilidad.
- Crear `nutrition_recipe_versions` para revisiones inmutables con estado, rendimiento, porciones, pesos, tiempos, totales y timestamps.
- Reorientar o migrar aditivamente `nutrition_recipe_ingredients` para asociar cada ingrediente a una versión y conservar `food_id`, `canonical_group_id`, `serving_id`, `unit_id`, cantidad, gramos y snapshots.
- Crear `nutrition_recipe_steps` para instrucciones ordenadas por versión.
- Crear `nutrition_recipe_nutrients` para nutrientes totales calculados por versión.
- Añadir `recipe_version_id` a `nutrition_meal_log_items` para preservar la versión consumida, manteniendo `recipe_id` por compatibilidad.
- Registrar una receta mediante RPC transaccional que calcule todo en servidor y cree el espejo legacy.
- Crear nuevas versiones al editar; no actualizar ingredientes de una versión ya publicada o consumida.

No se recomienda usar `nutrition_foods.food_kind = 'recipe'` como sustituto de este modelo. Puede existir una relación futura, pero no debe duplicar ni mezclar identidad de receta con composición nutricional del catálogo en este sprint.

## Plan de implementación

1. Contrastar las 16 fases y los criterios de aceptación con el esquema vigente.
2. Crear una migración aditiva con versionado, constraints, índices, RLS y RPCs.
3. Implementar cálculo de receta en servidor y una función cliente equivalente para preview.
4. Extender tipos, servicios y hooks sin casts inseguros.
5. Construir explorador, editor, duplicado y registro de porciones de receta.
6. Integrar el acceso en Macros sin rediseñar módulos ajenos.
7. Añadir pruebas unitarias, de componentes, contratos y SQL de validación.
8. Verificar compatibilidad histórica y ausencia de N+1.

## Riesgos y mitigaciones

- **Historial mutable:** guardar siempre `recipe_version_id` y snapshots consumidos.
- **Macros manipulados por cliente:** recalcular y validar exclusivamente en RPC.
- **Escrituras parciales:** crear versión, ingredientes, pasos y nutrientes en una sola transacción/RPC.
- **Acceso cruzado entre usuarios:** validar propietario en cada RPC y mantener RLS en tablas hijas.
- **Duplicados por doble clic:** usar claves idempotentes para registro y bloqueo de versión al publicar.
- **Borrado destructivo:** archivar identidades/versiones usadas; no borrar historial.
- **Cambios del catálogo:** conservar IDs y snapshots; una versión publicada no se recalcula silenciosamente.
- **Compatibilidad legacy:** mantener espejo `meals`/`meal_ingredients` mientras Dashboard e historial dependan de él.
- **N+1:** listar recetas con resumen paginado y cargar una versión completa en una consulta/RPC bajo demanda.
- **Clasificación dietética incierta:** conservar etiquetas y alérgenos vacíos con evaluación incompleta hasta contar con evidencia verificable; no inferirlos por nombre.

## Revisión de Fase 1

- [x] Tablas de recetas existentes identificadas.
- [x] Conceptos legacy similares diferenciados.
- [x] Flujo de meals y meal logs documentado.
- [x] Registro individual y snapshots documentados.
- [x] Fórmula nutricional documentada.
- [x] Resolución de `food_id`, `serving_id` y cantidades documentada.
- [x] RLS y propiedad de usuario revisadas.
- [x] Componentes reutilizables identificados.
- [x] Carencias, arquitectura propuesta, plan y riesgos documentados.
- [x] Especificación completa revisada, incluidas las 16 fases y los criterios de aceptación.
