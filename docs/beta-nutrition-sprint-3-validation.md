# Beta Nutrition Sprint 3 - Validación

## Orden de ejecución

1. Ejecutar `supabase/migrations/20260803030000_beta_nutrition_sprint3_recipes.sql` en Supabase SQL Editor.
2. Ejecutar `docs/beta-nutrition-sprint-3-validation.sql`.
3. Confirmar que no existe ninguna fila `severity = critical`.
4. Probar crear, editar, duplicar, archivar y registrar 0.5 porciones desde Macros.

No hay Edge Functions nuevas ni funciones existentes que desplegar.

## Qué valida el SQL

- identidad y versión actual publicada;
- versiones, ingredientes, pasos y nutrientes sin huérfanos;
- variante, grupo y porción consistentes;
- cantidades, equivalencias y snapshots;
- orden único de ingredientes y pasos;
- totales, valores por porción y por 100 g;
- coincidencia entre nutrientes guardados y snapshots de ingredientes;
- estado de cálculo completo/incompleto;
- fuente exacta food/recipe;
- versión y snapshot en registros de receta;
- un solo ítem nutricional y legacy por registro;
- RLS, policies SELECT, revocación de escritura y grants de RPC;
- `search_path` fijo en funciones privilegiadas;
- encoding UTF-8 y patrones de mojibake.

## Interpretación

- `critical`: bloquea la aprobación; no avanzar al Sprint 4.
- `warning`: requiere revisión, pero puede ser esperado. Las recetas legacy incompletas o atributos dietéticos sin evidencia se reportan aquí para no presentarlos como exactos.
- `info`: conteos y contexto.

El resultado remoto es la autoridad para aprobar. La compilación y las pruebas locales no sustituyen la ejecución de la migración ni la validación RLS en Supabase.

## Prueba manual mínima

1. Abrir Macros y Recetas.
2. Buscar una receta y comprobar paginación/estado vacío.
3. Crear una receta con dos variantes verificadas, cantidades decimales y dos pasos.
4. Confirmar total y valor por porción; indicar peso final y confirmar valor por 100 g.
5. Registrar 0.5 porciones y verificar que el total diario aumenta una sola vez.
6. Editar la receta y confirmar versión N+1.
7. Abrir el registro anterior y confirmar que conserva versión y macros anteriores.
8. Duplicar y archivar; confirmar que el historial sigue visible.
9. Iniciar sesión con otro usuario y confirmar que no puede buscar ni abrir la receta privada.

## Rollback

`docs/beta-nutrition-sprint-3-rollback.sql` solo sirve antes de crear/editar recetas o registrar consumo. Tiene guardas que abortan si detecta datos de Sprint 3. Después de uso real, corregir con una migración hacia delante; no eliminar versiones ni historial.

## Estado local

Validaciones ejecutadas localmente:

- `npx tsc --noEmit`: correcto.
- `npx vitest run`: correcto, 52 pruebas pasaron.
- `npm run build`: correcto, build PWA generada.
- `npm run lint`: correcto, sin errores; quedan warnings existentes del repositorio.
- Migracion Sprint 3 + validacion SQL en transaccion local: correcta, 0 filas `critical`.
- Prueba funcional SQL transaccional: crear receta, registrar 0.5 porciones, editar version, duplicar, archivar, validar snapshot historico y bloquear acceso cruzado entre usuarios.

La aprobacion definitiva queda pendiente hasta que la migracion y `docs/beta-nutrition-sprint-3-validation.sql` se ejecuten en Supabase remoto y devuelvan cero `critical`.
