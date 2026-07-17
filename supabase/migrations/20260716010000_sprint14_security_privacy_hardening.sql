-- Sprint 14 - Seguridad, privacidad y limites fitness/nutricion.
-- Safe migration: consent metadata, explicit AI data deletion, and privacy comments.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_consent_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_consent_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_consent_version text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_ai_consent_metadata_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_ai_consent_metadata_check
  CHECK (
    (ai_consent_accepted = false AND ai_consent_accepted_at IS NULL)
    OR (ai_consent_accepted = true AND ai_consent_accepted_at IS NOT NULL)
  );

COMMENT ON COLUMN public.profiles.ai_consent_accepted IS
  'Sprint 14: explicit consent flag for AI processing of user-provided fitness, nutrition, chat, and image context.';
COMMENT ON COLUMN public.profiles.ai_consent_accepted_at IS
  'Sprint 14: timestamp when user accepted AI processing notice.';
COMMENT ON COLUMN public.profiles.ai_consent_version IS
  'Sprint 14: consent copy/version accepted by the user.';

COMMENT ON COLUMN public.profiles.health_conditions IS
  'Sensitive health data. Keep only while needed for personalization; encrypted mirror may exist for transitional compatibility.';
COMMENT ON COLUMN public.profiles.current_medications IS
  'Sensitive health data. Avoid sending to AI unless needed for safety context.';
COMMENT ON COLUMN public.profiles.injuries_limitations IS
  'Sensitive health data used for training safety constraints.';
COMMENT ON COLUMN public.profiles.allergies_restrictions IS
  'Sensitive nutrition/health data used for food recommendations.';
COMMENT ON TABLE public.ai_trainer_conversations IS
  'AI conversation audit trail. Users should be able to request deletion via delete_my_ai_data.';
COMMENT ON TABLE public.machine_scan_history IS
  'AI machine image analysis history. Store only user-owned scans and delete on user request.';
COMMENT ON TABLE public.ai_function_usage IS
  'Rate-limit audit records for AI functions. No prompt/image content should be stored here.';

CREATE OR REPLACE FUNCTION public.delete_my_ai_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _coach_actions_deleted integer := 0;
  _conversations_deleted integer := 0;
  _machine_favorites_deleted integer := 0;
  _machine_scans_deleted integer := 0;
  _usage_deleted integer := 0;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  DELETE FROM public.coach_actions
  WHERE user_id = _user_id;
  GET DIAGNOSTICS _coach_actions_deleted = ROW_COUNT;

  DELETE FROM public.ai_trainer_conversations
  WHERE user_id = _user_id;
  GET DIAGNOSTICS _conversations_deleted = ROW_COUNT;

  DELETE FROM public.machine_exercise_favorites
  WHERE user_id = _user_id;
  GET DIAGNOSTICS _machine_favorites_deleted = ROW_COUNT;

  DELETE FROM public.machine_scan_history
  WHERE user_id = _user_id;
  GET DIAGNOSTICS _machine_scans_deleted = ROW_COUNT;

  DELETE FROM public.ai_function_usage
  WHERE user_id = _user_id;
  GET DIAGNOSTICS _usage_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'coach_actions_deleted', _coach_actions_deleted,
    'conversations_deleted', _conversations_deleted,
    'machine_favorites_deleted', _machine_favorites_deleted,
    'machine_scans_deleted', _machine_scans_deleted,
    'usage_deleted', _usage_deleted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_ai_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_ai_data() TO authenticated;

COMMENT ON FUNCTION public.delete_my_ai_data() IS
  'Deletes current authenticated user AI conversations, AI actions, machine scan history, favorites, and AI usage counters. Storage objects may need bucket lifecycle cleanup.';

COMMIT;
