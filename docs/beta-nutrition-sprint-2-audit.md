# Beta Nutrition Sprint 2 - Auditoria de integracion

Fecha: 2026-08-03

## Alcance auditado

La auditoria cubre el selector de alimentos, el calculo de nutrientes, el registro de comidas, el historial y los consumidores secundarios de comidas. No modifica datos ni incluye recetas, planes alimenticios, listas de compra o Coach nutricional.

## Flujo actual

1. `src/pages/Macros.tsx` consulta directamente `public.foods` al montar la pagina.
2. La consulta descarga las filas visibles de la tabla legacy y las guarda completas en estado local.
3. El buscador normaliza y filtra solamente ese arreglo local.
4. La lista renderiza como maximo diez coincidencias.
5. Al seleccionar una fila legacy, `src/lib/nutritionCalculator.ts` interpreta sus valores por 100 g y calcula macros a partir de gramos escritos manualmente.
6. El registro crea primero una fila en `public.meals` y luego intenta crear una fila en `public.meal_ingredients`.
7. `src/pages/Dashboard.tsx`, `src/hooks/useBackendApi.ts`, `src/components/MealHistorySection.tsx` y `supabase/functions/coach-chat/index.ts` siguen leyendo `public.meals`.
8. `src/components/ai/FoodAnalysisModal.tsx` y Coach tambien escriben en `public.meals` y `public.meal_ingredients`.

## Archivos involucrados

- `src/pages/Macros.tsx`: listado legacy, busqueda local, seleccion, calculo y registro.
- `src/lib/nutritionCalculator.ts`: normalizacion legacy y calculo por gramos.
- `src/lib/mealValidation.ts`: validacion de macros y cantidades.
- `src/hooks/useBackendApi.ts`: historial desde `public.meals`.
- `src/pages/Dashboard.tsx`: totales diarios desde `public.meals`.
- `src/components/MealHistorySection.tsx`: presentacion del historial legacy.
- `src/components/ai/FoodAnalysisModal.tsx`: registro de comidas estimadas por IA.
- `supabase/functions/coach-chat/index.ts`: contexto y registro de comidas del Coach.
- `src/integrations/supabase/types.ts`: tipos generados desactualizados; no contienen la arquitectura `nutrition_*` ni `meal_ingredients`.
- `docs/beta-food-migration.sql`: arquitectura base `nutrition_*`, RLS y backfill legacy.
- `docs/beta-food-architecture-correction.sql`: grupos canonicos, miembros, estados, preparaciones y relaciones.
- `docs/nutrition-import-v2.1/*`: contrato, mapeo, reporte y validaciones del catalogo importado.
- `scripts/nutrition/import-nutrition-v2.1.ts`: importador transaccional ya ejecutado; no se reutiliza en este sprint.

## Tablas y vistas actuales

Fuente legacy todavia consumida por la aplicacion:

- `public.foods`
- `public.meals`
- `public.meal_ingredients`
- `public.food_analysis_logs`

Fuente de verdad disponible pero aun no integrada en la UI:

- `public.nutrition_foods`
- `public.nutrition_food_aliases`
- `public.nutrition_food_categories`
- `public.nutrition_categories`
- `public.nutrition_food_servings`
- `public.nutrition_units`
- `public.nutrition_food_nutrients`
- `public.nutrition_nutrients`
- `public.nutrition_canonical_food_groups`
- `public.nutrition_food_group_members`
- `public.nutrition_physical_states`
- `public.nutrition_preparation_methods`
- `public.nutrition_food_preparations`
- `public.nutrition_food_relationships`
- `public.nutrition_meal_logs`
- `public.nutrition_meal_log_items`
- `public.nutrition_foods_search_v`
- `public.nutrition_daily_totals_v`

## Causa real del catalogo incompleto

El limite visible no proviene de Supabase, virtualizacion, altura, cache ni infinite scroll. En `Macros.tsx`, la UI ejecuta:

```ts
foods
  .filter((food) => foodMatchesSearch(food, searchQuery))
  .slice(0, 10)
```

La lista siempre queda truncada a diez filas y no existe paginacion, cursor, observador de interseccion ni accion para pedir una pagina posterior. Ademas, la busqueda es local y solo conoce las filas legacy que fueron descargadas al montar la pagina.

## Riesgos identificados

- Cambiar el registro exclusivamente a `nutrition_meal_logs` haria que Dashboard, historial y Coach dejaran de ver las comidas nuevas.
- Mantener dos inserts independientes puede dejar datos parciales si el segundo falla.
- Confiar en macros enviados por el navegador permitiria manipular valores y perder trazabilidad.
- Guardar un UUID de `nutrition_foods` en `meal_ingredients.food_id` rompería su FK legacy de tipo integer.
- Consultar nutrientes, aliases, categorias y porciones para las 304 variantes en la carga inicial generaria trafico y un patron N+1 innecesario.
- Los tipos actuales fuerzan casts y ocultan errores de schema.
- La funcion de normalizacion existente no elimina acentos, por lo que no satisface busquedas como `proteina/proteina` o terminos regionales con distinta acentuacion.

## Plan de modificacion aprobado

1. Crear RPCs de solo lectura para listado paginado por grupo canonico y detalle bajo demanda.
2. Filtrar en base de datos visibilidad, estado, miembro UI y nutrientes activos.
3. Aplicar ranking y normalizacion tolerante a acentos en servidor.
4. Crear un RPC transaccional y autenticado que calcule nutrientes en servidor y escriba `nutrition_meal_logs`/`nutrition_meal_log_items` junto con el espejo `meals`/`meal_ingredients`.
5. Guardar IDs de grupo, variante y porcion, cantidad, equivalencia consumida y snapshots.
6. Centralizar el acceso en un servicio y hooks tipados.
7. Reemplazar solamente el selector de base de datos dentro de `Macros.tsx`.
8. Conservar los flujos manuales, IA y Coach sin cambios funcionales en este sprint.
9. Validar paginacion, busqueda, ranking, variantes, porciones, calculos, escritura y regresion legacy.

## Resultado de la Fase 1

- Flujo actual documentado: cumplido.
- Archivos y tablas reales localizados: cumplido.
- Causa del bug demostrada en codigo: cumplido.
- Riesgos de seguridad e integridad identificados: cumplido.
- Plan de transicion compatible definido: cumplido.

