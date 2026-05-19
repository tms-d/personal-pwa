-- Personal Priority Overview — initial schema
-- Single-user-per-row data with RLS. Soft deletes via deleted_at so sync
-- can propagate deletions through pull-since-timestamp.

create table public.tasks (
	id text primary key,
	user_id uuid not null references auth.users(id) on delete cascade,
	title text not null,
	notes text,
	tags text[],
	kind text not null check (kind in ('todo', 'recurring', 'cadence')),
	recurrence_period text check (recurrence_period in ('day', 'week', 'month', 'year')),
	recurrence_every integer,
	recurrence_due_on text,
	cadence_target_interval_days integer,
	created_at timestamptz not null default now(),
	archived_at timestamptz,
	updated_at timestamptz not null default now(),
	deleted_at timestamptz
);

create index tasks_user_updated_idx on public.tasks (user_id, updated_at);
create index tasks_user_archived_idx on public.tasks (user_id, archived_at);

create table public.completions (
	id text primary key,
	user_id uuid not null references auth.users(id) on delete cascade,
	task_id text not null references public.tasks(id) on delete cascade,
	at timestamptz not null,
	updated_at timestamptz not null default now(),
	deleted_at timestamptz
);

create index completions_user_task_idx on public.completions (user_id, task_id);
create index completions_user_updated_idx on public.completions (user_id, updated_at);

-- Maintain updated_at on row updates.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

create trigger tasks_set_updated_at
	before update on public.tasks
	for each row execute function public.set_updated_at();

create trigger completions_set_updated_at
	before update on public.completions
	for each row execute function public.set_updated_at();

-- Row-level security: each row visible/writable only to its owner.
alter table public.tasks enable row level security;
alter table public.completions enable row level security;

create policy "tasks: owner read" on public.tasks
	for select using (auth.uid() = user_id);
create policy "tasks: owner insert" on public.tasks
	for insert with check (auth.uid() = user_id);
create policy "tasks: owner update" on public.tasks
	for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks: owner delete" on public.tasks
	for delete using (auth.uid() = user_id);

create policy "completions: owner read" on public.completions
	for select using (auth.uid() = user_id);
create policy "completions: owner insert" on public.completions
	for insert with check (auth.uid() = user_id);
create policy "completions: owner update" on public.completions
	for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "completions: owner delete" on public.completions
	for delete using (auth.uid() = user_id);
