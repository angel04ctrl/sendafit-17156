# Sprint 1.1 - Coach IA con contexto conversacional

Checklist manual para cerrar el sprint:

## Caso A - Cambiar distribucion por dia

1. Pedir: `Hazme un plan de entrenamiento de tres dias, lunes, miercoles y viernes, con duracion de dos horas cada dia y enfocado en hipertrofia para ganar masa muscular.`
2. Confirmar que aparece una vista previa.
3. Enviar: `Quiero que lunes sea brazos, miercoles espalda y viernes pierna.`
4. Esperado:
   - El Coach toma como referencia la rutina pendiente.
   - Devuelve una nueva vista previa completa.
   - No responde con mensaje generico de capacidades.

## Caso B - Cambiar ejercicio especifico

1. Con una rutina pendiente, pedir: `Cambia ese ejercicio por otra opcion.`
2. Esperado:
   - Si el contexto es ambiguo, pide una aclaracion concreta.
   - Si el ejercicio queda claro en el mensaje, devuelve sustitucion validada.
   - La nueva vista previa mantiene ejercicios resolubles por catalogo.

## Caso C - Aplicar por texto

1. Con una rutina pendiente validada, enviar: `Aplicala.`
2. Esperado:
   - El Coach responde que aplicara la rutina pendiente.
   - El frontend llama a `apply-ai-routine` con el `coach_action_id`.
   - La rutina solo se aplica si el action sigue pendiente/confirmado y el catalogo valida ejercicios.

## Caso D - Volver version anterior

1. Crear una rutina.
2. Pedir un cambio para generar otra vista previa.
3. Enviar: `No, mejor dejalo como antes.`
4. Esperado:
   - Si existe una version anterior guardada, se restaura como nueva vista previa.
   - Si no existe, pide instrucciones concretas.

## Caso E - Sin draft activo

1. Abrir una conversacion nueva sin rutina pendiente.
2. Enviar: `Cambia el lunes por brazos.`
3. Esperado:
   - El Coach no inventa contexto.
   - Pide crear o indicar la rutina a ajustar.

## Caso F - Refresh

1. Crear una vista previa de rutina.
2. Refrescar la pagina.
3. Enviar: `Haz que miercoles sea espalda.`
4. Esperado:
   - El draft pendiente se recupera desde `coach_actions`.
   - La respuesta modifica la rutina pendiente.

## Validaciones tecnicas

- `coach_actions.preview` y `coach_actions.payload.metadata_routine` guardan el draft.
- Al crear una nueva version del draft, los drafts pendientes anteriores pasan a `expired`.
- `apply-ai-routine` puede aplicar con `coach_action_id` aunque el frontend no envie `metadata_routine`.
- No se aplican rutinas con ejercicios sin resolver.
