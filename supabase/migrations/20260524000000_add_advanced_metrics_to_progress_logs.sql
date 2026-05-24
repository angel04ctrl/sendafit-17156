ALTER TABLE public.progress_logs
ADD COLUMN IF NOT EXISTS body_fat_percentage numeric,
ADD COLUMN IF NOT EXISTS energy_level integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'progress_logs_energy_level_check'
      AND conrelid = 'public.progress_logs'::regclass
  ) THEN
    ALTER TABLE public.progress_logs
    ADD CONSTRAINT progress_logs_energy_level_check
    CHECK (energy_level IS NULL OR (energy_level >= 1 AND energy_level <= 10));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_progress_logs_user_log_date
ON public.progress_logs(user_id, log_date DESC);
