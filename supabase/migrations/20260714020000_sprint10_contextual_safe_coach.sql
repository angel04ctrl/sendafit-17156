-- Sprint 10 - Contextual and safe AI coach.
-- Safe migration: additive conversation fields and pending action audit table.

BEGIN;

ALTER TABLE public.ai_trainer_conversations
  ADD COLUMN IF NOT EXISTS user_message text,
  ADD COLUMN IF NOT EXISTS assistant_message text,
  ADD COLUMN IF NOT EXISTS context_used jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS model_used text,
  ADD COLUMN IF NOT EXISTS intent_type text,
  ADD COLUMN IF NOT EXISTS safety_flags text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.ai_trainer_conversations
  DROP CONSTRAINT IF EXISTS ai_trainer_conversations_intent_type_check;

ALTER TABLE public.ai_trainer_conversations
  ADD CONSTRAINT ai_trainer_conversations_intent_type_check
  CHECK (
    intent_type IS NULL
    OR intent_type IN ('entrenamiento', 'nutricion', 'lesion', 'rutina', 'motivacion', 'fuera_de_alcance')
  );

CREATE TABLE IF NOT EXISTS public.coach_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.ai_trainer_conversations(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  title text NOT NULL,
  preview jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  applied_at timestamptz,
  rejected_at timestamptz,
  CONSTRAINT coach_actions_action_type_check
  CHECK (action_type IN ('modify_routine', 'substitute_exercise', 'adjust_today_workout', 'suggest_macro_change', 'reschedule_workout')),
  CONSTRAINT coach_actions_status_check
  CHECK (status IN ('pending', 'confirmed', 'applied', 'rejected', 'expired', 'failed'))
);

ALTER TABLE public.coach_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own coach actions" ON public.coach_actions;
CREATE POLICY "Users can view own coach actions"
ON public.coach_actions
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own coach actions" ON public.coach_actions;
CREATE POLICY "Users can insert own coach actions"
ON public.coach_actions
FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own coach actions" ON public.coach_actions;
CREATE POLICY "Users can update own coach actions"
ON public.coach_actions
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS ai_trainer_conversations_user_created_idx
  ON public.ai_trainer_conversations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_trainer_conversations_intent_created_idx
  ON public.ai_trainer_conversations (intent_type, created_at DESC);

CREATE INDEX IF NOT EXISTS coach_actions_user_status_idx
  ON public.coach_actions (user_id, status, created_at DESC);

COMMENT ON TABLE public.coach_actions IS
  'Pending and applied AI Coach actions that require user confirmation.';
COMMENT ON COLUMN public.ai_trainer_conversations.context_used IS
  'Structured user context used by the AI Coach for this response.';
COMMENT ON COLUMN public.ai_trainer_conversations.intent_type IS
  'Classified Coach intent: entrenamiento, nutricion, lesion, rutina, motivacion, fuera_de_alcance.';

COMMIT;
