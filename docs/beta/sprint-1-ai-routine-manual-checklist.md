# Sprint Beta 1 - Coach IA rutina aplicable

## Causa raiz

El Coach generaba una rutina con nombres comunes, pero la validacion solo aceptaba coincidencias exactas contra `nombre` o `aliases`. Eso hacia fallar previews utiles por frases normales como "press de triceps en polea", "dominadas asistidas" o typos leves como "mancuerda".

Ademas, `coach-chat` y `apply-ai-routine` tenian resolucion separada, lo que podia permitir que el preview y la aplicacion se comportaran distinto.

## Cambios esperados

- Resolver nombres por nombre canonico, aliases, normalizacion de acentos y typos leves.
- Resolver nombres comunes a ejercicios del catalogo.
- Crear "Dominadas asistidas" como ejercicio curado si no existe.
- No usar ejercicios `deprecado` o `revisar`.
- No aplicar nada sin preview valido.
- Mostrar al usuario cuando se usaron equivalentes disponibles.
- Usar la misma logica de resolucion en preview y aplicacion.

## Prueba manual obligatoria

Pedir exactamente al Coach:

> Haz un plan de entrenamiento de tres dias, lunes, miercoles y viernes, con duracion de dos horas cada dia y concentrado en hipertrofia para aumentar masa muscular.

Resultado esperado:

- El Coach devuelve una vista previa valida.
- La vista previa tiene 3 dias.
- Los dias son lunes, miercoles y viernes.
- El objetivo es hipertrofia/aumento de masa.
- La duracion por dia es cercana a 120 minutos.
- Cada ejercicio se resuelve a un `exercise_id` al aplicar.
- Si usa equivalentes, el mensaje lo explica.
- La app muestra opcion clara para aplicar.

## Casos de resolucion cubiertos

- `fondos en paralelas` -> `Fondos en paralelas para pecho`
- `press de triceps en polea` -> `Pushdown de triceps en polea`
- `extension de triceps con mancuerna sobre la cabeza` -> `Extension de triceps por encima de la cabeza con mancuerna`
- `dominadas asistidas` -> `Dominadas asistidas`
- `press inclinado con mancuernas` -> `Press inclinado con mancuernas`
- `press inclinado con mancuerdas` -> `Press inclinado con mancuernas`

## Validacion tecnica

- Aplicar migracion `20260722010000_beta_sprint1_ai_routine_exercise_resolution.sql`.
- Ejecutar `docs/beta/sprint-1-ai-routine-resolution-validation.sql`.
- Ejecutar `deno check --no-lock` en `coach-chat` y `apply-ai-routine`.
- Ejecutar `npm run build`.
- Ejecutar `git diff --check`.
