-- Owner PRO activation for production.
-- Target owner supplied by app owner:
-- full_name = 'Angel Augusto Perez Tek'
-- id starts with '96ff31bf'
--
-- Run only from Supabase SQL Editor as an admin/service role.

BEGIN;

-- 1. Preview the exact owner row. This must return exactly one row.
SELECT id, full_name, created_at
FROM public.profiles
WHERE id::text LIKE '96ff31bf%'
  AND full_name = 'Angel Augusto Perez Tek';

DO $$
DECLARE
  match_count integer;
BEGIN
  SELECT count(*) INTO match_count
  FROM public.profiles
  WHERE id::text LIKE '96ff31bf%'
    AND full_name = 'Angel Augusto Perez Tek';

  IF match_count <> 1 THEN
    RAISE EXCEPTION 'Owner lookup must match exactly one profile. Found % rows.', match_count;
  END IF;
END $$;

-- 2. Activate PRO for approximately 30 days.
WITH owner AS (
  SELECT id
  FROM public.profiles
  WHERE id::text LIKE '96ff31bf%'
    AND full_name = 'Angel Augusto Perez Tek'
  LIMIT 1
)
UPDATE public.user_subscriptions
SET
  plan = 'mensual',
  provider = 'manual_admin',
  status = 'active',
  last_event = 'manual_owner_activation',
  start_date = now(),
  end_date = now() + interval '30 days',
  current_period_start = now(),
  current_period_end = now() + interval '30 days'
WHERE user_id = (SELECT id FROM owner);

WITH owner AS (
  SELECT id
  FROM public.profiles
  WHERE id::text LIKE '96ff31bf%'
    AND full_name = 'Angel Augusto Perez Tek'
  LIMIT 1
)
INSERT INTO public.user_subscriptions (
  user_id,
  plan,
  provider,
  status,
  last_event,
  start_date,
  end_date,
  current_period_start,
  current_period_end
)
SELECT
  owner.id,
  'mensual',
  'manual_admin',
  'active',
  'manual_owner_activation',
  now(),
  now() + interval '30 days',
  now(),
  now() + interval '30 days'
FROM owner
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_subscriptions existing
  WHERE existing.user_id = owner.id
);

WITH owner AS (
  SELECT id
  FROM public.profiles
  WHERE id::text LIKE '96ff31bf%'
    AND full_name = 'Angel Augusto Perez Tek'
  LIMIT 1
)
INSERT INTO public.user_roles (user_id, role)
SELECT owner.id, 'pro'::public.app_role
FROM owner
ON CONFLICT (user_id, role) DO NOTHING;

WITH owner AS (
  SELECT id
  FROM public.profiles
  WHERE id::text LIKE '96ff31bf%'
    AND full_name = 'Angel Augusto Perez Tek'
  LIMIT 1
)
INSERT INTO public.user_settings (user_id, is_pro, dev_mode)
SELECT owner.id, true, false
FROM owner
ON CONFLICT (user_id) DO UPDATE SET
  is_pro = true,
  dev_mode = false,
  updated_at = now();

-- 3. Validate active PRO.
SELECT
  p.id,
  p.full_name,
  us.plan,
  us.provider,
  us.status,
  us.current_period_start,
  us.current_period_end,
  public.is_user_pro(p.id) AS is_user_pro
FROM public.profiles p
LEFT JOIN public.user_subscriptions us ON us.user_id = p.id
WHERE p.id::text LIKE '96ff31bf%'
  AND p.full_name = 'Angel Augusto Perez Tek';

COMMIT;

-- Deactivate owner PRO safely when needed.
-- BEGIN;
-- WITH owner AS (
--   SELECT id
--   FROM public.profiles
--   WHERE id::text LIKE '96ff31bf%'
--     AND full_name = 'Angel Augusto Perez Tek'
--   LIMIT 1
-- )
-- UPDATE public.user_subscriptions
-- SET status = 'canceled',
--     last_event = 'manual_owner_deactivation',
--     end_date = now(),
--     current_period_end = now()
-- WHERE user_id = (SELECT id FROM owner);
--
-- WITH owner AS (
--   SELECT id
--   FROM public.profiles
--   WHERE id::text LIKE '96ff31bf%'
--     AND full_name = 'Angel Augusto Perez Tek'
--   LIMIT 1
-- )
-- UPDATE public.user_settings
-- SET is_pro = false,
--     updated_at = now()
-- WHERE user_id = (SELECT id FROM owner);
--
-- COMMIT;
