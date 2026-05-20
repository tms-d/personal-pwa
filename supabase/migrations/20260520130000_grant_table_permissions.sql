-- Tables created via SQL migrations don't get the GRANTs that Supabase
-- Studio adds automatically, so a fresh JWT-authenticated user hits
-- "permission denied for table" (42501) before RLS even gets a chance
-- to evaluate. Grant CRUD to the authenticated role here; RLS policies
-- (already in the initial migration) keep each user scoped to their
-- own rows.

grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.completions to authenticated;

-- service_role is used for server-side admin paths (none yet, but
-- standard practice and harmless if unused).
grant all on public.tasks to service_role;
grant all on public.completions to service_role;
