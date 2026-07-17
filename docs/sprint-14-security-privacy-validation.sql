-- Sprint 14 - Validacion de seguridad, privacidad y limites IA.
-- Ejecutar en Supabase SQL Editor despues de aplicar 20260716010000
-- y desplegar funciones IA actualizadas.
-- Resultado esperado para cierre: 0 filas critical.

WITH function_usage_scope AS (
  SELECT
    user_id,
    function_name,
    COUNT(*) FILTER (WHERE created_at > now() - interval '1 hour') AS last_hour,
    COUNT(*) FILTER (WHERE created_at > now() - interval '1 day') AS last_day
  FROM public.ai_function_usage
  WHERE created_at > now() - interval '1 day'
  GROUP BY user_id, function_name
),
conversation_scope AS (
  SELECT
    id,
    user_id,
    intent_type,
    safety_flags,
    user_message,
    assistant_message,
    context_used
  FROM public.ai_trainer_conversations
  WHERE created_at > now() - interval '30 days'
),
sensitive_profile_scope AS (
  SELECT
    id AS user_id,
    health_conditions,
    health_conditions_encrypted,
    current_medications,
    current_medications_encrypted,
    injuries_limitations,
    injuries_limitations_encrypted,
    allergies_restrictions,
    allergies_restrictions_encrypted,
    ai_consent_accepted,
    ai_consent_accepted_at
  FROM public.profiles
)
SELECT 'critical' AS severity, 'ai_usage_unknown_function' AS check_name,
       user_id, function_name AS subject,
       CONCAT('hour=', last_hour, ', day=', last_day) AS details
FROM function_usage_scope
WHERE function_name NOT IN ('coach-chat', 'analyze-food', 'analyze-meal', 'analyze-machine', 'apply-ai-routine')

UNION ALL
SELECT 'critical', 'ai_usage_rate_limit_exceeded_observed',
       user_id, function_name,
       CONCAT('hour=', last_hour, ', day=', last_day)
FROM function_usage_scope
WHERE (function_name = 'coach-chat' AND (last_hour > 20 OR last_day > 80))
   OR (function_name IN ('analyze-food', 'analyze-meal') AND (last_hour > 8 OR last_day > 30))
   OR (function_name = 'analyze-machine' AND (last_hour > 5 OR last_day > 20))
   OR (function_name = 'apply-ai-routine' AND (last_hour > 4 OR last_day > 12))

UNION ALL
SELECT 'critical', 'lesion_conversation_missing_safety_flags',
       user_id, id::text,
       LEFT(user_message, 160)
FROM conversation_scope
WHERE intent_type = 'lesion'
  AND COALESCE(cardinality(safety_flags), 0) = 0

UNION ALL
SELECT 'warning', 'sensitive_plain_and_encrypted_duplicate',
       user_id, 'profiles',
       CONCAT_WS(
         ', ',
         CASE WHEN health_conditions IS NOT NULL AND health_conditions_encrypted IS NOT NULL THEN 'health_conditions' END,
         CASE WHEN current_medications IS NOT NULL AND current_medications_encrypted IS NOT NULL THEN 'current_medications' END,
         CASE WHEN injuries_limitations IS NOT NULL AND injuries_limitations_encrypted IS NOT NULL THEN 'injuries_limitations' END,
         CASE WHEN allergies_restrictions IS NOT NULL AND allergies_restrictions_encrypted IS NOT NULL THEN 'allergies_restrictions' END
       )
FROM sensitive_profile_scope
WHERE (health_conditions IS NOT NULL AND health_conditions_encrypted IS NOT NULL)
   OR (current_medications IS NOT NULL AND current_medications_encrypted IS NOT NULL)
   OR (injuries_limitations IS NOT NULL AND injuries_limitations_encrypted IS NOT NULL)
   OR (allergies_restrictions IS NOT NULL AND allergies_restrictions_encrypted IS NOT NULL)

UNION ALL
SELECT 'warning', 'ai_consent_missing_for_recent_ai_usage',
       fus.user_id, fus.function_name,
       CONCAT('hour=', fus.last_hour, ', day=', fus.last_day)
FROM function_usage_scope fus
LEFT JOIN sensitive_profile_scope p ON p.user_id = fus.user_id
WHERE p.ai_consent_accepted IS DISTINCT FROM true
   OR p.ai_consent_accepted_at IS NULL

UNION ALL
SELECT 'info', 'ai_usage_counts',
       NULL::uuid, function_name,
       CONCAT('users=', COUNT(DISTINCT user_id), ', calls=', SUM(last_day))
FROM function_usage_scope
GROUP BY function_name

ORDER BY severity, check_name, user_id, subject;
