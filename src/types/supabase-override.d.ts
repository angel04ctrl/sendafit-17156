// Type override to unblock TS "never" errors from typed Supabase client during development
// This widens the exported client type to `any` so calls like supabase.from('profiles') compile.
// Runtime behavior is unchanged.
declare module "@/integrations/supabase/client" {
  const supabase: any;
  export { supabase };
}
