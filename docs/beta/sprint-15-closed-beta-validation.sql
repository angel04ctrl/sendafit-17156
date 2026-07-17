-- Sprint 15 - Validacion de beta cerrada.
-- Resultado esperado para cierre tecnico: 0 filas critical.

SELECT 'critical' AS severity, 'feedback_table_missing_rls' AS check_name,
       NULL::uuid AS user_id, 'feedback' AS details
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'feedback'
    AND c.relrowsecurity = true
)

UNION ALL
SELECT 'critical', 'app_error_logs_table_missing_rls',
       NULL::uuid, 'app_error_logs'
WHERE NOT EXISTS (
  SELECT 1
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'app_error_logs'
    AND c.relrowsecurity = true
)

UNION ALL
SELECT 'warning', 'blocking_feedback_open',
       user_id, CONCAT(screen, ': ', LEFT(message, 160))
FROM public.feedback
WHERE severity = 'blocking'
  AND status IN ('open', 'reviewing')

UNION ALL
SELECT 'warning', 'critical_error_recent',
       user_id, CONCAT(source, ': ', LEFT(message, 160))
FROM public.app_error_logs
WHERE severity = 'critical'
  AND created_at > now() - interval '7 days'

UNION ALL
SELECT 'info', 'feedback_counts',
       NULL::uuid, CONCAT(category, '/', status, '=', COUNT(*))
FROM public.feedback
GROUP BY category, status

UNION ALL
SELECT 'info', 'app_error_counts',
       NULL::uuid, CONCAT(source, '/', severity, '=', COUNT(*))
FROM public.app_error_logs
WHERE created_at > now() - interval '7 days'
GROUP BY source, severity

ORDER BY severity, check_name, user_id;
