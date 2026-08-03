# Beta Nutrition Sprint 2 - Validacion

Fecha: 2026-08-03

## Estado actual

La implementación local está completa. El cierre remoto permanece pendiente hasta aplicar la migración y ejecutar `beta-nutrition-sprint-2-validation.sql` con cero resultados `critical`.

## Pruebas automatizadas

Comando:

```powershell
npm test -- --run src/services/nutritionCatalog.test.ts src/hooks/useNutritionCatalog.test.tsx src/components/nutrition/NutritionFoodSelector.test.tsx
```

Resultado:

- 3 archivos del Sprint 2 aprobados.
- 30 pruebas del Sprint 2 aprobadas.
- Suite completa del repositorio: 4 archivos y 32 pruebas aprobadas.
- 0 pruebas fallidas.

Cobertura funcional automatizada:

- cálculo por 100 g y por equivalencia registrada;
- cantidades decimales;
- equivalencias de gramos y mililitros;
- nutrientes opcionales `null`;
- límites de cantidad;
- porciones sin equivalencia;
- alimentos sin macros principales;
- paginación superior al límite legacy;
- consulta global de búsqueda;
- validación runtime de variantes;
- persistencia de IDs e idempotencia;
- sanitización de errores;
- debounce y temporizadores obsoletos;
- carga, vacío, error, reintento, dedupe e infinite scroll de UI;
- buscador accesible y contador total.

## Matriz de los 30 escenarios

| # | Escenario | Cobertura |
|---|---|---|
| 1 | Al abrir aparecen alimentos | Automatizada UI |
| 2 | Scroll supera 8-9 | Automatizada UI/RPC |
| 3 | Recorrer catálogo completo | Paginación automatizada; recorrido remoto pendiente |
| 4 | Sin duplicados | Automatizada UI |
| 5 | Excluir deprecated/invisibles | SQL de validación/remoto pendiente |
| 6 | Buscar huevo | SQL/RPC remoto pendiente |
| 7 | Buscar por alias | SQL/RPC remoto pendiente |
| 8 | Con y sin acento | Función SQL preparada; remoto pendiente |
| 9 | Sin resultados | Automatizada UI |
| 10 | Respuesta anterior no sobrescribe | Automatizada debounce/query key |
| 11 | Huevo muestra variantes reales | RPC detalle/remoto pendiente |
| 12 | Variante no vinculada no aparece | Constraint de RPC/SQL pendiente |
| 13 | Default seleccionado | Implementado; prueba real pendiente |
| 14 | Códigos internos traducidos | Implementado con nombres de catálogo |
| 15 | Cambiar porción recalcula | Automatizada cálculo |
| 16 | Cambiar cantidad recalcula | Automatizada cálculo decimal |
| 17 | Cero/negativa bloqueados | Automatizada |
| 18 | Líquidos usan unidades | Automatizada cálculo; datos reales pendientes |
| 19 | Una porción default | SQL de validación/remoto pendiente |
| 20 | Registro conserva food_id | Automatizada contrato; RPC remoto pendiente |
| 21 | Registro conserva serving_id | Automatizada contrato; RPC remoto pendiente |
| 22 | Cantidad y equivalencia | Automatizada y almacenada por RPC |
| 23 | Persistido coincide con preview | Misma fórmula; smoke remoto pendiente |
| 24 | Aparece en la comida | Espejo legacy implementado; remoto pendiente |
| 25 | Historial legacy visible | Lectura legacy sin cambios; regresión manual pendiente |
| 26 | Ejercicios intactos | Build aprobada; no se tocaron módulos fitness |
| 27 | Autenticación intacta | No modificada; prueba manual pendiente |
| 28 | Perfiles intactos | No se modifica `profiles` |
| 29 | Tablas legacy conservadas | Migración aditiva y validación SQL |
| 30 | Sin errores TypeScript | Cambios nuevos sin error; baseline global tiene errores previos |

## SQL remoto

Ejecutar `docs/beta-nutrition-sprint-2-validation.sql`. La salida está diseñada para interpretarse así:

- `critical`: bloquea el cierre. Debe haber cero filas.
- `warning`: dato utilizable que necesita revisión editorial.
- `info`: métricas; no bloquea.

El SQL comprueba schema, firmas y permisos RPC, normalización de acentos, tamaño inicial, estados visibles, grupos, defaults, porciones calculables, macros principales, duplicados, trazabilidad, espejo legacy, huérfanos y mojibake.

## Build y calidad

```powershell
npm run build
```

Resultado final local: aprobado, 3505 módulos transformados, build de producción y service worker PWA generados.

```powershell
npx eslint src/pages/Macros.tsx src/services/nutritionCatalog.ts src/services/nutritionCatalog.test.ts src/hooks/useNutritionCatalog.ts src/hooks/useNutritionCatalog.test.tsx src/components/nutrition/NutritionFoodSelector.tsx src/components/nutrition/NutritionFoodSelector.test.tsx src/integrations/supabase/nutrition-types.ts
```

Resultado final: cero errores. Permanecen cuatro advertencias `any` heredadas de `Macros.tsx`; los archivos nuevos no agregan advertencias.

## TypeScript global

El `tsconfig.app.json` contiene `ignoreDeprecations: "6.0"`, no aceptado por TypeScript 5.8. Al ejecutar con override compatible aparecen errores preexistentes en:

- `ActiveWorkout.tsx`
- `FoodAnalysisModal.tsx`
- `ExerciseDetailModal.tsx`
- `CoachChat.tsx`
- `Profile.tsx`

No pertenecen al flujo nutricional nuevo y no se corrigieron para respetar el alcance. La build Vite sí transpila correctamente. Este baseline impide afirmar todavía el criterio global “0 errores TypeScript”.

## UTF-8

- Los archivos nuevos se guardaron en UTF-8.
- No se encontraron patrones `Ã`, `Â`, `â€` o `�` en los archivos del Sprint 2.
- Las pruebas incluyen texto como `salmón`, `proteína` y `Sólido`.
- El SQL remoto comprueba nombres, grupos, aliases y porciones.
- Existe mojibake preexistente fuera del sprint en dos mensajes de `OnboardingForm.tsx`; no se modificó ese módulo para mantener el alcance.

## Prueba manual posterior al despliegue

1. Iniciar sesión y abrir Macros > Registrar comida > Base de Datos.
2. Confirmar que aparecen más de nueve grupos al desplazarse.
3. Buscar `huevo`, un alias regional y un nombre sin acento.
4. Abrir un grupo con varias preparaciones.
5. Cambiar variante, porción y cantidad decimal.
6. Confirmar que preview y registro coinciden.
7. Recargar la página y verificar el registro.
8. Abrir historial y confirmar que registros anteriores siguen visibles.
9. Repetir una solicitud con la misma clave solo mediante prueba técnica y confirmar que no duplica.
10. En DevTools Network registrar primera carga, búsqueda, bytes y número de requests.

## Decisión

`IMPLEMENTACIÓN LISTA, PENDIENTE DE PRUEBAS O CREDENCIALES`
