# Beta Nutrition Sprint 3 - Implementación

## Flujo del usuario

En Macros, **Recetas** abre una biblioteca paginada. El usuario puede buscar por nombre, descripción, categoría, tags o ingredientes; abrir el detalle; crear; editar como versión nueva; duplicar; archivar; y registrar una cantidad decimal de porciones en la comida y fecha seleccionadas.

El editor sigue este orden: datos generales, ingredientes exactos del catálogo, instrucciones, rendimiento y resumen nutricional. Permite cambiar variante o porción, editar cantidad, reordenar y eliminar ingredientes; también agregar, editar, reordenar y eliminar pasos. Advierte antes de descartar cambios.

## Capa centralizada

- `src/services/nutritionRecipes.ts`: contratos Zod, búsqueda, detalle, guardado, duplicado, archivo, registro y preview.
- `src/hooks/useNutritionRecipes.ts`: queries paginadas, detalle bajo demanda, mutations e invalidación dirigida.
- `NutritionIngredientPicker`: reutiliza los hooks y el cálculo del catálogo del Sprint 2.
- `RecipeManagerDialog`: estados de lista, detalle y editor.

Guardar una receta es una sola RPC. Crear versión, insertar ingredientes, insertar pasos, calcular nutrientes y activar la versión ocurre en una transacción PostgreSQL implícita; una excepción revierte la llamada completa.

Los borradores del formulario permanecen locales y no generan identidades incompletas en la base. Al guardar se publica atómicamente una versión completa. Este patrón cubre crear y actualizar el borrador durante la edición sin persistencia parcial.

## Seguridad

- Usuario autenticado obligatorio.
- Ownership validado en servidor.
- Recetas de sistema no editables por usuarios.
- Selecciones del catálogo verificadas por grupo, variante, porción, alcance y estado.
- Cantidades finitas y mayores que cero; límites de porciones, ingredientes, pasos y tiempos.
- Macros del cliente ignorados; cálculo exclusivo desde catálogo.
- `client_request_id` evita duplicados por reintentos.
- Errores SQL no se exponen en la UI.
- RLS activa y escritura directa revocada.

## Rendimiento

| Operación | Patrón | Solicitudes de aplicación |
| --- | --- | ---: |
| Primera página | Resumen de 20 recetas, máximo 50 | 1 |
| Búsqueda | Debounce de 300 ms y filtrado server-side | 1 por término estable |
| Detalle | JSON agregado de una versión | 1 |
| Ingrediente | Reutiliza catálogo paginado y detalle bajo demanda | 1 + 1 por grupo abierto |
| Guardado/versionado | RPC transaccional | 1 |
| Registro en comida | RPC transaccional con espejo legacy | 1 |

El listado no descarga ingredientes ni pasos. El detalle agrupa sus colecciones en base de datos, evitando N+1 de red. El preview se memoiza por ingredientes, porciones y peso final. React Query conserva listado/detalle durante dos minutos y solo invalida claves relacionadas.

Las latencias reales dependen de la región y del volumen remoto; deben observarse después de aplicar la migración. Los índices cubren propietario/estado, versión por receta, orden de ingredientes/pasos y referencias de meal logs.

## Accesibilidad y móvil

- Dialog con altura `dvh`, un solo scroll interno y acciones sticky.
- Labels asociados, roles de lista, foco visible y controles nativos.
- Botones iconográficos con títulos accesibles.
- Estados de carga, vacío, error, disabled y retry.
- Región `aria-live` para agregar, eliminar, reemplazar y reordenar.
- Confirmación antes de archivar o salir con cambios.

## Sprint 4 y Sprint 5

La receta expone macros, porciones, tiempos, categoría, ingredientes, alérgenos, etiquetas, tipo de comida, origen, visibilidad y estado. Las etiquetas dietéticas y alérgenos quedan vacíos con evaluación incompleta hasta disponer de evidencia; no se inventan inferencias. Los ingredientes conservan cantidad, unidad, gramos/mililitros, serving y rendimiento para una lista de compras futura.

No se implementó Coach ni lista de compras.

## Archivos

- `supabase/migrations/20260803030000_beta_nutrition_sprint3_recipes.sql`
- `docs/beta-nutrition-sprint-3-validation.sql`
- `docs/beta-nutrition-sprint-3-rollback.sql`
- `src/integrations/supabase/nutrition-types.ts`
- `src/services/nutritionRecipes.ts`
- `src/hooks/useNutritionRecipes.ts`
- `src/components/nutrition/NutritionIngredientPicker.tsx`
- `src/components/nutrition/RecipeManagerDialog.tsx`
- `src/pages/Macros.tsx`
- pruebas de servicio y UI asociadas.
