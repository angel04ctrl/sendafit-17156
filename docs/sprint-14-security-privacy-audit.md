# Sprint 14 - Auditoria de seguridad y privacidad

## Alcance aplicado

- Todas las funciones IA actuales validan usuario autenticado antes de procesar.
- `coach-chat`, `analyze-food`, `analyze-meal`, `analyze-machine` y `apply-ai-routine` tienen rate limits mediante `public.check_ai_rate_limit`.
- Las funciones que usan `service_role` conservan filtros por `user_id` para recursos privados.
- El coach minimiza contexto sensible: no manda ni persiste medicamentos actuales ni condiciones de salud generales en `context_used`.
- Las superficies IA muestran aviso/consentimiento antes de enviar fotos o mensajes al proveedor IA.
- Se agrego `public.delete_my_ai_data()` para borrado explicito de historial IA del usuario autenticado.

## Retencion y borrado

`public.delete_my_ai_data()` borra, para `auth.uid()`:

- `coach_actions`
- `ai_trainer_conversations`
- `machine_exercise_favorites`
- `machine_scan_history`
- `ai_function_usage`

Nota: las imagenes en Storage pueden requerir politica lifecycle del bucket o limpieza por job separado, porque SQL no elimina objetos de Storage.

## Datos sensibles

Campos revisados:

- condiciones de salud
- medicamentos
- lesiones/limitaciones
- alergias/restricciones
- ciclo menstrual

La app aun conserva campos en texto plano y columnas cifradas por compatibilidad con pantallas existentes. No se eliminaron automaticamente para no romper perfil, onboarding ni planificacion. La validacion marca estos casos como `warning` para decidir una migracion posterior de minimizacion definitiva.

## Pruebas manuales recomendadas

- Usuario A intenta mover/saltar/completar workout de Usuario B: debe fallar.
- Usuario A intenta aplicar `coach_action_id` de Usuario B: debe devolver `coach_action_not_found`.
- Enviar mensaje con dolor fuerte al coach: debe responder con aviso de detener actividad y consultar profesional.
- Intentar usar comida/maquina sin aceptar aviso: el boton IA debe estar deshabilitado.
- Superar cuota de IA: debe devolver HTTP 429 con mensaje de limite.
