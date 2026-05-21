-- Categories — lightweight grouping for tasks. Friend-specific config is
-- deliberately NOT in this table; the friends issue (#27) decides where
-- those defaults live without polluting every category row.

create table public.categories (
	id text primary key,
	user_id uuid not null references auth.users(id) on delete cascade,
	name text not null,
	color text not null,
	sort_order integer not null default 0,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	deleted_at timestamptz
);

create index categories_user_updated_idx on public.categories (user_id, updated_at);
create index categories_user_sort_idx on public.categories (user_id, sort_order);

alter table public.tasks
	add column category_id text references public.categories(id) on delete set null;

create index tasks_user_category_idx on public.tasks (user_id, category_id);

create trigger categories_set_updated_at
	before update on public.categories
	for each row execute function public.set_updated_at();

alter table public.categories enable row level security;

create policy "categories: owner read" on public.categories
	for select using (auth.uid() = user_id);
create policy "categories: owner insert" on public.categories
	for insert with check (auth.uid() = user_id);
create policy "categories: owner update" on public.categories
	for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories: owner delete" on public.categories
	for delete using (auth.uid() = user_id);

-- Explicit GRANTs — see CLAUDE.md gotcha: SQL-created tables don't inherit
-- the GRANTs Studio adds automatically, so authenticated requests get 42501
-- before RLS gets a chance.
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;

alter publication supabase_realtime add table public.categories;
