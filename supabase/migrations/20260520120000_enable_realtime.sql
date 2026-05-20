-- Enable Supabase Realtime on the user-scoped tables so signed-in clients
-- receive INSERT/UPDATE events for their own rows. RLS already restricts
-- visibility per user, so Realtime inherits that filter.

alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.completions;
