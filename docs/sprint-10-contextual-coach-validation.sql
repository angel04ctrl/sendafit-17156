-- Sprint 10 - Validacion de Coach IA contextual y seguro.
-- Ejecutar en Supabase SQL Editor despues de aplicar 20260714020000
-- y desplegar coach-chat / apply-ai-routine.
-- Resultado esperado para cierre: 0 filas critical.

WITH conversation_scope AS (
  SELECT
    id AS conversation_id,
    user_id,
    conversation_type,
    user_message,
    assistant_message,
    context_used,
    model_used,
    intent_type,
    safety_flags,
    generated_content,
    created_at
  FROM public.ai_trainer_conversations
  WHERE created_at >= CURRENT_DATE - INTERVAL '14 days'
),
action_scope AS (
  SELECT
    id AS action_id,
    user_id,
    conversation_id,
    action_type,
    status,
    preview,
    payload,
    validation_result,
    created_at,
    confirmed_at,
    applied_at
  FROM public.coach_actions
  WHERE created_at >= CURRENT_DATE - INTERVAL '14 days'
)
SELECT 'critical' AS severity, 'conversation_missing_core_audit_fields' AS check_name,
       user_id, conversation_id, NULL::uuid AS action_id,
       CONCAT('intent=', intent_type, ', model=', model_used) AS details
FROM conversation_scope
WHERE user_message IS NULL
   OR assistant_message IS NULL
   OR model_used IS NULL
   OR intent_type IS NULL

UNION ALL
SELECT 'critical', 'conversation_missing_context_used',
       user_id, conversation_id, NULL::uuid,
       context_used::text
FROM conversation_scope
WHERE context_used IS NULL
   OR context_used = '{}'::jsonb

UNION ALL
SELECT 'critical', 'invalid_conversation_intent',
       user_id, conversation_id, NULL::uuid,
       intent_type
FROM conversation_scope
WHERE intent_type NOT IN ('entrenamiento', 'nutricion', 'lesion', 'rutina', 'motivacion', 'fuera_de_alcance')

UNION ALL
SELECT 'critical', 'routine_generated_without_pending_action',
       c.user_id, c.conversation_id, NULL::uuid,
       c.generated_content::text
FROM conversation_scope c
WHERE c.generated_content ? 'metadata_routine'
  AND NOT EXISTS (
    SELECT 1
    FROM action_scope a
    WHERE a.conversation_id = c.conversation_id
      AND a.action_type = 'modify_routine'
  )

UNION ALL
SELECT 'critical', 'pending_action_missing_payload_or_preview',
       user_id, conversation_id, action_id,
       CONCAT('type=', action_type, ', status=', status)
FROM action_scope
WHERE status = 'pending'
  AND (preview IS NULL OR preview = '{}'::jsonb OR payload IS NULL OR payload = '{}'::jsonb)

UNION ALL
SELECT 'critical', 'applied_action_missing_timestamps',
       user_id, conversation_id, action_id,
       CONCAT('confirmed=', confirmed_at, ', applied=', applied_at)
FROM action_scope
WHERE status = 'applied'
  AND (confirmed_at IS NULL OR applied_at IS NULL)

UNION ALL
SELECT 'warning', 'safety_conversation_without_flags',
       user_id, conversation_id, NULL::uuid,
       user_message
FROM conversation_scope
WHERE intent_type = 'lesion'
  AND COALESCE(cardinality(safety_flags), 0) = 0

UNION ALL
SELECT 'info', 'conversation_intent_counts',
       NULL::uuid, NULL::uuid, NULL::uuid,
       CONCAT(intent_type, '=', COUNT(*))
FROM conversation_scope
GROUP BY intent_type

UNION ALL
SELECT 'info', 'coach_action_status_counts',
       NULL::uuid, NULL::uuid, NULL::uuid,
       CONCAT(action_type, '/', status, '=', COUNT(*))
FROM action_scope
GROUP BY action_type, status

ORDER BY severity, check_name, user_id, conversation_id, action_id;
