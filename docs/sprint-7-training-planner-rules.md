# Sprint 7.1 - Reglas del motor profesional de planificacion

## Alcance

Este documento endurece el planner automatico de Sprint 7 sin avanzar a sustitucion inteligente, Coach avanzado, calendario adaptativo ni reportes.

## Dias seleccionados y descanso

- Si el usuario selecciona 1 a 6 dias, esos dias son los unicos dias con entrenamiento programado. Los dias no seleccionados ya son dias sin entrenamiento.
- Si el usuario selecciona los 7 dias, el planner reserva 1 dia completo de descanso y programa como maximo 6 workouts.
- El descanso obligatorio no contiene ejercicios, cardio, movilidad formal, series, repeticiones ni volumen muscular.
- La regla vive en `MAX_WEEKLY_TRAINING_DAYS`, `requiresMandatoryRestDay` y `selectRestDay`.

## Estrategia de splits

- 1 dia: full body.
- 2 dias: full body A/B.
- 3 dias: full body A/B/C para principiantes o PPL basico para niveles compatibles.
- 4 dias: torso/pierna frecuencia 2.
- 5 dias: PPL + torso/pierna.
- 6 dias: PPL frecuencia 2.
- 7 dias disponibles: se usa un split de 6 dias y se reserva descanso.

## Seleccion del dia de descanso

Para 7 dias disponibles, el descanso no se hardcodea a domingo. El selector prioriza cortar cadenas largas de sesiones exigentes. En principiantes/intermedios o metas de fuerza/masa se favorece un descanso a mitad de semana, con orden conservador: jueves, viernes, miercoles, sabado, martes, domingo, lunes.

## Volumen semanal

El volumen no parte solo de la duracion. La secuencia conceptual es:

1. Determinar necesidad por nivel y objetivo.
2. Elegir frecuencia y split.
3. Distribuir patrones y grupos musculares por sesion.
4. Seleccionar ejercicios compatibles.
5. Estimar duracion por series, reps, descanso, cambios y calentamiento.
6. Ajustar cantidad de ejercicios de forma conservadora al tiempo disponible.

Estados actuales:

- Bajo: menos de 6 series equivalentes semanales.
- Adecuado: 6 a 20 series equivalentes semanales.
- Alto: mas de 20 series equivalentes semanales.

## Series directas e indirectas

Constantes explicitas:

- `DIRECT_SET_WEIGHT = 1`
- `INDIRECT_SET_WEIGHT = 0.5`

Un ejercicio cuenta sus series sugeridas como directas para `musculo_principal`. Cada musculo unico en `musculos_secundarios` suma media serie equivalente por cada serie del ejercicio. Si un musculo aparece como principal y secundario en el mismo ejercicio, se cuenta solo como directo. Los ejercicios cardio no suman volumen muscular de fuerza/hipertrofia.

## Metadata usada de Sprint 6

La seleccion usa:

- `musculo_principal`
- `musculos_secundarios`
- `patron_movimiento`
- `equipo_requerido`
- `nivel_minimo`
- `tipo_entrenamiento`
- `contraindicaciones`
- `estado_calidad`

`grupo_muscular` queda como apoyo, no como unica fuente. Cardio no debe cubrir volumen de fuerza aunque tenga musculos secundarios de espalda o piernas.

## Balance de patrones

El planner intenta cubrir patrones minimos por slot:

- Espalda/jalon: jalon vertical y jalon horizontal.
- Piernas/gluteos: sentadilla, bisagra y flexion de rodilla cuando hay catalogo compatible.
- Pecho/empuje: empuje horizontal y empuje vertical.

Tambien penaliza repetir el mismo patron cuando ya fue seleccionado en la sesion.

## Orden de sesion

Los ejercicios se ordenan de forma deterministica:

1. potencia/habilidad tecnica si aplica,
2. compuestos principales por patron,
3. unilateral,
4. accesorios,
5. aislamientos,
6. core,
7. cardio.

No se usa aleatoriedad.

## Restricciones

Las restricciones se detectan de `health_conditions`, `lesiones_activas` e `injuries_limitations`. Se soportan multiples restricciones simultaneas: rodilla, lumbar y hombro. El planner:

- excluye ejercicios con contraindicaciones directas,
- evita patrones evidentemente incompatibles,
- conserva grupos musculares cuando hay alternativas,
- agrega advertencias no medicas.

## Equipo disponible

La app hoy guarda modos amplios (`casa`, `gimnasio`, `calistenia`) y no un inventario exacto de equipo. Por eso:

- Casa: prioriza peso corporal, mancuernas, bandas, kettlebells, banco, cuerda y elementos simples.
- Gimnasio: permite equipamiento de gimnasio, excluyendo piscina/pista por no pertenecer al planner de fuerza.
- Calistenia: prioriza peso corporal, barra de dominadas, paralelas, banco y caja; bloquea maquinas, poleas, discos y cardio machines.

Limitacion pendiente: en futuro conviene preguntar equipo especifico disponible.

Deuda tecnica futura: `user_equipment_inventory`.

## Proteccion de planes

Sprint 7.1 no debe reemplazar silenciosamente planes manuales, personalizados, premium o Coach IA. Los Edge Functions modificados crean o reemplazan solo workouts `tipo = automatico` incompletos dentro de flujos explicitos de asignacion/generacion. La validacion SQL incluye checks para detectar reemplazos sospechosos si existen columnas de origen/proteccion en la base.

## Duracion estimada

`estimateWorkoutDuration` suma:

- calentamiento base de 6 minutos,
- trabajo por series y repeticiones,
- descanso entre series,
- 2 minutos por cambio entre ejercicios.

El objetivo es evitar que una sesion de 45-60 minutos se convierta rutinariamente en una sesion de 80 minutos.
