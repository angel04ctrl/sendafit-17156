-- Sprint 15 - Closed beta feedback and minimal app logs.
-- Safe migration: additive beta tables with RLS.

BEGIN;

CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  screen text,
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'normal',
  user_agent text,
  app_version text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_category_check
    CHECK (category IN ('error', 'suggestion', 'confusion', 'problematic_screen')),
  CONSTRAINT feedback_severity_check
    CHECK (severity IN ('low', 'normal', 'high', 'blocking')),
  CONSTRAINT feedback_status_check
    CHECK (status IN ('open', 'reviewing', 'resolved', 'wont_fix'))
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own feedback" ON public.feedback;
CREATE POLICY "Users can insert own feedback"
ON public.feedback
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
CREATE POLICY "Users can view own feedback"
ON public.feedback
FOR SELECT
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS feedback_user_created_idx
  ON public.feedback (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.app_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  screen text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_error_logs_severity_check
    CHECK (severity IN ('warning', 'error', 'critical'))
);

ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own app error logs" ON public.app_error_logs;
CREATE POLICY "Users can insert own app error logs"
ON public.app_error_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can view own app error logs" ON public.app_error_logs;
CREATE POLICY "Users can view own app error logs"
ON public.app_error_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS app_error_logs_user_created_idx
  ON public.app_error_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS app_error_logs_source_created_idx
  ON public.app_error_logs (source, created_at DESC);

COMMENT ON TABLE public.feedback IS
  'Closed beta user feedback: errors, suggestions, confusion points and problematic screens.';
COMMENT ON TABLE public.app_error_logs IS
  'Minimal closed beta client-side error logs. Do not store secrets, full images, or sensitive prompt content.';

COMMIT;
