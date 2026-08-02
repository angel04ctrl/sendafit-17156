# Beta Exercise Sprint 1 - Instrucciones para agente especialista

## Contexto

Recibiras un CSV exportado desde `public.exercises` de SendaFit. Tu trabajo es hacer curaduria profesional de la biblioteca de ejercicios: revisar nombres, tecnica, variantes, compatibilidad por equipo, nivel, patrones de movimiento, instrucciones y posibles duplicados.

## Reglas estrictas

- NO cambies el schema.
- NO borres IDs existentes.
- NO reemplaces toda la tabla.
- NO inventes imagenes o videos.
- NO agregues imagenes/videos sin licencia clara.
- NO copies texto largo de internet. Escribe contenido original y conciso.
- NO elimines ejercicios existentes; si algo debe retirarse, marcalo como `deprecate_review`.

## Entrega requerida

Devuelve un CSV de parche, no una tabla completa reemplazada.

El CSV debe incluir una columna `action` con uno de estos valores:

- `update`: corregir o mejorar un ejercicio existente.
- `insert`: proponer un ejercicio faltante.
- `deprecate_review`: marcar un ejercicio existente como duplicado, ambiguo, inseguro o mal definido para revision humana.

## Reglas para IDs

- Para `update` y `deprecate_review`, conserva exactamente el `id` original.
- Para `insert`, propone un `id` estable, en minusculas, legible y sin espacios. Ejemplo: `sf-chest-machine-press`.
- No cambies IDs solo por estilo.

## Campos editoriales esperados

Cuando propongas cambios, prioriza:

- `nombre`: nombre principal visible en español.
- `aliases`: nombres alternativos, incluyendo ingles y variantes comunes.
- `nivel` y `nivel_minimo`: principiante, intermedio o avanzado.
- `grupo_muscular`.
- `musculo_principal`.
- `musculos_secundarios`.
- `equipamiento`.
- `equipo_requerido`.
- `tipo_entrenamiento`.
- `patron_movimiento`.
- `descripcion`.
- `instrucciones`.
- `cues_tecnicos`.
- `errores_comunes`.
- `contraindicaciones`.
- `sustituciones`.
- `progresiones`.
- `regresiones`.
- `lugar`.
- `objetivo`.
- `series_sugeridas`.
- `repeticiones_sugeridas`.
- `rango_reps_min`.
- `rango_reps_max`.
- `descanso_segundos_min`.
- `descanso_segundos_max`.
- `rir_recomendado`.
- `duracion_promedio_segundos`.
- `maquina_gym`.
- `estado_calidad`.

## Criterios de investigacion

Investiga con criterio profesional:

- Maquinas reales de gimnasio y sus nombres comunes.
- Variantes por equipo: barra, mancuernas, polea, maquina, banda, peso corporal.
- Variantes por patron: empuje horizontal, empuje vertical, jalon horizontal, jalon vertical, bisagra, sentadilla, zancada, anti-extension, anti-rotacion, flexion/extension de codo, etc.
- Compatibilidad por nivel del usuario.
- Contraindicaciones razonables: dolor articular, lesion, movilidad limitada, molestias lumbares/cervicales.
- Sustituciones equivalentes por musculo principal, patron y equipo disponible.

## Formato de arrays

Para campos array en CSV, usa JSON array valido:

```json
["opcion 1","opcion 2","opcion 3"]
```

No uses texto separado por comas si el campo es array.

## Calidad de contenido

- Instrucciones: 4 a 6 pasos claros.
- Cues tecnicos: 3 a 5 frases cortas.
- Errores comunes: 3 a 5 errores reales.
- Sustituciones: 2 a 5 alternativas utiles.
- Contraindicaciones: practica, prudente y no alarmista.
- Descripcion: original, especifica y no generica.

## Fuentes

Lista fuentes o referencias consultadas al final de tu entrega. Pueden ser referencias generales, manuales, fabricantes de maquinas, guias tecnicas o recursos de entrenamiento reconocidos.

No pegues parrafos largos de fuentes externas.

## Criterio final

El objetivo no es tener mas ejercicios por tener mas ejercicios. El objetivo es que SendaFit tenga una biblioteca practica, segura, consistente y util para generar rutinas y sustituciones sin romper el objetivo del entrenamiento.
