-- Add missing fields to workouts table for plan tracking and weekday consistency

-- Add plan_id to track which plan this workout belongs to
ALTER TABLE public.workouts 
ADD COLUMN plan_id text REFERENCES public.predesigned_plans(id);

-- Add weekday field (1-7, where 1=Monday, 7=Sunday) for consistent weekly scheduling
ALTER TABLE public.workouts 
ADD COLUMN weekday integer;

-- Add check constraint to ensure weekday is between 1 and 7
ALTER TABLE public.workouts 
ADD CONSTRAINT weekday_range CHECK (weekday IS NULL OR (weekday >= 1 AND weekday <= 7));

-- Create index for faster queries by plan_id and weekday
CREATE INDEX idx_workouts_plan_weekday ON public.workouts(plan_id, weekday);
CREATE INDEX idx_workouts_user_weekday ON public.workouts(user_id, weekday);