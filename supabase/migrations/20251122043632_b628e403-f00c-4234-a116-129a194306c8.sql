-- Habilitar realtime para la tabla user_roles
-- Esto permite que el frontend detecte cambios cuando el webhook actualiza el rol a PRO
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;

-- Habilitar realtime para la tabla user_subscriptions  
-- Esto permite detectar cuando una suscripción se activa, cancela o renueva
ALTER TABLE public.user_subscriptions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_subscriptions;