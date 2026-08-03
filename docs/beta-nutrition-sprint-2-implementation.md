# Beta Nutrition Sprint 2 - Implementacion

Fecha: 2026-08-03

## Resumen

El selector de la pestaña `Base de Datos` de Macros deja de consumir `public.foods` y utiliza la arquitectura `nutrition_*` mediante RPCs paginadas. Los registros nuevos guardan la variante y porcion seleccionadas en `nutrition_meal_logs`/`nutrition_meal_log_items` y conservan un espejo en `meals`/`meal_ingredients` para no romper Dashboard, historial, Coach ni flujos legacy.

No se implementaron recetas, planes alimenticios, listas de compra ni cambios del Coach IA.

## Archivos creados

- `supabase/migrations/20260803010000_beta_nutrition_sprint2_catalog_integration.sql`
- `src/integrations/supabase/nutrition-types.ts`
- `src/services/nutritionCatalog.ts`
- `src/hooks/useNutritionCatalog.ts`
- `src/components/nutrition/NutritionFoodSelector.tsx`
- `src/services/nutritionCatalog.test.ts`
- `src/hooks/useNutritionCatalog.test.tsx`
- `src/components/nutrition/NutritionFoodSelector.test.tsx`
- `docs/beta-nutrition-sprint-2-audit.md`
- `docs/beta-nutrition-sprint-2-validation.sql`
- `docs/beta-nutrition-sprint-2-implementation.md`
- `docs/beta-nutrition-sprint-2-validation.md`

## Archivos modificados

- `src/pages/Macros.tsx`: reemplaza solamente el selector legacy de alimentos por el selector `nutrition_*`. El registro manual y el análisis IA conservan su comportamiento.

## Consulta legacy reemplazada

Antes, `Macros.tsx` descargaba `public.foods`, filtraba en memoria y terminaba con `.slice(0, 10)`. Esto causaba el límite visible de ocho, nueve o diez alimentos y hacía que la búsqueda dependiera del arreglo cargado.

Ahora se utilizan cuatro RPCs:

- `search_nutrition_catalog`: lista y búsqueda paginada por grupo canónico.
- `get_nutrition_catalog_group`: variantes, preparaciones, porciones y nutrientes bajo demanda.
- `register_nutrition_food_meal`: validación, cálculo y escritura atómica.
- `get_nutrition_meal_log`: recuperación del snapshot nutricional con sus items.

## Tablas utilizadas

Lectura de catálogo:

- `nutrition_canonical_food_groups`
- `nutrition_food_group_members`
- `nutrition_foods`
- `nutrition_food_aliases`
- `nutrition_brands`
- `nutrition_food_categories`
- `nutrition_categories`
- `nutrition_physical_states`
- `nutrition_preparation_methods`
- `nutrition_food_servings`
- `nutrition_units`
- `nutrition_food_nutrients`
- `nutrition_nutrients`

Persistencia:

- `nutrition_meal_logs`
- `nutrition_meal_log_items`
- `meals` (espejo legacy)
- `meal_ingredients` (espejo legacy)

## Flujo final

1. Al abrir el modal, la primera RPC obtiene 24 grupos canónicos activos.
2. El scroll solicita páginas posteriores hasta completar el total visible.
3. El buscador espera 300 ms y consulta todo el catálogo en servidor.
4. El usuario elige un grupo canónico.
5. La app solicita solamente sus variantes y relaciones.
6. Se selecciona primero el miembro predeterminado válido.
7. La UI muestra estado físico y preparación con nombres naturales almacenados en la base.
8. Se elige una porción válida y una cantidad decimal.
9. La vista previa calcula macros usando la equivalencia registrada en gramos; conserva `null` para nutrientes no reportados.
10. La RPC vuelve a validar y calcular en servidor, sin confiar en macros enviados por el navegador.
11. La transacción guarda IDs, cantidad, equivalencias, snapshots y nutrientes en `nutrition_*`.
12. La misma transacción crea el espejo legacy para que el registro aparezca inmediatamente en las vistas actuales.

## Paginacion y busqueda

- Tamaño de página: 24; máximo aceptado por la RPC: 50.
- Estrategia: `offset` incremental con `total_count` y orden determinista por rango, prioridad y UUID.
- Dedupe adicional en UI por `canonical_group_id`.
- Búsqueda sobre nombre visible, canónico, normalizado, `search_text`, aliases y marca.
- Normalización tolerante a acentos, mayúsculas, puntuación y espacios.
- Alias regionales y plurales dependen exclusivamente del catálogo curado; no se inventan equivalencias.
- React Query separa respuestas por query key, por lo que una respuesta vieja no sustituye una búsqueda nueva.

## Ranking

1. Nombre canónico o visible exacto.
2. Alias exacto.
3. Prefijo de nombre o alias.
4. Coincidencia parcial.
5. `is_common`.
6. `visibility_priority`.
7. Miembro predeterminado y `display_order` dentro del grupo.

Se excluyen grupos deprecados, miembros no visibles, alimentos invisibles y estados `deprecated`/`rejected`.

## Calculo

El catálogo importado almacena nutrientes normalizados como `amount_per_100g`. Para una porción con equivalencia registrada:

```text
gramos consumidos = gramos por porcion x cantidad
nutriente consumido = amount_per_100g x gramos consumidos / 100
```

La implementación usa `serving.grams` o `serving.quantity * unit.grams_multiplier`. Los mililitros se conservan cuando la porción o su unidad los declaran, pero no se infiere densidad. Una porción que no tenga equivalencia de masa verificable se muestra, pero no puede registrarse con valores por 100 g.

Calorías, proteína, carbohidratos y grasas son obligatorios para registrar. Fibra, azúcar y sodio permanecen `null` cuando no fueron reportados.

## Compatibilidad historica

- Los registros anteriores continúan leyéndose desde `meals` sin cambios.
- Los registros nuevos se crean primero como snapshot nutricional y también como espejo legacy, en una sola transacción.
- `nutrition_meal_logs.legacy_meal_id` y `nutrition_meal_log_items.legacy_meal_ingredient_id` evitan duplicidad lógica.
- No se reasignan IDs legacy ni se modifica historial existente.
- `client_request_id` implementa idempotencia para reintentos del botón de guardar.

## Seguridad de datos

- El RPC de escritura exige `auth.uid()` y valida propiedad para alimentos de alcance de usuario.
- La selección de grupo, variante y porción se comprueba por sus relaciones reales.
- El cliente no envía calorías ni macros para persistir.
- La función usa `SECURITY DEFINER` con `search_path = public` fijo.
- `PUBLIC` no recibe ejecución; solo `authenticated` puede invocar las RPCs.
- Cantidad, fecha y tipo de comida se validan en servidor.
- El guardado en tablas nuevas y legacy es atómico.
- No se exponen mensajes SQL directos en la UI.

## Tipos Supabase

Se intentó el comando oficial:

```powershell
npx supabase gen types --linked --lang typescript --schema public
```

La CLI respondió `Unauthorized`, por lo que no se alteró manualmente el archivo generado `src/integrations/supabase/types.ts`. Se agregó `nutrition-types.ts` como contrato suplementario exacto y sin `as any` para que la integración quede tipada mientras se autoriza la CLI.

Después de aplicar la migración y autenticar la CLI, regenerar el archivo oficial con:

```powershell
supabase login
supabase link --project-ref jgiynxqixslimrrpaopk
supabase gen types --linked --lang typescript --schema public | Set-Content -Encoding utf8 src/integrations/supabase/types.ts
```

## Rendimiento

- Primera carga: 1 RPC, 24 tarjetas escalares, sin arrays de nutrientes o porciones.
- Página adicional: 1 RPC por bloque de 24.
- Búsqueda: 1 RPC después de 300 ms sin pulsaciones nuevas.
- Selección: 1 RPC con las relaciones del grupo elegido.
- Registro: 1 RPC transaccional.
- No hay consultas por tarjeta ni patrón N+1.
- React Query conserva páginas 5 minutos y detalles 10 minutos para evitar recargas al volver dentro del mismo modal.
- El tiempo y bytes reales deben medirse en Network después del despliegue, porque la migración aún no está aplicada en el proyecto remoto.

## Revision por fases

- Fase 1: flujo, tablas, causa y riesgos documentados.
- Fase 2: solo grupos/miembros/alimentos visibles y estados activos.
- Fase 3: contratos tipados agregados; regeneración oficial pendiente de sesión CLI.
- Fase 4: acceso centralizado en servicio y hooks.
- Fase 5: infinite scroll, dedupe y estados de lista.
- Fase 6: búsqueda global, debounce y separación de respuestas.
- Fase 7: ranking determinista en servidor.
- Fase 8: presentación por grupo canónico real.
- Fase 9: selector de variantes y preparaciones naturales.
- Fase 10: porciones vinculadas y cantidades decimales.
- Fase 11: cálculo por equivalencias almacenadas y `null` preservado.
- Fase 12: registro con IDs concretos y snapshots.
- Fase 13: espejo legacy no destructivo.
- Fase 14: carga, error, vacío, fin, sin variantes y sin porciones.
- Fase 15: carga incremental, caché simple y cero N+1.
- Fase 16: foco, labels, teclado, roles, disabled y mensajes asociados.
- Fase 17: 30 pruebas locales y SQL remoto preparados.

## Pendientes antes del cierre

1. Aplicar la migración en Supabase.
2. Ejecutar el SQL de validación y confirmar cero filas `critical`.
3. Regenerar tipos oficiales con una sesión válida de Supabase CLI.
4. Probar el flujo autenticado contra datos reales y capturar latencia/bytes.
5. El chequeo TypeScript global encuentra errores preexistentes fuera del alcance del sprint; están listados en el documento de validación.

