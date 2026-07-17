-- Sprint 15 - Consultas de seguimiento para beta cerrada.
-- Ejecutar como owner/admin en Supabase SQL Editor.

SELECT
  category,
  severity,
  status,
  COUNT(*) AS total,
  MIN(created_at) AS first_seen,
  MAX(created_at) AS last_seen
FROM public.feedback
GROUP BY category, severity, status
ORDER BY last_seen DESC;

SELECT
  source,
  severity,
  COUNT(*) AS total,
  MAX(created_at) AS last_seen
FROM public.app_error_logs
WHERE created_at > now() - interval '7 days'
GROUP BY source, severity
ORDER BY total DESC, last_seen DESC;

SELECT
  f.created_at,
  f.category,
  f.severity,
  f.screen,
  LEFT(f.message, 240) AS message,
  f.status
FROM public.feedback f
ORDER BY f.created_at DESC
LIMIT 100;
