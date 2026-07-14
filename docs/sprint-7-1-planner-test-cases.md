# Sprint 7.1 - Casos de validacion del planner

## Caso A

Principiante, 3 dias, gimnasio, hipertrofia, 60 min, sin restricciones.

Esperado: full body o split apropiado, exactamente 3 workouts, frecuencia razonable y sin ejercicios avanzados.

Estado: cubierto en `supabase/functions/_shared/trainingPlanner.test.ts`.

## Caso B

Intermedio, 5 dias, gimnasio, hipertrofia, 75 min.

Esperado: split coherente, volumen distribuido, jalon horizontal + vertical y piernas balanceadas.

Estado: cubierto en test Deno.

## Caso C

Principiante, 3 dias, casa, 45 min.

Esperado: sin maquinas, poleas, prensa ni cardio machines.

Estado: cubierto en test Deno.

## Caso D

Intermedio, 4 dias, calistenia, 60 min.

Esperado: predominio peso corporal, sin prensa/poleas, sin skills avanzadas como relleno.

Estado: cubierto en test Deno.

## Caso E

Intermedio, 5 dias, gimnasio, restriccion hombro.

Esperado: evitar ejercicios contraindicados, mantener plan entrenable y devolver warnings.

Estado: cubierto en test Deno.

## Caso F

Intermedio, 4 dias, gimnasio, rodilla + lumbar.

Esperado: aplicar ambas restricciones y mantener 4 workouts en dias seleccionados.

Estado: cubierto en test Deno.

## Caso G

Usuario con 7 dias seleccionados.

Esperado: 6 workouts maximo, 1 descanso completo, descanso sin volumen, explicacion visible, no hardcodear domingo.

Estado: cubierto en test Deno y en UI con `rest_day`.

## Caso H

Usuario con plan IA/manual protegido.

Esperado: planner no reemplaza plan silenciosamente.

Estado: validacion documental y SQL. Los flujos actuales solo borran workouts automaticos incompletos en endpoints de generacion/asignacion; si Supabase tiene columnas de origen/proteccion, ejecutar el SQL de Sprint 7.1 para detectar reemplazos sospechosos.

## Caso I

Usuario con 6 dias seleccionados.

Esperado: hasta 6 workouts y no insertar descanso adicional dentro de los dias seleccionados.

Estado: cubierto en test Deno.
